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
import { UseGuards, OnModuleInit } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { QuizService } from '../quiz/quiz.service';
import { QuizSessionService } from './quiz-session.service';

export interface AuthenticatedSocket extends Socket {
  user: {
    userId: string;
    username: string;
  };
}

// Store synchronized quiz sessions
interface SynchronizedQuizSession {
  id: string;
  questions: any[];
  participants: Map<string, { userId: string; username: string; socketId: string; score: number; isEliminated: boolean }>;
  currentQuestionIndex: number;
  createdAt: Date;
  isActive: boolean;
  timer: NodeJS.Timeout | null;
  startTime: Date | null;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  path: '/socket.io',
  namespace: '/quiz',
})
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  
  // Store synchronized quiz sessions
  private synchronizedSessions: Map<string, SynchronizedQuizSession> = new Map();

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
    this.quizSessionService.removeParticipantFromAllSessions(client.user.userId);
    this.removeParticipantFromAllSynchronizedSessions(client.user.userId);
  }

  // NEW: Create synchronized quiz session
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('createSynchronizedQuiz')
  async handleCreateSynchronizedQuiz(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; questionCount: number },
  ) {
    try {
      console.log(`🎯 Creating synchronized quiz: ${data.quizId}`);
      
      // Generate consistent questions for this quiz
      const questions = await this.getDeterministicQuestions(data.quizId, data.questionCount);
      
      const session: SynchronizedQuizSession = {
        id: data.quizId,
        questions,
        currentQuestionIndex: -1, // -1 means not started
        participants: new Map(),
        createdAt: new Date(),
        isActive: false,
        timer: null,
        startTime: null,
      };
      
      // Add the creator as first participant
      session.participants.set(client.user.userId, {
        userId: client.user.userId,
        username: client.user.username,
        socketId: client.id,
        score: 0,
        isEliminated: false
      });
      
      this.synchronizedSessions.set(data.quizId, session);
      
      // Join the room
      client.join(data.quizId);
      
      console.log(`✅ Created synchronized quiz ${data.quizId} with ${questions.length} questions`);
      
      return {
        event: 'synchronizedQuizCreated',
        data: {
          quizId: data.quizId,
          totalQuestions: questions.length,
          totalParticipants: 1
        }
      };
    } catch (error) {
      console.error('Error creating synchronized quiz:', error);
      return {
        event: 'error',
        data: { message: 'Failed to create synchronized quiz' }
      };
    }
  }

  // NEW: Join synchronized quiz
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('joinSynchronizedQuiz')
  async handleJoinSynchronizedQuiz(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string },
  ) {
    try {
      const session = this.synchronizedSessions.get(data.quizId);
      if (!session) {
        return {
          event: 'error',
          data: { message: 'Quiz session not found' }
        };
      }
      
      // Add participant
      session.participants.set(client.user.userId, {
        userId: client.user.userId,
        username: client.user.username,
        socketId: client.id,
        score: 0,
        isEliminated: false
      });
      
      // Join the room
      client.join(data.quizId);
      
      console.log(`✅ ${client.user.username} joined synchronized quiz ${data.quizId}`);
      
      // Send current quiz state to the new participant
      const responseData: any = {
        quizId: data.quizId,
        questions: session.questions, // Send all questions
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: session.questions.length,
        totalParticipants: session.participants.size,
        isActive: session.isActive
      };

      // If quiz is active, send current question and time remaining
      if (session.isActive && session.currentQuestionIndex >= 0) {
        responseData.currentQuestion = session.questions[session.currentQuestionIndex];
        if (session.startTime) {
          responseData.timeRemaining = this.calculateTimeRemaining(session.startTime);
        }
      }
      
      client.emit('synchronizedQuizJoined', responseData);
      
      // Notify other participants
      client.to(data.quizId).emit('playerJoined', {
        userId: client.user.userId,
        username: client.user.username,
        totalParticipants: session.participants.size
      });
      
      return {
        event: 'joinedSynchronizedQuiz',
        data: { success: true }
      };
    } catch (error) {
      return {
        event: 'error',
        data: { message: error.message }
      };
    }
  }

  // NEW: Start synchronized quiz - sends first question to ALL participants
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('startSynchronizedQuiz')
  async handleStartSynchronizedQuiz(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string },
  ) {
    try {
      const session = this.synchronizedSessions.get(data.quizId);
      if (!session) {
        return {
          event: 'error',
          data: { message: 'Quiz session not found' }
        };
      }
      
      // Reset to first question
      session.currentQuestionIndex = 0;
      session.isActive = true;
      session.startTime = new Date();
      
      const firstQuestion = session.questions[0];
      
      console.log(`🎬 Starting synchronized quiz ${data.quizId} with ${session.participants.size} participants`);
      
      // Broadcast first question to ALL participants simultaneously
      this.server.to(data.quizId).emit('synchronizedQuestion', {
        question: firstQuestion,
        questionIndex: 0,
        totalQuestions: session.questions.length,
        startTime: session.startTime.toISOString(),
        timeLimit: 15 // 15 seconds per question
      });
      
      // Start global timer for this question
      this.startQuestionTimer(data.quizId, 0);
      
      return {
        event: 'synchronizedQuizStarted',
        data: { success: true }
      };
    } catch (error) {
      return {
        event: 'error',
        data: { message: error.message }
      };
    }
  }

  // NEW: Move to next synchronized question
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('nextSynchronizedQuestion')
  async handleNextSynchronizedQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string },
  ) {
    try {
      const session = this.synchronizedSessions.get(data.quizId);
      if (!session) {
        return {
          event: 'error',
          data: { message: 'Quiz session not found' }
        };
      }
      
      const nextIndex = session.currentQuestionIndex + 1;
      
      if (nextIndex >= session.questions.length) {
        // Quiz finished
        this.server.to(data.quizId).emit('synchronizedQuizFinished', {
          quizId: data.quizId,
          totalQuestions: session.questions.length
        });
        
        // Determine winner
        this.determineWinner(data.quizId);
        return;
      }
      
      session.currentQuestionIndex = nextIndex;
      session.startTime = new Date();
      const nextQuestion = session.questions[nextIndex];
      
      console.log(`➡️ Moving to question ${nextIndex + 1} in quiz ${data.quizId}`);
      
      // Broadcast next question to ALL participants simultaneously
      this.server.to(data.quizId).emit('synchronizedQuestion', {
        question: nextQuestion,
        questionIndex: nextIndex,
        totalQuestions: session.questions.length,
        startTime: session.startTime.toISOString(),
        timeLimit: 15
      });
      
      // Start timer for this question
      this.startQuestionTimer(data.quizId, nextIndex);
      
      return {
        event: 'nextQuestionSent',
        data: { questionIndex: nextIndex }
      };
    } catch (error) {
      return {
        event: 'error',
        data: { message: error.message }
      };
    }
  }

  // NEW: Global question timer
  private startQuestionTimer(quizId: string, questionIndex: number): void {
    const session = this.synchronizedSessions.get(quizId);
    if (!session) return;

    // Clear existing timer
    if (session.timer) {
      clearInterval(session.timer);
    }

    const timeLimit = 15; // 15 seconds
    let timeRemaining = timeLimit;
    
    session.timer = setInterval(() => {
      timeRemaining--;
      
      // Broadcast time update to all participants
      this.server.to(quizId).emit('synchronizedTimeUpdate', {
        questionIndex,
        timeRemaining,
        timeLimit
      });
      
      if (timeRemaining <= 0) {
        clearInterval(session.timer!);
        session.timer = null;
        
        // Time's up - move to next question or end quiz
        if (questionIndex < session.questions.length - 1) {
          // Auto-move to next question after a brief pause
          setTimeout(() => {
            this.handleNextSynchronizedQuestion(
              { emit: (event, data) => this.server.to(quizId).emit(event, data) } as any,
              { quizId }
            );
          }, 2000);
        } else {
          // End of quiz
          this.server.to(quizId).emit('synchronizedQuizFinished', {
            quizId,
            totalQuestions: session.questions.length
          });
          this.determineWinner(quizId);
        }
      }
    }, 1000);
  }

  // NEW: Submit answer in synchronized quiz
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('submitSynchronizedAnswer')
  async handleSubmitSynchronizedAnswer(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; questionIndex: number; answerIndex: number },
  ) {
    try {
      const session = this.synchronizedSessions.get(data.quizId);
      if (!session) {
        return {
          event: 'error',
          data: { message: 'Quiz session not found' }
        };
      }
      
      // Validate question index
      if (data.questionIndex !== session.currentQuestionIndex) {
        return {
          event: 'error',
          data: { message: 'Invalid question index' }
        };
      }
      
      const participant = session.participants.get(client.user.userId);
      if (!participant || participant.isEliminated) {
        return {
          event: 'error',
          data: { message: 'Participant not found or eliminated' }
        };
      }

      const question = session.questions[data.questionIndex];
      const isCorrect = question.options[data.answerIndex]?.isCorrect === true;
      
      console.log(`📝 ${client.user.username} answered question ${data.questionIndex + 1}: ${isCorrect ? 'CORRECT' : 'WRONG'}`);
      
      // Update participant score
      if (isCorrect) {
        participant.score += 10;
      } else {
        participant.isEliminated = true;
      }
      
      // Broadcast answer to other participants
      client.to(data.quizId).emit('playerAnsweredSynchronized', {
        userId: client.user.userId,
        username: client.user.username,
        questionIndex: data.questionIndex,
        isCorrect,
        isEliminated: !isCorrect
      });

      // Send response to the answering player
      return {
        event: 'synchronizedAnswerResult',
        data: {
          questionIndex: data.questionIndex,
          isCorrect,
          correctAnswerIndex: question.options.findIndex(opt => opt.isCorrect),
          score: participant.score
        }
      };
    } catch (error) {
      return {
        event: 'error',
        data: { message: error.message }
      };
    }
  }

  // NEW: Determine winner based on scores
  private determineWinner(quizId: string): void {
    const session = this.synchronizedSessions.get(quizId);
    if (!session) return;

    const activeParticipants = Array.from(session.participants.values())
      .filter(p => !p.isEliminated)
      .sort((a, b) => b.score - a.score);

    if (activeParticipants.length > 0) {
      const winner = activeParticipants[0];
      this.server.to(quizId).emit('synchronizedWinner', {
        winner: {
          userId: winner.userId,
          username: winner.username,
          score: winner.score
        },
        quizId
      });
    } else {
      this.server.to(quizId).emit('synchronizedWinner', {
        winner: null, // No winner - all eliminated
        quizId
      });
    }
  }

  // Helper method to calculate time remaining
  private calculateTimeRemaining(startTime: Date): number {
    const elapsed = Date.now() - startTime.getTime();
    return Math.max(0, 15 - Math.floor(elapsed / 1000));
  }

  // Remove participant from synchronized sessions
  private removeParticipantFromAllSynchronizedSessions(userId: string): void {
    for (const [quizId, session] of this.synchronizedSessions.entries()) {
      if (session.participants.has(userId)) {
        session.participants.delete(userId);
        console.log(`Removed user ${userId} from synchronized quiz ${quizId}`);
        
        // If no participants left, clean up session
        if (session.participants.size === 0) {
          if (session.timer) {
            clearInterval(session.timer);
          }
          this.synchronizedSessions.delete(quizId);
          console.log(`Cleaned up empty synchronized quiz: ${quizId}`);
        }
      }
    }
  }

  // Keep your existing deterministic question methods
  private async getDeterministicQuestions(quizId: string, count: number): Promise<any[]> {
    const allQuestions = await this.quizService.getAllQuestions();
    
    if (!allQuestions || allQuestions.length === 0) {
      throw new Error('No questions available');
    }

    const seed = this.generateSeedFromString(quizId);
    const shuffledQuestions = this.deterministicShuffle([...allQuestions], seed);
    
    return shuffledQuestions.slice(0, count);
  }

  private generateSeedFromString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private deterministicShuffle<T>(array: T[], seed: number): T[] {
    const shuffled = [...array];
    const random = this.seededRandom(seed);
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  }

  private seededRandom(seed: number): () => number {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // Clean up old sessions periodically
  private cleanupOldSessions(): void {
    const now = new Date();
    const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
    
    for (const [quizId, session] of this.synchronizedSessions.entries()) {
      if (now.getTime() - session.createdAt.getTime() > SESSION_TIMEOUT) {
        console.log(`🧹 Cleaning up old synchronized quiz session: ${quizId}`);
        if (session.timer) {
          clearInterval(session.timer);
        }
        this.synchronizedSessions.delete(quizId);
      }
    }
  }

  // Initialize cleanup interval
  onModuleInit() {
    // Clean up old sessions every 30 minutes
    setInterval(() => this.cleanupOldSessions(), 30 * 60 * 1000);
  }

  // UPDATED: For backward compatibility - fix the parameter name
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('requestQuestions')
  async handleRequestQuestions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; count: number },
  ) {
    // Convert 'count' to 'questionCount' for the synchronized method
    return this.handleCreateSynchronizedQuiz(client, {
      quizId: data.quizId,
      questionCount: data.count
    });
  }

  // Keep other existing methods for backward compatibility
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('readyForNextQuestion')
  async handleReadyForNextQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; userId: string; questionIndex: number },
  ) {
    try {
      console.log(`✅ Player ${data.userId} ready for question ${data.questionIndex}`);
      
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
      this.determineWinner(data.quizId);
      return {
        event: 'winnerDetermined',
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