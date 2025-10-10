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
import { UseGuards, OnModuleInit, Logger } from '@nestjs/common';
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
  // Removed namespace: '/quiz' to fix connection mismatch with frontend
})
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer() server: Server;
  
  private readonly logger = new Logger(QuizGateway.name);
  private connectionAttempts: Map<string, number> = new Map();
  private synchronizedSessions: Map<string, SynchronizedQuizSession> = new Map();

  constructor(
    private readonly quizSessionService: QuizSessionService,
    private readonly quizService: QuizService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('✅ QuizGateway initialized on default namespace');
    this.logger.log('📡 Quiz WebSocket server ready for connections');
    this.logger.log(`🏃 Transports: websocket, polling`);
    this.logger.log(`🌐 CORS enabled for all origins`);
  }

  async handleConnection(client: AuthenticatedSocket) {
    const clientIp = client.handshake.address;
    const socketId = client.id;
    
    this.logger.log(`🔌 New quiz connection attempt: ${socketId} from ${clientIp}`);
    
    try {
      const token = client.handshake.auth?.token || 
                   client.handshake.query?.token as string ||
                   client.handshake.headers?.authorization?.replace('Bearer ', '');

      this.logger.log(`🔍 Token search results for ${socketId}:`, {
        auth: !!client.handshake.auth?.token,
        query: !!client.handshake.query?.token,
        headers: !!client.handshake.headers?.authorization,
        tokenExists: !!token
      });
      
      if (!token) {
        this.logger.warn(`❌ No token provided for socket ${socketId} from ${clientIp}`);
        client.emit('authentication_required', { 
          message: 'Authentication required for quiz features',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const attempts = this.connectionAttempts.get(clientIp) || 0;
      if (attempts > 5) {
        this.logger.warn(`🚫 Too many connection attempts from ${clientIp}`);
        client.emit('authentication_error', { message: 'Too many connection attempts. Please wait.' });
        client.disconnect();
        return;
      }

      this.connectionAttempts.set(clientIp, attempts + 1);

      try {
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get('JWT_SECRET') || '123456',
        });

        this.connectionAttempts.delete(clientIp);

        client.user = {
          userId: payload.sub,
          username: payload.username || payload.phoneNumber,
        };

        this.logger.log(`✅ Quiz client connected: ${socketId} (User: ${client.user.username})`);
        
        client.join(`user_${client.user.userId}`);
        
        client.emit('authentication_success', { 
          message: 'Successfully connected to quiz gateway',
          user: client.user
        });

        client.emit('connection_debug', {
          socketId: client.id,
          userId: client.user.userId,
          username: client.user.username,
          timestamp: new Date().toISOString()
        });

      } catch (jwtError) {
        this.logger.error(`❌ JWT Error for socket ${socketId}: ${jwtError.message}`);
        
        if (jwtError.name === 'TokenExpiredError') {
          client.emit('token_expired', { 
            message: 'Authentication token has expired. Please refresh your token.',
            code: 'TOKEN_EXPIRED'
          });
        } else if (jwtError.name === 'JsonWebTokenError') {
          client.emit('authentication_error', { 
            message: 'Invalid authentication token.',
            code: 'INVALID_TOKEN'
          });
        } else {
          client.emit('authentication_error', { 
            message: 'Authentication failed.',
            code: 'AUTH_FAILED'
          });
        }
        
        this.logger.log(`🔌 Allowing quiz connection ${socketId} with limited features due to auth error`);
      }

    } catch (error) {
      this.logger.error(`❌ Connection error for socket ${socketId}: ${error.message}`);
      client.emit('authentication_error', { 
        message: 'Connection authentication failed',
        code: 'CONNECTION_FAILED'
      });
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.user) {
      this.logger.log(`Unauthenticated client disconnected: ${client.id}`);
      return;
    }
    
    this.logger.log(`Client disconnected: ${client.id} (User: ${client.user.username})`);
    this.quizSessionService.removeParticipantFromAllSessions(client.user.userId);
    this.removeParticipantFromAllSynchronizedSessions(client.user.userId);
    
    const clientIp = client.handshake.address;
    this.connectionAttempts.delete(clientIp);
  }

  // NEW: Handle solo questions request
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('getSoloQuestions')
  async handleGetSoloQuestions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { count: number; mode: string },
  ) {
    try {
      this.logger.log(`📚 [SOLO] Requesting ${data?.count} solo questions for user ${client.user.username}`);
      this.logger.log(`📦 [SOLO] Received data:`, data);
      
      if (!data?.count) {
        this.logger.warn(`❌ [SOLO] No count provided, using default 10`);
        data.count = 10;
      }
  
      // Get questions from your service
      const questions = await this.quizService.getRandomQuestions(data.count);
      
      this.logger.log(`✅ [SOLO] Sending ${questions.length} solo questions to ${client.user.username}`);
      this.logger.log(`📋 [SOLO] Questions being sent:`, questions.map(q => ({
        id: q.id,
        question: q.question.substring(0, 50) + '...',
        options: q.options.map(opt => ({ text: opt.text.substring(0, 20) + '...', isCorrect: opt.isCorrect }))
      })));
      
      // Send back to the requesting client only
      client.emit('soloQuestionsLoaded', {
        questions,
        totalQuestions: questions.length,
        mode: data.mode || 'solo',
        timestamp: new Date().toISOString()
      });
      
      return {
        event: 'success',
        data: { message: 'Questions sent' }
      };
    } catch (error) {
      this.logger.error('❌ [SOLO] Error getting solo questions:', error);
      
      client.emit('soloQuestionsError', {
        message: 'Failed to load questions',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        event: 'error',
        data: { message: 'Failed to load questions' }
      };
    }
  }

  // NEW: Handle online questions request
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('requestQuestions')
  async handleRequestQuestions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; count: number },
  ) {
    try {
      this.logger.log(`🎯 Requesting ${data.count} questions for online quiz: ${data.quizId}`);

      // Check if there's an existing session for this quiz
      let session = this.synchronizedSessions.get(data.quizId);

      if (session && session.questions.length > 0) {
        // Use existing session questions (ensures consistency)
        this.logger.log(`✅ Using existing session questions for quiz ${data.quizId} (${session.questions.length} questions)`);
        this.logger.log(`📋 Questions being sent:`, session.questions.map(q => ({
          id: q.id,
          question: q.question.substring(0, 30) + '...'
        })));

        client.emit('questionsLoaded', {
          questions: session.questions,
          totalQuestions: session.questions.length,
          quizId: data.quizId
        });

        return {
          event: 'success',
          data: { message: 'Questions loaded from existing session' }
        };
      } else {
        // Generate new deterministic questions for this quiz session
        this.logger.log(`🔄 No existing session found, generating new questions for quiz ${data.quizId}`);
        const questions = await this.getDeterministicQuestions(data.quizId, data.count);

        this.logger.log(`✅ Generated ${questions.length} questions for quiz ${data.quizId}`);
        this.logger.log(`📋 Questions generated:`, questions.map(q => ({
          id: q.id,
          question: q.question.substring(0, 30) + '...'
        })));

        // Send back to the requesting client
        client.emit('questionsLoaded', {
          questions,
          totalQuestions: questions.length,
          quizId: data.quizId
        });

        return {
          event: 'success',
          data: { message: 'New questions generated and sent' }
        };
      }
    } catch (error) {
      this.logger.error('Error getting online questions:', error);

      return {
        event: 'error',
        data: { message: 'Failed to load online questions' }
      };
    }
  }

  // NEW: Create synchronized quiz session
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('createSynchronizedQuiz')
  async handleCreateSynchronizedQuiz(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; questionCount: number },
  ) {
    try {
      this.logger.log(`🎯 Creating synchronized quiz: ${data.quizId} with ${data.questionCount} questions`);

      // Generate deterministic questions for this quiz session
      const questions = await this.getDeterministicQuestions(data.quizId, data.questionCount);

      const session: SynchronizedQuizSession = {
        id: data.quizId,
        questions,
        currentQuestionIndex: -1,
        participants: new Map(),
        createdAt: new Date(),
        isActive: false,
        timer: null,
        startTime: null,
      };

      session.participants.set(client.user.userId, {
        userId: client.user.userId,
        username: client.user.username,
        socketId: client.id,
        score: 0,
        isEliminated: false
      });

      this.synchronizedSessions.set(data.quizId, session);

      client.join(data.quizId);

      this.logger.log(`✅ Created synchronized quiz ${data.quizId} with ${questions.length} questions`);
      this.logger.log(`📋 Questions for quiz ${data.quizId}:`, questions.map(q => ({
        id: q.id,
        question: q.question.substring(0, 50) + '...',
        optionsCount: q.options.length
      })));

      return {
        event: 'synchronizedQuizCreated',
        data: {
          quizId: data.quizId,
          totalQuestions: questions.length,
          totalParticipants: 1
        }
      };
    } catch (error) {
      this.logger.error('Error creating synchronized quiz:', error);
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

      // Ensure questions exist for this session
      if (!session.questions || session.questions.length === 0) {
        return {
          event: 'error',
          data: { message: 'No questions available for this quiz session' }
        };
      }

      session.participants.set(client.user.userId, {
        userId: client.user.userId,
        username: client.user.username,
        socketId: client.id,
        score: 0,
        isEliminated: false
      });

      client.join(data.quizId);

      this.logger.log(`✅ ${client.user.username} joined synchronized quiz ${data.quizId}`);
      this.logger.log(`📋 ${client.user.username} will receive ${session.questions.length} questions:`, session.questions.map(q => ({
        id: q.id,
        question: q.question.substring(0, 30) + '...'
      })));

      const responseData: any = {
        quizId: data.quizId,
        questions: session.questions, // Send the exact same questions
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: session.questions.length,
        totalParticipants: session.participants.size,
        isActive: session.isActive
      };

      if (session.isActive && session.currentQuestionIndex >= 0) {
        responseData.currentQuestion = session.questions[session.currentQuestionIndex];
        if (session.startTime) {
          responseData.timeRemaining = this.calculateTimeRemaining(session.startTime);
        }
      }

      client.emit('synchronizedQuizJoined', responseData);

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

  // NEW: Start synchronized quiz
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
      
      session.currentQuestionIndex = 0;
      session.isActive = true;
      session.startTime = new Date();
      
      const firstQuestion = session.questions[0];
      
      this.logger.log(`🎬 Starting synchronized quiz ${data.quizId} with ${session.participants.size} participants`);
      
      this.server.to(data.quizId).emit('synchronizedQuestion', {
        question: firstQuestion,
        questionIndex: 0,
        totalQuestions: session.questions.length,
        startTime: session.startTime.toISOString(),
        timeLimit: 15
      });
      
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
        this.server.to(data.quizId).emit('synchronizedQuizFinished', {
          quizId: data.quizId,
          totalQuestions: session.questions.length
        });
        
        this.determineWinner(data.quizId);
        return;
      }
      
      session.currentQuestionIndex = nextIndex;
      session.startTime = new Date();
      const nextQuestion = session.questions[nextIndex];
      
      this.logger.log(`➡️ Moving to question ${nextIndex + 1} in quiz ${data.quizId}`);
      
      this.server.to(data.quizId).emit('synchronizedQuestion', {
        question: nextQuestion,
        questionIndex: nextIndex,
        totalQuestions: session.questions.length,
        startTime: session.startTime.toISOString(),
        timeLimit: 15
      });
      
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

    if (session.timer) {
      clearInterval(session.timer);
    }

    const timeLimit = 15;
    let timeRemaining = timeLimit;
    
    session.timer = setInterval(() => {
      timeRemaining--;
      
      this.server.to(quizId).emit('synchronizedTimeUpdate', {
        questionIndex,
        timeRemaining,
        timeLimit
      });
      
      if (timeRemaining <= 0) {
        clearInterval(session.timer!);
        session.timer = null;
        
        if (questionIndex < session.questions.length - 1) {
          setTimeout(() => {
            this.handleNextSynchronizedQuestion(
              { emit: (event, data) => this.server.to(quizId).emit(event, data) } as any,
              { quizId }
            );
          }, 2000);
        } else {
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
      
      this.logger.log(`📝 ${client.user.username} answered question ${data.questionIndex + 1}: ${isCorrect ? 'CORRECT' : 'WRONG'}`);
      
      if (isCorrect) {
        participant.score += 10;
      } else {
        participant.isEliminated = true;
      }
      
      client.to(data.quizId).emit('playerAnsweredSynchronized', {
        userId: client.user.userId,
        username: client.user.username,
        questionIndex: data.questionIndex,
        isCorrect,
        isEliminated: !isCorrect
      });

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
        winner: null,
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
        this.logger.log(`Removed user ${userId} from synchronized quiz ${quizId}`);
        
        if (session.participants.size === 0) {
          if (session.timer) {
            clearInterval(session.timer);
          }
          this.synchronizedSessions.delete(quizId);
          this.logger.log(`Cleaned up empty synchronized quiz: ${quizId}`);
        }
      }
    }
  }

  // Helper methods for deterministic question selection
  private async getDeterministicQuestions(quizId: string, count: number): Promise<any[]> {
    const allQuestions = await this.quizService.getAllQuestions();

    if (!allQuestions || allQuestions.length === 0) {
      throw new Error('No questions available');
    }

    // Transform questions to match frontend expectations
    const transformedQuestions = allQuestions.map((q) => ({
      _id: (q as any)._id.toString(),
      id: (q as any)._id.toString(),
      question: q.question,
      options: q.options.map((opt, optIndex) => ({
        id: optIndex.toString(),
        text: opt.text,
        isCorrect: opt.isCorrect
      })),
      category: 'General',
      difficulty: 'Medium'
    }));

    const seed = this.generateSeedFromString(quizId);
    const shuffledQuestions = this.deterministicShuffle([...transformedQuestions], seed);

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
    const SESSION_TIMEOUT = 60 * 60 * 1000;
    
    for (const [quizId, session] of this.synchronizedSessions.entries()) {
      if (now.getTime() - session.createdAt.getTime() > SESSION_TIMEOUT) {
        this.logger.log(`🧹 Cleaning up old synchronized quiz session: ${quizId}`);
        if (session.timer) {
          clearInterval(session.timer);
        }
        this.synchronizedSessions.delete(quizId);
      }
    }
  }

  // Initialize cleanup interval
  onModuleInit() {
    setInterval(() => this.cleanupOldSessions(), 30 * 60 * 1000);
  }

  // Debug connection endpoint
  @SubscribeMessage('debug_connection')
  async handleDebugConnection(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    this.logger.log(`🔧 Debug connection request from ${client.user?.username}`);
    
    return {
      event: 'debug_connection_result',
      data: {
        socketId: client.id,
        userId: client.user?.userId,
        username: client.user?.username,
        connected: true,
        timestamp: new Date().toISOString(),
        totalSessions: this.synchronizedSessions.size
      }
    };
  }

  // Debug questions flow endpoint
  @SubscribeMessage('debug_questions_flow')
  async handleDebugQuestionsFlow(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { count: number },
  ) {
    try {
      this.logger.log(`🔧 Debug questions flow request from ${client.user?.username}`);

      const testQuestions = await this.quizService.getRandomQuestions(data.count || 3);

      return {
        event: 'debug_questions_flow_result',
        data: {
          requestedCount: data.count || 3,
          returnedCount: testQuestions.length,
          questions: testQuestions,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        event: 'debug_questions_flow_result',
        data: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // NEW: Debug quiz session questions endpoint
  @SubscribeMessage('debug_quiz_session')
  async handleDebugQuizSession(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string },
  ) {
    try {
      this.logger.log(`🔧 Debug quiz session request for ${data.quizId} from ${client.user?.username}`);

      const session = this.synchronizedSessions.get(data.quizId);

      if (!session) {
        return {
          event: 'debug_quiz_session_result',
          data: {
            error: 'Quiz session not found',
            quizId: data.quizId,
            timestamp: new Date().toISOString()
          }
        };
      }

      return {
        event: 'debug_quiz_session_result',
        data: {
          quizId: data.quizId,
          totalQuestions: session.questions.length,
          currentQuestionIndex: session.currentQuestionIndex,
          isActive: session.isActive,
          totalParticipants: session.participants.size,
          questions: session.questions.map(q => ({
            id: q.id,
            question: q.question,
            optionsCount: q.options.length,
            hasCorrectAnswer: q.options.some(opt => opt.isCorrect)
          })),
          participants: Array.from(session.participants.values()).map(p => ({
            userId: p.userId,
            username: p.username,
            score: p.score,
            isEliminated: p.isEliminated
          })),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        event: 'debug_quiz_session_result',
        data: {
          error: error.message,
          quizId: data.quizId,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // Keep other existing methods for backward compatibility
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('readyForNextQuestion')
  async handleReadyForNextQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; userId: string; questionIndex: number },
  ) {
    try {
      this.logger.log(`✅ Player ${data.userId} ready for question ${data.questionIndex}`);
      
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