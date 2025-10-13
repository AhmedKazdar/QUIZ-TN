// websocket/quiz.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QuizService } from '../quiz/quiz.service';

interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
}

interface QuizSession {
  quizId: string;
  hostId: string;
  players: Map<string, OnlineUser>;
  questions: any[];
  currentQuestionIndex: number;
  started: boolean;
  finished: boolean;
  seed?: string;
}

@WebSocketGateway({
   namespace: '/quiz',
})
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuizGateway.name);
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private quizSessions: Map<string, QuizSession> = new Map();

  constructor(private readonly quizService: QuizService) {}

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connected: ${client.id}`);

      // Authenticate connection
      const token = client.handshake.auth.token || client.handshake.query.token;
      
      if (!token) {
        this.logger.warn(`No token provided for client: ${client.id}`);
        client.emit('authentication_required', { message: 'Authentication required' });
        return;
      }

      // Here you would validate the JWT token and extract user info
      const user = await this.authenticateUser(token);
      
      if (!user) {
        this.logger.error(`Authentication failed for client: ${client.id}`);
        client.emit('authentication_error', { message: 'Authentication failed' });
        client.disconnect();
        return;
      }

      // Store user info
      const onlineUser: OnlineUser = {
        userId: user.userId,
        username: user.username,
        socketId: client.id,
      };

      this.onlineUsers.set(client.id, onlineUser);
      
      // Notify client of successful authentication
      client.emit('authentication_success', {
        message: 'Authenticated successfully',
        user: { userId: user.userId, username: user.username }
      });

      // Broadcast updated online users list
      this.broadcastOnlineUsers();

      this.logger.log(`User ${user.username} connected with socket ID: ${client.id}`);

    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.emit('authentication_error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    const user = this.onlineUsers.get(client.id);
    if (user) {
      this.onlineUsers.delete(client.id);
      this.broadcastOnlineUsers();
      this.logger.log(`User ${user.username} disconnected`);
    }

    // Clean up any quiz sessions hosted by this user
    this.cleanupUserSessions(client.id);
  }

  // ========== QUIZ QUESTIONS HANDLERS ==========

  @SubscribeMessage('getSoloQuestions')
  async handleGetSoloQuestions(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { count: number; mode?: string }
  ) {
    try {
      this.logger.log(`Getting solo questions for client: ${client.id}, count: ${data.count}`);

      const user = this.onlineUsers.get(client.id);
      if (!user) {
        client.emit('soloQuestionsError', { message: 'User not authenticated' });
        return;
      }

      // Get random questions from database
      const questions = await this.quizService.getRandomQuestions(data.count || 10);
      
      this.logger.log(`Retrieved ${questions.length} questions from database`);

      if (questions.length === 0) {
        client.emit('soloQuestionsError', { 
          message: 'No questions available in database' 
        });
        return;
      }

      // Transform questions to match frontend format with generated option IDs
      const transformedQuestions = questions.map((q, index) => ({
        _id: q._id.toString(),
        id: q._id.toString(),
        question: q.question,
        options: Array.isArray(q.options) 
          ? q.options.map((opt, optIndex) => ({
              id: opt._id?.toString() || `opt-${index}-${optIndex}`, // Generate ID if not exists
              text: opt.text,
              isCorrect: opt.isCorrect,
            }))
          : [],
        category: q.category || 'General',
        difficulty: q.difficulty || 'Medium',
      }));

      client.emit('soloQuestionsLoaded', {
        questions: transformedQuestions,
        totalQuestions: transformedQuestions.length,
        mode: data.mode || 'solo',
        timestamp: Date.now(),
      });

      this.logger.log(`Sent ${transformedQuestions.length} solo questions to client: ${client.id}`);

    } catch (error) {
      this.logger.error('Error getting solo questions:', error);
      client.emit('soloQuestionsError', { 
        message: 'Failed to load questions',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('requestQuestions')
  async handleRequestQuestions(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string; count: number; mode?: string }
  ) {
    try {
      this.logger.log(`Requesting questions for online quiz: ${data.quizId}, count: ${data.count}`);

      const user = this.onlineUsers.get(client.id);
      if (!user) {
        client.emit('questionsError', { message: 'User not authenticated' });
        return;
      }

      const questions = await this.quizService.getRandomQuestions(data.count || 10);
      
      const transformedQuestions = questions.map((q, index) => ({
        _id: q._id.toString(),
        id: q._id.toString(),
        question: q.question,
        options: Array.isArray(q.options) 
          ? q.options.map((opt, optIndex) => ({
              id: opt._id?.toString() || `opt-${index}-${optIndex}`, // Generate ID if not exists
              text: opt.text,
              isCorrect: opt.isCorrect,
            }))
          : [],
        category: q.category || 'General',
        difficulty: q.difficulty || 'Medium',
      }));

      client.emit('questionsLoaded', {
        questions: transformedQuestions,
        totalQuestions: transformedQuestions.length,
        mode: data.mode || 'online',
        quizId: data.quizId,
        timestamp: Date.now(),
      });

      this.logger.log(`Sent ${transformedQuestions.length} online questions for quiz: ${data.quizId}`);

    } catch (error) {
      this.logger.error('Error requesting questions:', error);
      client.emit('questionsError', { 
        message: 'Failed to load questions',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('submitAnswer')
  async handleSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      questionId: string; 
      answerIndex: number; // This is the index of the selected option
      timeSpent: number;
      mode: 'solo' | 'online';
      quizId?: string;
      questionIndex?: number;
    }
  ) {
    try {
      const user = this.onlineUsers.get(client.id);
      if (!user) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      // Get the question to check answer
      const question = await this.quizService.findById(data.questionId);
      
      // Find the selected option by index
      const selectedOption = question.options[data.answerIndex];
      const isCorrect = selectedOption?.isCorrect || false;

      // For the DTO, we need to convert index to a string ID
      // Since your DTO expects selectedOptionId as string, we'll generate one
      const selectedOptionId = `opt-${data.answerIndex}`;

      // Update question statistics using the DTO format
      await this.quizService.submitResponse({
        questionId: data.questionId,
        selectedOptionId: selectedOptionId,
        timeSpent: data.timeSpent,
        isCorrect: isCorrect,
      }, user.userId);

      // Send result back to client
      client.emit('answerResult', {
        questionId: data.questionId,
        isCorrect,
        correctAnswer: question.options.find(opt => opt.isCorrect)?.text, // Send text instead of ID
        timeSpent: data.timeSpent,
      });

      // For online mode, broadcast to other players
      if (data.mode === 'online' && data.quizId) {
        this.server.to(data.quizId).emit('playerAnswered', {
          userId: user.userId,
          username: user.username,
          questionIndex: data.questionIndex,
          isCorrect,
        });
      }

    } catch (error) {
      this.logger.error('Error submitting answer:', error);
      client.emit('error', { 
        message: 'Failed to submit answer',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('submitSynchronizedAnswer')
  async handleSubmitSynchronizedAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string; questionIndex: number; answerIndex: number }
  ) {
    try {
      const user = this.onlineUsers.get(client.id);
      const quizSession = this.quizSessions.get(data.quizId);

      if (!quizSession || !user) {
        client.emit('error', { message: 'Invalid quiz or user' });
        return;
      }

      const currentQuestion = quizSession.questions[data.questionIndex];
      const isCorrect = currentQuestion.options[data.answerIndex]?.isCorrect;

      // Notify all players about the answer
      this.server.to(data.quizId).emit('playerAnsweredSynchronized', {
        player: user,
        questionIndex: data.questionIndex,
        answerIndex: data.answerIndex,
        isCorrect,
      });

      // Notify the answering client
      client.emit('synchronizedAnswerResult', {
        questionIndex: data.questionIndex,
        isCorrect,
        correctAnswer: currentQuestion.options.find(opt => opt.isCorrect)?.text, // Send text
      });

    } catch (error) {
      this.logger.error('Error submitting synchronized answer:', error);
      client.emit('error', { 
        message: 'Failed to submit answer',
        error: error.message 
      });
    }
  }

  // ========== SYNCHRONIZED QUIZ HANDLERS ==========

  @SubscribeMessage('createSynchronizedQuiz')
  async handleCreateSynchronizedQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string; questionCount: number }
  ) {
    try {
      const user = this.onlineUsers.get(client.id);
      if (!user) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      this.logger.log(`Creating synchronized quiz: ${data.quizId} by user: ${user.username}`);

      // Check if quiz already exists
      if (this.quizSessions.has(data.quizId)) {
        client.emit('error', { message: 'Quiz ID already exists' });
        return;
      }

      // Create new quiz session
      const quizSession: QuizSession = {
        quizId: data.quizId,
        hostId: client.id,
        players: new Map(),
        questions: [],
        currentQuestionIndex: -1,
        started: false,
        finished: false,
      };

      this.quizSessions.set(data.quizId, quizSession);

      // Add host as first player
      quizSession.players.set(client.id, user);

      client.emit('synchronizedQuizCreated', {
        quizId: data.quizId,
        host: user,
        message: 'Quiz created successfully',
      });

      this.logger.log(`Synchronized quiz created: ${data.quizId}`);

    } catch (error) {
      this.logger.error('Error creating synchronized quiz:', error);
      client.emit('error', { 
        message: 'Failed to create quiz',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('joinSynchronizedQuiz')
  async handleJoinSynchronizedQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string; userId: string }
  ) {
    try {
      const user = this.onlineUsers.get(client.id);
      if (!user) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      this.logger.log(`User ${user.username} joining synchronized quiz: ${data.quizId}`);

      const quizSession = this.quizSessions.get(data.quizId);
      if (!quizSession) {
        client.emit('error', { message: 'Quiz not found' });
        return;
      }

      if (quizSession.started) {
        client.emit('error', { message: 'Quiz has already started' });
        return;
      }

      // Add player to quiz
      quizSession.players.set(client.id, user);

      // Load questions if this is the first player after host
      if (quizSession.questions.length === 0) {
        const questions = await this.quizService.getRandomQuestions(10);
        quizSession.questions = questions.map((q, index) => ({
          _id: q._id.toString(),
          id: q._id.toString(),
          question: q.question,
          options: Array.isArray(q.options) 
            ? q.options.map((opt, optIndex) => ({
                id: opt._id?.toString() || `opt-${index}-${optIndex}`,
                text: opt.text,
                isCorrect: opt.isCorrect,
              }))
            : [],
          category: q.category || 'General',
          difficulty: q.difficulty || 'Medium',
        }));
      }

      // Notify the joining client
      client.emit('synchronizedQuizJoined', {
        quizId: data.quizId,
        questions: quizSession.questions,
        players: Array.from(quizSession.players.values()),
        host: this.onlineUsers.get(quizSession.hostId),
      });

      // Notify all players about new player
      this.server.to(data.quizId).emit('playerJoined', {
        player: user,
        players: Array.from(quizSession.players.values()),
      });

      // Join the room for this quiz
      client.join(data.quizId);

      this.logger.log(`User ${user.username} joined synchronized quiz: ${data.quizId}`);

    } catch (error) {
      this.logger.error('Error joining synchronized quiz:', error);
      client.emit('error', { 
        message: 'Failed to join quiz',
        error: error.message 
      });
    }
  }

  // ========== UTILITY METHODS ==========

  private async authenticateUser(token: string): Promise<any> {
    try {
      // Here you would verify the JWT token
      // For now, return a mock user
      return {
        userId: 'user-' + Date.now(),
        username: 'user-' + Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      this.logger.error('Authentication error:', error);
      return null;
    }
  }

  private broadcastOnlineUsers() {
    const users = Array.from(this.onlineUsers.values());
    this.server.emit('onlineUsers', users);
  }

  private cleanupUserSessions(socketId: string) {
    for (const [quizId, session] of this.quizSessions.entries()) {
      // Remove player from session
      session.players.delete(socketId);

      // If host disconnected, remove the session
      if (session.hostId === socketId) {
        this.quizSessions.delete(quizId);
        this.server.to(quizId).emit('quizEnded', { 
          message: 'Quiz ended because host disconnected' 
        });
      } else if (session.players.size === 0) {
        // If no players left, remove session
        this.quizSessions.delete(quizId);
      }
    }
  }

  // Other methods remain the same...
  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const users = Array.from(this.onlineUsers.values());
    client.emit('onlineUsers', users);
  }
}