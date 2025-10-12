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
  /**
   * Handles new client connections, performs authentication, and sets up user state.
   * @param client The connecting socket.
   */
  async handleConnection(client: AuthenticatedSocket) {
    const { address: clientIp } = client.handshake;
    const { id: socketId } = client;
    this.logger.log(`[Connection] New connection attempt from IP: ${clientIp}, Socket ID: ${socketId}`);

    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        this.logger.warn(`[Auth] No token provided for socket ${socketId}. Disconnecting.`);
        client.emit('authentication_error', { message: 'Authentication token is required.' });
        return client.disconnect();
      }

      // Basic rate limiting for connection attempts
      const attempts = (this.connectionAttempts.get(clientIp) || 0) + 1;
      this.connectionAttempts.set(clientIp, attempts);
      if (attempts > 5) {
        this.logger.warn(`[Auth] Too many connection attempts from ${clientIp}. Disconnecting.`);
        client.emit('authentication_error', { message: 'Too many connection attempts. Please wait.' });
        return client.disconnect();
      }

      // Verify JWT
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET') || '123456',
      });
      this.connectionAttempts.delete(clientIp); // Clear attempts on success

      // Attach user info to the socket
      client.user = {
        userId: payload.sub,
        username: payload.username || payload.phoneNumber,
      };

      this.logger.log(`[Auth] Client authenticated successfully: ${client.user.username} (ID: ${client.user.userId})`);
      client.join(`user_${client.user.userId}`);
      this.addOnlineUser(client);
      client.emit('authentication_success', { message: 'Successfully connected.', user: client.user });

    } catch (error) {
      this.logger.error(`[Auth] Authentication failed for socket ${socketId}: ${error.message}`);
      if (error.name === 'TokenExpiredError') {
        client.emit('token_expired', { message: 'Your session has expired. Please log in again.' });
      } else {
        client.emit('authentication_error', { message: 'Authentication failed. Invalid or expired token.' });
      }
      client.disconnect();
    }
  }

  /**
   * Handles client disconnections and cleans up their state.
   * @param client The disconnecting socket.
   */
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.logger.log(`[Disconnection] Client disconnected: ${client.user.username} (ID: ${client.user.userId})`);
      this.removeOnlineUser(client);
      this.removeParticipantFromAllSynchronizedSessions(client.user.userId);
    } else {
      this.logger.log(`[Disconnection] Unauthenticated client disconnected: ${client.id}`);
    }
    // Clear connection attempts for the IP address
    this.connectionAttempts.delete(client.handshake.address);
  }

  // NEW: Handle solo questions request
  // In QuizGateway class

// OLD (remove @UseGuards):
// @UseGuards(JwtAuthGuard)
// @SubscribeMessage('getSoloQuestions')
// NEW: No guard, manual check inside
  /**
   * Handles requests for solo quiz questions.
   * @param client The authenticated socket.
   * @param data The request payload, expecting a 'count' property.
   */
  @SubscribeMessage('getSoloQuestions')
  async handleGetSoloQuestions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { count: number },
  ) {
    if (!client.user) {
      this.logger.warn(`[Security] Unauthorized attempt to get solo questions from unauthenticated client ${client.id}.`);
      return client.emit('soloQuestionsError', { message: 'Authentication required.' });
    }

    try {
      const count = data.count || 10;
      this.logger.log(`[Solo Quiz] User ${client.user.username} requested ${count} solo questions.`);
      const questions = await this.quizService.getRandomQuestions(count);

      client.emit('soloQuestionsLoaded', {
        questions: this.formatQuestions(questions),
        totalQuestions: questions.length,
        mode: 'solo',
      });
    } catch (error) {
      this.logger.error(`[Solo Quiz] Error fetching questions for ${client.user.username}: ${error.message}`);
      client.emit('soloQuestionsError', { message: 'Failed to load questions. Please try again later.' });
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
  /**
   * Handles requests for online multiplayer quiz questions.
   * If a session for the quiz ID already exists, it returns the existing questions.
   * Otherwise, it generates a new deterministic set of questions.
   * @param client The authenticated socket.
   * @param data The request payload, expecting 'quizId' and 'count'.
   */
  @SubscribeMessage('requestQuestions')
  async handleRequestQuestions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; count: number },
  ) {
    if (!client.user) {
      this.logger.warn(`[Security] Unauthorized attempt to request online questions from unauthenticated client ${client.id}.`);
      return client.emit('questionsError', { message: 'Authentication required.' });
    }

    try {
      const { quizId, count = 10 } = data;
      this.logger.log(`[Online Quiz] User ${client.user.username} requested ${count} questions for quiz ${quizId}.`);

      const session = this.synchronizedSessions.get(quizId);
      const questions = (session?.questions?.length > 0)
        ? session.questions // Use existing questions if available
        : await this.getDeterministicQuestions(quizId, count); // Otherwise, generate new ones

      client.emit('questionsLoaded', {
        questions,
        totalQuestions: questions.length,
        quizId,
        mode: 'online',
      });
    } catch (error) {
      this.logger.error(`[Online Quiz] Error fetching questions for ${client.user.username} on quiz ${data.quizId}: ${error.message}`);
      client.emit('questionsError', { message: 'Failed to load questions for the online quiz.' });
    }
  }

  // NEW: Create synchronized quiz session
  /**
   * Creates a new synchronized multiplayer quiz session.
   * @param client The authenticated socket of the user creating the quiz.
   * @param data The payload containing the quizId and the number of questions.
   */
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('createSynchronizedQuiz')
  async handleCreateSynchronizedQuiz(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string; questionCount: number },
  ) {
    try {
      this.logger.log(`[Sync Quiz] User ${client.user.username} is creating quiz ${data.quizId} with ${data.questionCount} questions.`);
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
        score: 0,
        isEliminated: false,
      });

      this.synchronizedSessions.set(data.quizId, session);
      client.join(data.quizId);

      this.logger.log(`[Sync Quiz] Successfully created quiz ${data.quizId} with ${questions.length} questions.`);
      client.emit('synchronizedQuizCreated', {
        quizId: data.quizId,
        totalQuestions: questions.length,
        totalParticipants: 1,
      });
    } catch (error) {
      this.logger.error(`[Sync Quiz] Error creating synchronized quiz for user ${client.user.username}: ${error.message}`);
      client.emit('error', { message: 'Failed to create the quiz. Please try again.' });
    }
  }
  // NEW: Join synchronized quiz
  /**
   * Joins a player to a synchronized multiplayer quiz.
   * @param client The player's authenticated socket.
   * @param data The payload containing the quizId to join.
   */
  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('joinSynchronizedQuiz')
  async handleJoinSynchronizedQuiz(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { quizId: string },
  ) {
    const session = this.synchronizedSessions.get(data.quizId);
    if (!session) {
      this.logger.warn(`[Sync Quiz] User ${client.user.username} attempted to join non-existent quiz ${data.quizId}.`);
      return client.emit('error', { message: 'The quiz session you are trying to join does not exist.' });
    }

    if (session.participants.has(client.user.userId)) {
      this.logger.warn(`[Sync Quiz] User ${client.user.username} attempted to join quiz ${data.quizId} again.`);
      return client.emit('error', { message: 'You have already joined this quiz.' });
    }

    try {
      this.logger.log(`[Sync Quiz] User ${client.user.username} is joining quiz ${data.quizId}.`);
      session.participants.set(client.user.userId, {
        userId: client.user.userId,
        username: client.user.username,
        score: 0,
        isEliminated: false,
      });

      client.join(data.quizId);

      // Notify other players in the room
      client.to(data.quizId).emit('playerJoined', {
        userId: client.user.userId,
        username: client.user.username,
        totalParticipants: session.participants.size,
      });

      // Send the full session details to the joining player
      client.emit('synchronizedQuizJoined', {
        quizId: data.quizId,
        questions: session.questions,
        participants: Array.from(session.participants.values()),
        currentQuestionIndex: session.currentQuestionIndex,
        isActive: session.isActive,
      });
    } catch (error) {
      this.logger.error(`[Sync Quiz] Error when user ${client.user.username} tried to join quiz ${data.quizId}: ${error.message}`);
      client.emit('error', { message: 'An error occurred while trying to join the quiz.' });
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

  /**
   * Formats questions into a consistent structure for the client.
   * @param questions The raw question objects from the database.
   * @returns A list of formatted questions.
   */
  private formatQuestions(questions: any[]): any[] {
    return questions.map((q: any) => ({
      id: q._id?.toString() || q.id?.toString(),
      question: q.question,
      options: (q.options || []).map((opt: any, index: number) => ({
        id: index.toString(),
        text: opt.text,
        isCorrect: opt.isCorrect === true,
      })),
      category: q.category || 'General',
      difficulty: q.difficulty || 'Medium',
    }));
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