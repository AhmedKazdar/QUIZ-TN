import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuizSessionService } from './quiz-session.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { QuizService } from '../quiz/quiz.service';

export interface AuthenticatedSocket extends Socket {
  user: {
    userId: string;
    username: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  path: '/socket.io',
  namespace: '/quiz',
})
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly quizSessionService: QuizSessionService,
    private readonly quizService: QuizService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      client.user = {
        userId: payload.sub,
        username: payload.username,
      };

      console.log(`Client connected: ${client.id} (User: ${client.user.username})`);
    } catch (error) {
      console.error('Authentication error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.user) return;
    
    console.log(`Client disconnected: ${client.id} (User: ${client.user.username})`);
    // Handle cleanup in session service
    this.quizSessionService.removeParticipantFromAllSessions(client.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('createSession')
  async handleCreateSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string },
  ) {
    try {
      const session = await this.quizSessionService.createSession(
        data.quizId,
        client.user.userId,
        client.id,
      );
      
      client.join(session.id);
      
      return {
        event: 'sessionCreated',
        data: {
          sessionId: session.id,
          quizId: session.quizId,
          status: session.status,
        },
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    try {
      const session = this.quizSessionService.joinSession(
        data.sessionId,
        client.user.userId,
        client.id,
      );
      
      client.join(session.id);
      
      return {
        event: 'sessionJoined',
        data: {
          sessionId: session.id,
          quizId: session.quizId,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          timeRemaining: session.timeRemaining,
          participants: session.participants.map(p => ({
            userId: p.userId,
            score: p.score,
            isEliminated: p.isEliminated,
          })),
        },
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('startQuiz')
  async handleStartQuiz(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    try {
      const session = this.quizSessionService.getSession(data.sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      if (session.hostId !== client.user.userId) {
        throw new Error('Only the host can start the quiz');
      }
      
      this.quizSessionService.startQuiz(session.id);
      
      return {
        event: 'quizStarted',
        data: { success: true },
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('submitAnswer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string; answer: number },
  ) {
    try {
      this.quizSessionService.submitAnswer(
        data.sessionId,
        client.user.userId,
        data.answer,
      );
      
      return {
        event: 'answerSubmitted',
        data: { success: true },
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('leaveSession')
  async handleLeaveSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    try {
      this.quizSessionService.removeParticipant(data.sessionId, client.user.userId);
      client.leave(data.sessionId);
      
      return {
        event: 'sessionLeft',
        data: { success: true },
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  // NEW METHODS FOR ONE-BY-ONE QUESTION DELIVERY

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('requestQuestion')
  async handleRequestQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string; questionIndex: number },
  ) {
    try {
      console.log(`📝 Requesting question ${data.questionIndex}`);
      
      // Get a random question from ALL available questions
      const randomQuestions = await this.quizService.getRandomQuestions(1);
      const question = randomQuestions[0];
      
      if (question) {
        console.log(`✅ Sending random question ${data.questionIndex} from all available`);
        
        // Send the random question to the requesting client
        client.emit('newQuestion', {
          question,
          questionIndex: data.questionIndex,
          totalQuestions: 10
        });
        
        // Also broadcast to other players in the same quiz
        client.to(data.quizId).emit('newQuestion', {
          question,
          questionIndex: data.questionIndex,
          totalQuestions: 10
        });
      }
    } catch (error) {
      console.error('Error fetching random question:', error);
      client.emit('error', { message: 'Failed to load question' });
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('readyForNextQuestion')
  async handleReadyForNextQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; userId: string; questionIndex: number },
  ) {
    try {
      console.log(`✅ Player ${data.userId} ready for question ${data.questionIndex}`);
      
      // Track which players are ready for the next question
      client.to(data.quizId).emit('playerReady', {
        userId: data.userId,
        questionIndex: data.questionIndex,
        username: client.user.username
      });

      return {
        event: 'readyAcknowledged',
        data: { success: true }
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('determineWinner')
  async handleDetermineWinner(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; questionIndex: number },
  ) {
    try {
      console.log(`🏆 Determining winner for quiz ${data.quizId}`);
      
      // Get all participants and determine winner based on scores
      // This is a simplified version - you might want more complex logic
      const winnerData = {
        userId: client.user.userId,
        username: client.user.username
      };
      
      // Broadcast winner to all players in the quiz
      this.server.to(data.quizId).emit('winnerDetermined', {
        winner: winnerData,
        questionIndex: data.questionIndex
      });
      
      return {
        event: 'winnerDetermined',
        data: { winner: winnerData }
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('playerAnswered')
  async handlePlayerAnswered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string; questionIndex: number; isCorrect: boolean },
  ) {
    try {
      // Broadcast to other players that someone answered
      client.broadcast.emit('playerAnswered', {
        userId: data.userId,
        username: client.user.username,
        questionIndex: data.questionIndex,
        isCorrect: data.isCorrect
      });
      
      return {
        event: 'answerBroadcasted',
        data: { success: true }
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('playerEliminated')
  async handlePlayerEliminated(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string; questionIndex: number; reason: string },
  ) {
    try {
      // Broadcast elimination to other players
      client.broadcast.emit('playerEliminated', {
        userId: data.userId,
        username: client.user.username,
        questionIndex: data.questionIndex,
        reason: data.reason
      });
      
      return {
        event: 'eliminationBroadcasted',
        data: { success: true }
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('playerWin')
  async handlePlayerWin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: string; username: string; questionIndex: number },
  ) {
    try {
      // Broadcast player win to all other players
      client.broadcast.emit('playerWin', {
        userId: data.userId,
        username: data.username,
        questionIndex: data.questionIndex
      });
      
      return {
        event: 'winBroadcasted',
        data: { success: true }
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('gameOver')
  async handleGameOver(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { winner: { userId: string; username: string } },
  ) {
    try {
      // Broadcast game over to all players
      this.server.emit('gameOver', {
        winner: data.winner
      });
      
      return {
        event: 'gameOverBroadcasted',
        data: { success: true }
      };
    } catch (error) {
      return {
        event: 'error',
        data: {
          message: error.message,
        },
      };
    }
  }
}