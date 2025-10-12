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
  participants: Map<string, { 
    userId: string; 
    username: string; 
    // Remove socketId: string;
    score: number; 
    isEliminated: boolean;
  }>;
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
private onlineUsers: Map<string, { userId: string; username: string }> = new Map();
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

  private addOnlineUser(client: AuthenticatedSocket): void {
    if (!client.user) return;
    
    this.onlineUsers.set(client.user.userId, {
      userId: client.user.userId,
      username: client.user.username
    });
    
    this.logger.log(`➕ User ${client.user.username} added to online users`);
    this.broadcastOnlineUsers();
    this.broadcastUserConnected(client.user);
  }



  private removeOnlineUser(client: AuthenticatedSocket): void {
    if (!client.user) return;
    
    const user = this.onlineUsers.get(client.user.userId);
    this.onlineUsers.delete(client.user.userId);
    
    this.logger.log(`➖ User ${client.user.username} removed from online users`);
    this.broadcastOnlineUsers();
    
    if (user) {
      this.broadcastUserDisconnected(user);
    }
  }
  
  /**
   * Broadcasts the current list of online users to all connected clients.
   */
  private broadcastOnlineUsers(): void {
    const users = Array.from(this.onlineUsers.values());
    this.logger.log(`👥 Broadcasting ${users.length} online users`);
    this.server.emit('onlineUsers', users);
  }
  
  /**
   * Broadcasts when a user connects to the quiz system.
   */
  private broadcastUserConnected(user: { userId: string; username: string }): void {
    this.server.emit('userConnected', {
      userId: user.userId,
      username: user.username,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Broadcasts when a user disconnects from the quiz system.
   */
  private broadcastUserDisconnected(user: { userId: string; username: string }): void {
    this.server.emit('userDisconnected', {
      userId: user.userId,
      username: user.username,
      timestamp: new Date().toISOString()
    });
  }
  

  @SubscribeMessage('getOnlineUsers')
async handleGetOnlineUsers(@ConnectedSocket() client: AuthenticatedSocket) {
  try {
    const users = Array.from(this.onlineUsers.values());
    this.logger.log(`📤 Sending ${users.length} online users to ${client.user?.username}`);
    
    // Send the list to the requesting client only
    client.emit('onlineUsers', users);
    
    return {
      event: 'onlineUsers',
      data: users
    };
  } catch (error) {
    this.logger.error('Error getting online users:', error);
    return {
      event: 'error',
      data: { message: 'Failed to get online users' }
    };
  }
}
  async handleConnection(client: AuthenticatedSocket) {
    const clientIp = client.handshake.address;
    const socketId = client.id;
    
    this.logger.log(`🔌 New quiz connection attempt: ${socketId} from ${clientIp}`);
    
    try {
      // Read token ONLY from auth header, not from query parameters
      const token = client.handshake.auth?.token;
      
      this.logger.log(`🔍 Token search results for ${socketId}:`, {
        auth: !!client.handshake.auth?.token,
        // Remove query parameter logging
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
        
        // Add user to online users
        this.addOnlineUser(client);
        
        client.emit('authentication_success', { 
          message: 'Successfully connected to quiz gateway',
          user: client.user
        });
  
        // Remove socketId from debug info sent to client
        client.emit('connection_debug', {
          // Remove socketId: client.id,
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
  // In QuizGateway class

// OLD (remove @UseGuards):
// @UseGuards(JwtAuthGuard)
// @SubscribeMessage('getSoloQuestions')
// NEW: No guard, manual check inside
@SubscribeMessage('getSoloQuestions')
async handleGetSoloQuestions(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { count: number; mode: string },
) {
  // MANUAL AUTH CHECK: Since connection already auths, verify user here
  if (!client.user) {
    this.logger.warn(`❌ [SOLO] Unauthorized access to solo questions from ${client.id}`);
    client.emit('soloQuestionsError', {
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString()
    });
    return { event: 'error', data: { message: 'Unauthorized' } };
  }

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

    // CRITICAL FIX: Handle both QuizQuestion interface and actual MongoDB documents
    const formattedQuestions = questions.map((q: any) => {
      // Handle both _id (MongoDB) and id (interface)
      const questionId = q._id?.toString() || q.id?.toString() || Math.random().toString();
      
      return {
        _id: questionId,
        id: questionId,
        question: q.question,
        options: (q.options || []).map((opt: any, index: number) => ({
          id: index.toString(),
          text: opt.text,
          isCorrect: opt.isCorrect === true
        })),
        category: q.category || 'General',
        difficulty: q.difficulty || 'Medium'
      };
    });

    this.logger.log(`📋 [SOLO] First formatted question:`, {
      id: formattedQuestions[0]?.id,
      question: formattedQuestions[0]?.question?.substring(0, 50) + '...',
      optionsCount: formattedQuestions[0]?.options?.length,
      hasCorrectAnswer: formattedQuestions[0]?.options?.some(opt => opt.isCorrect)
    });
    
    // Send back to the requesting client only - USE CORRECT EVENT NAME
    client.emit('soloQuestionsLoaded', {
      questions: formattedQuestions,
      totalQuestions: formattedQuestions.length,
      mode: data.mode || 'solo',
      timestamp: new Date().toISOString()
    });
    
    this.logger.log(`📤 [SOLO] Emitted soloQuestionsLoaded event to client`);
    
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

/* 
  @SubscribeMessage('requestQuestions')
async handleRequestQuestionsDebug(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: any,
) {
  this.logger.log(`🎯 [DEBUG] requestQuestions event RECEIVED from ${client.user?.username}`);
  this.logger.log(`📦 [DEBUG] Request data:`, data);
  
  // Call the actual handler
  return this.handleRequestQuestions(client, data);
} */
  

  // NEW: Handle online questions request
  //@UseGuards(JwtAuthGuard)
  @SubscribeMessage('requestQuestions')
  async handleRequestQuestions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; count: number; mode?: string; timestamp?: number },
  ) {
    try {
      this.logger.log(`🎯 [REQUEST QUESTIONS] Received request from ${client.user.username}`);
      this.logger.log(`📦 [REQUEST QUESTIONS] Request data:`, data);
      
      if (!data?.count) {
        this.logger.warn(`⚠️ [REQUEST QUESTIONS] No count provided, using default 10`);
        data.count = 10;
      }
  
      // Check if it's a solo quiz (quizId starts with 'solo-quiz-' or mode is 'solo')
      const isSoloQuiz = data.quizId?.startsWith('solo-quiz-') || data.mode === 'solo';
      
      this.logger.log(`🔍 [REQUEST QUESTIONS] Mode detection:`, {
        quizId: data.quizId,
        mode: data.mode,
        isSoloQuiz: isSoloQuiz
      });
  
      // Check if there's an existing session for this quiz
      let session = this.synchronizedSessions.get(data.quizId);
      this.logger.log(`📊 [REQUEST QUESTIONS] Session found for ${data.quizId}:`, !!session);
  
      if (session && session.questions.length > 0) {
        // Use existing session questions (ensures consistency)
        this.logger.log(`✅ [REQUEST QUESTIONS] Using existing session with ${session.questions.length} questions`);
        
        // EMIT CORRECT EVENT BASED ON MODE
        const eventName = isSoloQuiz ? 'soloQuestionsLoaded' : 'questionsLoaded';
        client.emit(eventName, {
          questions: session.questions,
          totalQuestions: session.questions.length,
          quizId: data.quizId,
          source: 'existing_session',
          mode: isSoloQuiz ? 'solo' : 'online'
        });
  
        return {
          event: 'success',
          data: { message: 'Questions loaded from existing session' }
        };
      } else {
        // Generate new deterministic questions for this quiz session
        this.logger.log(`🔄 [REQUEST QUESTIONS] No existing session, generating new questions`);
        
        try {
          const questions = await this.getDeterministicQuestions(data.quizId, data.count);
          this.logger.log(`✅ [REQUEST QUESTIONS] Generated ${questions.length} questions from database`);
  
          // Log first question for verification
          if (questions.length > 0) {
            this.logger.log(`📋 [REQUEST QUESTIONS] First question:`, {
              id: questions[0].id,
              question: questions[0].question.substring(0, 50) + '...',
              options: questions[0].options.map(opt => ({
                text: opt.text.substring(0, 20) + '...',
                isCorrect: opt.isCorrect
              }))
            });
          }
  
          // EMIT CORRECT EVENT BASED ON MODE
          const eventName = isSoloQuiz ? 'soloQuestionsLoaded' : 'questionsLoaded';
          this.logger.log(`📤 [REQUEST QUESTIONS] Emitting event: ${eventName} for ${isSoloQuiz ? 'SOLO' : 'ONLINE'} mode`);
          
          client.emit(eventName, {
            questions,
            totalQuestions: questions.length,
            quizId: data.quizId,
            source: 'new_generation',
            mode: isSoloQuiz ? 'solo' : 'online'
          });
  
          this.logger.log(`✅ [REQUEST QUESTIONS] Successfully sent ${questions.length} questions to client`);
  
          return {
            event: 'success',
            data: { message: 'New questions generated and sent' }
          };
        } catch (dbError) {
          this.logger.error(`❌ [REQUEST QUESTIONS] Database error:`, dbError);
          
          // Send error to client with correct event name
          const errorEventName = isSoloQuiz ? 'soloQuestionsError' : 'questionsError';
          client.emit(errorEventName, {
            message: 'Failed to load questions from database',
            error: dbError.message,
            quizId: data.quizId
          });
  
          return {
            event: 'error',
            data: { message: 'Failed to load questions from database' }
          };
        }
      }
    } catch (error) {
      this.logger.error('❌ [REQUEST QUESTIONS] Unexpected error:', error);
  
      // Send error to client with correct event name
      const isSoloQuiz = data.quizId?.startsWith('solo-quiz-') || data.mode === 'solo';
      const errorEventName = isSoloQuiz ? 'soloQuestionsError' : 'questionsError';
      
      client.emit(errorEventName, {
        message: 'Unexpected error loading questions',
        error: error.message,
        quizId: data.quizId
      });
  
      return {
        event: 'error',
        data: { message: 'Failed to load questions' }
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
        // Remove socketId: client.id,
        score: 0,
        isEliminated: false
      });
  
      this.synchronizedSessions.set(data.quizId, session);
      client.join(data.quizId);
  
      this.logger.log(`✅ Created synchronized quiz ${data.quizId} with ${questions.length} questions`);
  
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
        // Remove socketId: client.id,
        score: 0,
        isEliminated: false
      });
  
      client.join(data.quizId);
  
      this.logger.log(`✅ ${client.user.username} joined synchronized quiz ${data.quizId}`);
  
      const responseData: any = {
        quizId: data.quizId,
        questions: session.questions,
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
    try {
      this.logger.log(`🔍 [DETERMINISTIC QUESTIONS] Starting for quiz ${quizId}, count: ${count}`);
      
      const allQuestions = await this.quizService.getAllQuestions();
      this.logger.log(`📊 [DETERMINISTIC QUESTIONS] Got ${allQuestions.length} questions from database`);
  
      if (!allQuestions || allQuestions.length === 0) {
        this.logger.error('❌ [DETERMINISTIC QUESTIONS] No questions available from database');
        throw new Error('No questions available');
      }
  
      // Log first question from database
      if (allQuestions.length > 0) {
        this.logger.log(`📋 [DETERMINISTIC QUESTIONS] First DB question:`, {
          id: allQuestions[0].id,
          question: allQuestions[0].question?.substring(0, 50) + '...',
          hasOptions: !!allQuestions[0].options,
          optionsCount: allQuestions[0].options?.length
        });
      }
  
      // Transform questions to match frontend expectations
      const transformedQuestions = allQuestions.map((q) => ({
        _id: q.id.toString(),
        id: q.id.toString(),
        question: q.question,
        options: q.options.map((opt, optIndex) => ({
          id: optIndex.toString(),
          text: opt.text,
          isCorrect: opt.isCorrect
        })),
        category: 'General',
        difficulty: 'Medium'
      }));
  
      this.logger.log(`✅ [DETERMINISTIC QUESTIONS] Transformed ${transformedQuestions.length} questions`);
  
      const seed = this.generateSeedFromString(quizId);
      const shuffledQuestions = this.deterministicShuffle([...transformedQuestions], seed);
  
      const result = shuffledQuestions.slice(0, count);
      this.logger.log(`🎯 [DETERMINISTIC QUESTIONS] Returning ${result.length} questions`);
  
      return result;
    } catch (error) {
      this.logger.error('❌ [DETERMINISTIC QUESTIONS] Error:', error);
      throw error;
    }
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
            // Remove socketId: p.socketId,
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