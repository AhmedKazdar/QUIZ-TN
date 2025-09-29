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
}
