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

interface AuthenticatedUser {
  userId: string;
  username: string;
}

interface SoloQuizSession {
  userId: string;
  questions: any[];
  startTime: number;
}


interface SequentialQuizSession {
  quizId: string;
  players: Map<string, OnlineUser>;
  questions: any[];
  originalQuestions: any[];
  currentQuestionIndex: number;
  started: boolean;
  finished: boolean;
  currentQuestionStartTime: number;
  questionTimer?: NodeJS.Timeout;
  answeredPlayers: Set<string>;
  autoAdvanceTimer?: NodeJS.Timeout;
}

@WebSocketGateway({
  namespace: '/quiz',
})
export class QuizGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QuizGateway.name);
  private onlineUsers: Map<string, OnlineUser> = new Map();
  private sequentialQuizSessions: Map<string, SequentialQuizSession> = new Map();
  private fastestAnswerWinners: Map<string, { userId: string; username: string; timeSpent: number }> = new Map();
  private soloQuizSessions: Map<string, SoloQuizSession> = new Map();

  constructor(private readonly quizService: QuizService) {}

async handleConnection(client: Socket) {
  try {
    this.logger.log(`Client connected: ${client.id}`);
    console.log(`🔗 New connection: ${client.id}, total sockets: ${this.server.sockets.sockets?.size || 0}`);
    
    // Debug: Log the entire handshake to see what's being sent
    console.log('🔍 [BACKEND] Handshake auth:', client.handshake.auth);

    const token = client.handshake.auth.token;
    const userDataString = client.handshake.auth.user;
    
    // Use proper typing with union type
    let user: AuthenticatedUser | null = null;

    // Try JWT token first
    if (token) {
      user = await this.authenticateUser(token);
    }
    
    // If JWT fails, try the user data from handshake
    if (!user && userDataString) {
      try {
        const userData = JSON.parse(userDataString);
        if (userData.username) {
          console.log('✅ [BACKEND] Using user data from handshake:', userData.username);
          user = {
            userId: userData.userId || `user-${Date.now()}`,
            username: userData.username,
          };
        }
      } catch (parseError) {
        console.error('❌ [BACKEND] Failed to parse user data from handshake:', parseError);
      }
    }
    
    if (!user) {
      this.logger.error(`Authentication failed for client: ${client.id}`);
      client.emit('authentication_error', { message: 'Authentication failed' });
      client.disconnect();
      return;
    }

    const onlineUser: OnlineUser = {
      userId: user.userId,
      username: user.username,
      socketId: client.id,
    };

    this.onlineUsers.set(client.id, onlineUser);
    
    // Handle reconnection for existing sessions
    this.handleUserReconnection(client.id, user.userId);
    
    client.emit('authentication_success', {
      message: 'Authenticated successfully',
      user: { userId: user.userId, username: user.username }
    });

    this.broadcastOnlineUsers();
    this.logger.log(`User ${user.username} connected with socket ID: ${client.id}`);

  } catch (error) {
    this.logger.error(`Connection error for client ${client.id}:`, error);
    client.emit('authentication_error', { message: 'Authentication failed' });
    client.disconnect();
  }
}

handleDisconnect(client: Socket) {
  console.log(`🔌 Client disconnected: ${client.id}, reason: ${client.disconnected}`);
  this.logger.log(`Client disconnected: ${client.id}`);
  const user = this.onlineUsers.get(client.id);
  if (user) {
    // Clean up solo session
    this.soloQuizSessions.delete(user.userId);
    this.onlineUsers.delete(client.id);
    this.broadcastOnlineUsers();
    this.logger.log(`User ${user.username} disconnected`);
  }
  this.cleanupUserSessions(client.id);
}
  private handleUserReconnection(socketId: string, userId: string): void {
    // Update user sessions with new socket ID
    for (const [quizId, session] of this.sequentialQuizSessions.entries()) {
      // Find if this user was in the session with old socket ID
      const existingPlayer = Array.from(session.players.entries()).find(
        ([_, player]) => player.userId === userId
      );
      
      if (existingPlayer) {
        const [oldSocketId, player] = existingPlayer;
        
        if (oldSocketId !== socketId) {
          console.log(`🔄 User ${player.username} reconnected with new socket: ${socketId}`);
          
          // Update players map
          session.players.delete(oldSocketId);
          session.players.set(socketId, { ...player, socketId });
          
          // Update answered players
          if (session.answeredPlayers.has(oldSocketId)) {
            session.answeredPlayers.delete(oldSocketId);
            session.answeredPlayers.add(socketId);
          }
        }
      }
    }
  }

  // ========== SEQUENTIAL ONLINE QUIZ HANDLERS ==========

  private startQuestionTimer(quizId: string, duration: number): void {
    const quizSession = this.sequentialQuizSessions.get(quizId);
    
    if (!quizSession) {
      console.error(`❌ Cannot start timer: Quiz session not found for ${quizId}`);
      return;
    }

    console.log(`⏰ Starting ${duration}s timer for quiz ${quizId}, question ${quizSession.currentQuestionIndex}`);

    // Clear any existing timer
    if (quizSession.questionTimer) {
      clearTimeout(quizSession.questionTimer);
      quizSession.questionTimer = undefined;
    }

    // Set new timer
    quizSession.questionTimer = setTimeout(() => {
      this.handleQuestionTimerExpired(quizId);
    }, duration * 1000);
  }

  private handleQuestionTimerExpired(quizId: string): void {
    const quizSession = this.sequentialQuizSessions.get(quizId);
    
    if (!quizSession || quizSession.finished) {
      console.warn(`❌ Quiz session not found or already finished for quiz: ${quizId}`);
      return;
    }

    console.log(`⏰ Timer expired for quiz ${quizId}, question ${quizSession.currentQuestionIndex}`);
    
    const isFinalQuestion = quizSession.currentQuestionIndex === quizSession.questions.length - 1;

    // Notify all players that time is up
    this.server.to(quizId).emit('timeExpired', {
      quizId: quizId,
      questionIndex: quizSession.currentQuestionIndex,
      isFinalQuestion: isFinalQuestion
    });

    // Auto-advance after 3 seconds
    console.log(`⏩ Auto-advancing to next question for quiz ${quizId} in 3 seconds`);
    
    setTimeout(() => {
      this.autoAdvanceToNextQuestion(quizId);
    }, 3000);
  }

  private autoAdvanceToNextQuestion(quizId: string): void {
    console.log(`🔄 Auto-advance triggered for quiz: ${quizId}`);
    
    const quizSession = this.sequentialQuizSessions.get(quizId);
    if (!quizSession || quizSession.finished) {
      console.warn(`❌ Quiz session no longer exists or finished: ${quizId}`);
      return;
    }

    // Move to next question
    quizSession.currentQuestionIndex++;
    
    if (quizSession.currentQuestionIndex >= quizSession.questions.length) {
      console.log(`🏁 Quiz finished via auto-advance: ${quizId}`);
      this.endQuiz(quizId);
      return;
    }

    quizSession.currentQuestionStartTime = Date.now();
    const currentQuestion = quizSession.questions[quizSession.currentQuestionIndex];

    // Reset answered players for the new question
    quizSession.answeredPlayers.clear();

    // Send next question to all players
    this.server.to(quizId).emit('nextQuestion', {
      quizId: quizId,
      question: currentQuestion,
      questionIndex: quizSession.currentQuestionIndex,
      totalQuestions: quizSession.questions.length,
      startTime: quizSession.currentQuestionStartTime,
    });

    // Start the timer for this question
    this.startQuestionTimer(quizId, 15);
    
    console.log(`✅ Auto-advanced to question ${quizSession.currentQuestionIndex + 1} for quiz: ${quizId}`);
  }

  private endQuiz(quizId: string): void {
    const quizSession = this.sequentialQuizSessions.get(quizId);
    if (!quizSession) return;

    quizSession.finished = true;
    
    console.log(`🏁 Quiz ${quizId} finished, cleaning up session`);

    this.server.to(quizId).emit('sequentialQuizFinished', {
      quizId: quizId,
      totalQuestions: quizSession.questions.length,
    });

    // Clean up timers
    if (quizSession.questionTimer) {
      clearTimeout(quizSession.questionTimer);
    }
    if (quizSession.autoAdvanceTimer) {
      clearTimeout(quizSession.autoAdvanceTimer);
    }

    // Remove session after a delay to allow final operations
    setTimeout(() => {
      if (this.sequentialQuizSessions.has(quizId)) {
        this.sequentialQuizSessions.delete(quizId);
        console.log(`🧹 Cleaned up quiz session: ${quizId}`);
      }
    }, 10000);
  }

  @SubscribeMessage('startSequentialQuiz')
  async handleStartSequentialQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string; questionCount: number }
  ) {
    try {
      const user = this.onlineUsers.get(client.id);
      if (!user) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      console.log(`🎯 Creating sequential quiz session: ${data.quizId}`);

      const originalQuestions = await this.quizService.getRandomQuestions(data.questionCount || 10);
      const transformedQuestions = this.transformQuestionsForOnline(originalQuestions);

      const quizSession: SequentialQuizSession = {
        quizId: data.quizId,
        players: new Map([[client.id, user]]),
        questions: transformedQuestions,
        originalQuestions: originalQuestions,
        currentQuestionIndex: -1,
        started: false,
        finished: false,
        currentQuestionStartTime: 0,
        answeredPlayers: new Set(),
      };

      this.sequentialQuizSessions.set(data.quizId, quizSession);
      
      const storedSession = this.sequentialQuizSessions.get(data.quizId);
      console.log(`✅ Session stored: ${!!storedSession}`);

      client.join(data.quizId);

      client.emit('sequentialQuizStarted', {
        quizId: data.quizId,
        totalQuestions: transformedQuestions.length,
      });

      console.log(`Sequential quiz started: ${data.quizId} with ${transformedQuestions.length} questions`);

      // Auto-start the first question after a short delay
      setTimeout(() => {
        this.autoAdvanceToNextQuestion(data.quizId);
      }, 2000);

    } catch (error) {
      console.error('Error starting sequential quiz:', error);
      client.emit('error', { 
        message: 'Failed to start quiz',
        error: error.message 
      });
    }
  }

  @SubscribeMessage('joinSequentialQuiz')
  async handleJoinSequentialQuiz(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { quizId: string }
  ) {
    try {
      const user = this.onlineUsers.get(client.id);
      if (!user) {
        client.emit('error', { message: 'User not authenticated' });
        return;
      }

      this.logger.log(`User ${user.username} joining sequential quiz: ${data.quizId}`);

      const quizSession = this.sequentialQuizSessions.get(data.quizId);
      if (!quizSession) {
        client.emit('error', { message: 'Quiz not found' });
        return;
      }

      if (quizSession.started && quizSession.currentQuestionIndex >= 0) {
        client.emit('error', { message: 'Quiz has already started' });
        return;
      }

      quizSession.players.set(client.id, user);
      client.join(data.quizId);

      client.emit('sequentialQuizJoined', {
        quizId: data.quizId,
        totalQuestions: quizSession.questions.length,
        currentQuestionIndex: quizSession.currentQuestionIndex,
        players: Array.from(quizSession.players.values()),
      });

      this.server.to(data.quizId).emit('playerJoinedSequential', {
        player: user,
        players: Array.from(quizSession.players.values()),
      });

      this.logger.log(`User ${user.username} joined sequential quiz: ${data.quizId}`);

    } catch (error) {
      this.logger.error('Error joining sequential quiz:', error);
      client.emit('error', { 
        message: 'Failed to join quiz',
        error: error.message 
      });
    }
  }

  // REMOVED: handleRequestNextQuestion - No longer needed as questions advance automatically
@SubscribeMessage('submitSequentialAnswer')
async handleSubmitSequentialAnswer(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { 
    quizId: string; 
    questionIndex: number;
    answerIndex: number;
    timeSpent: number;
  }
) {
  try {
    const user = this.onlineUsers.get(client.id);
    const quizSession = this.sequentialQuizSessions.get(data.quizId);

    if (!quizSession || !user) {
      client.emit('error', { message: 'Invalid quiz or user' });
      return;
    }

    console.log('🔍 [BACKEND] Answer submission received:', {
      user: user.username,
      quizId: data.quizId,
      questionIndex: data.questionIndex,
      answerIndex: data.answerIndex,
      timeSpent: data.timeSpent
    });

    // Track that this player has answered
    quizSession.answeredPlayers.add(client.id);

    // Use the STORED original question for validation
    const originalQuestion = quizSession.originalQuestions[data.questionIndex];
    
    if (!originalQuestion) {
      console.error('❌ [BACKEND] Original question not found in session for index:', data.questionIndex);
      client.emit('error', { message: 'Question not found in session' });
      return;
    }

    // Validate answer index
    if (data.answerIndex < 0 || data.answerIndex >= originalQuestion.options.length) {
      console.error('❌ [BACKEND] Invalid answer index:', data.answerIndex);
      client.emit('error', { message: 'Invalid answer index' });
      return;
    }

    // BACKEND VALIDATION: Check if the answer is correct using stored original question
    const selectedOption = originalQuestion.options[data.answerIndex];
    const isCorrect = selectedOption?.isCorrect || false;

    // Find the correct answer text for frontend display
    const correctAnswerOption = originalQuestion.options.find(opt => opt.isCorrect);
    const correctAnswerText = correctAnswerOption?.text || '';

    console.log('✅ [BACKEND] Answer validation result:', {
      selectedAnswerIndex: data.answerIndex,
      selectedAnswerText: selectedOption?.text,
      isCorrect: isCorrect,
      correctAnswerIndex: originalQuestion.options.findIndex(opt => opt.isCorrect),
      correctAnswerText: correctAnswerText
    });

    // Send result back to answering client
    const responseData = {
      quizId: data.quizId,
      questionIndex: data.questionIndex,
      isCorrect,
      correctAnswer: correctAnswerText,
      timeSpent: data.timeSpent,
      isFinalQuestion: data.questionIndex === quizSession.questions.length - 1
    };

    console.log('📤 [BACKEND] Sending response to client:', responseData);

    client.emit('sequentialAnswerResult', responseData);

    // Notify all players about this player's answer
    this.server.to(data.quizId).emit('playerAnsweredSequential', {
      player: user,
      questionIndex: data.questionIndex,
      isCorrect: isCorrect,
      isFinalQuestion: data.questionIndex === quizSession.questions.length - 1
    });

    // 🏆 FASTEST WINNER LOGIC FOR FINAL QUESTION
    const isFinalQuestion = data.questionIndex === quizSession.questions.length - 1;
    
    if (isFinalQuestion && isCorrect) {
      console.log(`🏆 [BACKEND] Final question answered correctly by ${user.username}`);
      
      // Check if this is the first correct answer for the final question
      if (!this.fastestAnswerWinners.has(data.quizId)) {
        // This is the first correct answer - they win immediately!
        const winnerData = {
          userId: user.userId,
          username: user.username,
          timeSpent: data.timeSpent
        };
        
        this.fastestAnswerWinners.set(data.quizId, winnerData);

        console.log(`🎯 [BACKEND] IMMEDIATE WINNER: ${user.username} answered final question in ${data.timeSpent}s`);
        
        // Immediately declare winner and end the game
        this.server.to(data.quizId).emit('fastestWinnerDeclared', {
          quizId: data.quizId,
          winner: winnerData,
          questionIndex: data.questionIndex,
          message: `${user.username} wins the game by answering the final question first!`
        });

        // Stop all timers and clean up the session
        this.endQuizImmediately(data.quizId);
      }
    }

    // Check if all active players have answered (for early advancement) - but NOT for final question
    const allAnswered = this.checkAllPlayersAnswered(quizSession);
    
    // If all players answered and it's NOT the final question, advance immediately
    if (allAnswered && !isFinalQuestion) {
      console.log(`🎯 All players answered early for quiz ${quizSession.quizId}, advancing immediately`);
      
      // Clear the current timer since we're advancing early
      if (quizSession.questionTimer) {
        clearTimeout(quizSession.questionTimer);
      }
      
      // Auto-advance after a short delay to show results
      setTimeout(() => {
        this.autoAdvanceToNextQuestion(data.quizId);
      }, 2000);
    }

  } catch (error) {
    console.error('❌ [BACKEND] Error submitting sequential answer:', error);
    client.emit('error', { 
      message: 'Failed to submit answer',
      error: error.message 
    });
  }
}

/**
 * Immediately end the quiz when a winner is declared
 */
private endQuizImmediately(quizId: string): void {
  const quizSession = this.sequentialQuizSessions.get(quizId);
  if (!quizSession) return;

  console.log(`🛑 [BACKEND] Immediately ending quiz ${quizId} due to winner`);

  quizSession.finished = true;
  
  // Clean up all timers immediately
  if (quizSession.questionTimer) {
    clearTimeout(quizSession.questionTimer);
    quizSession.questionTimer = undefined;
  }
  
  if (quizSession.autoAdvanceTimer) {
    clearTimeout(quizSession.autoAdvanceTimer);
    quizSession.autoAdvanceTimer = undefined;
  }

  // 🚨 IMPORTANT: DO NOT automatically clean up the session
  // Let it stay alive until users manually leave
  console.log(`📝 [BACKEND] Quiz ${quizId} marked as finished - session kept alive`);
  
  // The session will be cleaned up when the last player disconnects
  // or through manual cleanup methods
}

/**
 * Manual cleanup when user returns home
 */
@SubscribeMessage('leaveQuizSession')
handleLeaveQuizSession(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { quizId: string }
) {
  console.log(`🚪 [BACKEND] User leaving quiz session: ${data.quizId}`);
  
  // Remove player from session
  const quizSession = this.sequentialQuizSessions.get(data.quizId);
  if (quizSession) {
    quizSession.players.delete(client.id);
    
    // If no players left in session, clean it up
    const connectedPlayers = Array.from(quizSession.players.keys()).filter(playerId => 
      this.isPlayerConnected(playerId)
    );
    
    if (connectedPlayers.length === 0) {
      console.log(`🧹 [BACKEND] No players left - cleaning up session: ${data.quizId}`);
      this.sequentialQuizSessions.delete(data.quizId);
    }
  }
  
  client.leave(data.quizId);
}

  private checkAllPlayersAnswered(quizSession: SequentialQuizSession): boolean {
    const activePlayers = Array.from(quizSession.players.keys()).filter(playerId => {
      const player = quizSession.players.get(playerId);
      return player && this.isPlayerConnected(playerId);
    });

    const allAnswered = activePlayers.every(playerId => 
      quizSession.answeredPlayers.has(playerId)
    );

    if (allAnswered && activePlayers.length > 0) {
      console.log(`🎯 All ${activePlayers.length} active players have answered for quiz ${quizSession.quizId}`);
      return true;
    }
    
    return false;
  }

  private isPlayerConnected(playerId: string): boolean {
    const socket = this.server.sockets.sockets?.get(playerId);
    return !!(socket && socket.connected);
  }

  // ========== SOLO QUIZ HANDLERS ==========

@SubscribeMessage('getSoloQuestions')
async handleGetSoloQuestions(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { count: number; mode?: string }
) {
  try {
    const user = this.onlineUsers.get(client.id);
    if (!user) {
      client.emit('soloQuestionsError', { message: 'User not authenticated' });
      return;
    }

    console.log(`🎯 [Solo] Getting ${data.count} questions for user ${user.username}`);
    const questions = await this.quizService.getRandomQuestions(data.count || 10);
    
    // ✅ STORE the original questions for later validation
    const soloSession: SoloQuizSession = {
      userId: user.userId,
      questions: questions, // Store ORIGINAL questions with isCorrect
      startTime: Date.now()
    };
    this.soloQuizSessions.set(user.userId, soloSession);

    // Transform for frontend (remove isCorrect)
    const transformedQuestions = this.transformQuestionsForOnline(questions);

    client.emit('soloQuestionsLoaded', {
      questions: transformedQuestions,
      totalQuestions: transformedQuestions.length,
      mode: data.mode || 'solo',
      timestamp: Date.now(),
    });

    console.log(`✅ [Solo] Sent ${transformedQuestions.length} sanitized questions to ${user.username}`);

  } catch (error) {
    console.error('❌ Error getting solo questions:', error);
    client.emit('soloQuestionsError', { message: 'Failed to load questions', error: error.message });
  }
}

@SubscribeMessage('submitSoloAnswer')
async handleSubmitSoloAnswer(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { quizId: string; questionIndex: number; answerIndex: number; timeSpent: number; }
) {
  try {
    const user = this.onlineUsers.get(client.id);
    if (!user) {
      client.emit('error', { message: 'User not authenticated' });
      return;
    }

    console.log(`🎯 [Solo] Answer submission from ${user.username}:`, {
      questionIndex: data.questionIndex,
      answerIndex: data.answerIndex,
      timeSpent: data.timeSpent
    });

    // ✅ FIX: Use the STORED questions instead of fetching new ones
    const soloSession = this.soloQuizSessions.get(user.userId);
    if (!soloSession || !soloSession.questions) {
      console.error('❌ [Solo] No stored questions found for user:', user.username);
      client.emit('error', { message: 'Quiz session expired. Please restart the quiz.' });
      return;
    }

    if (data.questionIndex >= soloSession.questions.length) {
      client.emit('error', { message: 'Invalid question index' });
      return;
    }

    // Use the stored original question for validation
    const originalQuestion = soloSession.questions[data.questionIndex];
    
    // Validate the answer
    const selectedOption = originalQuestion.options[data.answerIndex];
    const isCorrect = selectedOption?.isCorrect || false;

    // Find the correct answer text for frontend display
    const correctAnswerOption = originalQuestion.options.find(opt => opt.isCorrect);
    const correctAnswerText = correctAnswerOption?.text || '';

    console.log(`✅ [Solo] Validation result for ${user.username}:`, {
      isCorrect: isCorrect,
      correctAnswerText: correctAnswerText,
      selectedAnswerText: selectedOption?.text,
      // Debug: Show what options we have
      availableOptions: originalQuestion.options.map(opt => ({ text: opt.text, isCorrect: opt.isCorrect }))
    });

    // Send validation result back to client
    client.emit('soloAnswerValidation', {
      quizId: data.quizId,
      questionIndex: data.questionIndex,
      validated: true,
      isCorrect: isCorrect,
      correctAnswer: correctAnswerText,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Error processing solo answer:', error);
    client.emit('error', { message: 'Failed to process answer', error: error.message });
  }
}

  // ========== UTILITY METHODS ==========

  private transformQuestionsForOnline(questions: any[]): any[] {
    console.log('🔄 [BACKEND] Transforming questions for online mode - REMOVING isCorrect');
    
    return questions.map((q, index) => {
      const transformedQuestion = {
        id: `online-q-${Date.now()}-${index}`,
        question: q.question,
        options: Array.isArray(q.options) 
          ? q.options.map((opt, optIndex) => {
              const { isCorrect, ...cleanOption } = opt;
              return {
                id: `opt-${index}-${optIndex}`,
                text: cleanOption.text,
              };
            })
          : [],
        category: q.category || 'General',
        difficulty: q.difficulty || 'Medium',
      };

      const hasIsCorrect = transformedQuestion.options.some(opt => 'isCorrect' in opt);
      if (hasIsCorrect) {
        console.error('❌ [BACKEND] CRITICAL: isCorrect property was not removed!');
        transformedQuestion.options = transformedQuestion.options.map(opt => {
          const { isCorrect, ...cleanOpt } = opt;
          return cleanOpt;
        });
      }

      return transformedQuestion;
    });
  }

  private transformQuestionsForSolo(questions: any[]): any[] {
    return questions.map((q, index) => ({
      id: `solo-q-${Date.now()}-${index}`,
      question: q.question,
      options: Array.isArray(q.options) 
        ? q.options.map((opt, optIndex) => ({
            id: `opt-${index}-${optIndex}`,
            text: opt.text,
            isCorrect: opt.isCorrect,
          }))
        : [],
      category: q.category || 'General',
      difficulty: q.difficulty || 'Medium',
    }));
  }

private async authenticateUser(token: string): Promise<AuthenticatedUser | null> {
  try {
    console.log('🔐 [BACKEND] Authenticating user with token:', token);
    
    // Method 1: Decode JWT token (this is what you have)
    try {
      const payload = this.decodeJwt(token);
      console.log('🔍 [BACKEND] JWT Payload:', payload);
      
      if (payload && payload.sub && payload.username) {
        console.log('✅ [BACKEND] Authenticated user from JWT:', payload.username);
        return {
          userId: payload.sub, // Use 'sub' which contains the user ID
          username: payload.username,
        };
      }
    } catch (jwtError) {
      console.log('⚠️ [BACKEND] JWT decoding failed:', jwtError.message);
    }
    
    console.error('❌ [BACKEND] JWT authentication failed, using fallback');
    // Fallback - but we should never reach this with a valid JWT
    return {
      userId: 'user-' + Date.now(),
      username: 'user-' + Math.random().toString(36).substr(2, 9),
    };
    
  } catch (error) {
    this.logger.error('Authentication error:', error);
    return null;
  }
}

// Fix the JWT decoding method
private decodeJwt(token: string): any {
  try {
    console.log('🔐 [BACKEND] Decoding JWT token...');
    
    // Remove any quotes if present
    const cleanToken = token.replace(/"/g, '');
    
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      console.error('❌ [BACKEND] Invalid JWT format - expected 3 parts, got:', parts.length);
      return null;
    }
    
    const payload = parts[1];
    console.log('🔍 [BACKEND] JWT Payload part:', payload);
    
    // Add padding if needed for base64 decoding
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const decoded = JSON.parse(Buffer.from(base64, 'base64').toString());
    console.log('✅ [BACKEND] Successfully decoded JWT payload:', decoded);
    return decoded;
    
  } catch (error) {
    console.error('❌ [BACKEND] JWT decoding error:', error);
    console.error('❌ [BACKEND] Token that failed:', token);
    return null;
  }
}


  private broadcastOnlineUsers() {
    const users = Array.from(this.onlineUsers.values());
    this.server.emit('onlineUsers', users);
  }

  private cleanupUserSessions(socketId: string) {
    console.log(`🧹 Cleaning up sessions for socket: ${socketId}`);
    
    for (const [quizId, session] of this.sequentialQuizSessions.entries()) {
      const user = session.players.get(socketId);
      
      if (user) {
        console.log(`➖ Player ${user.username} (${socketId}) disconnected from quiz: ${quizId}`);
        
        session.players.delete(socketId);
        session.answeredPlayers.delete(socketId);
        
        // Check if session should end due to no players
        const connectedPlayers = Array.from(session.players.keys()).filter(playerId => 
          this.isPlayerConnected(playerId)
        );
        
        if (connectedPlayers.length === 0 && !session.finished) {
          console.log(`❌ No players left for quiz: ${quizId}, ending quiz`);
          this.endQuiz(quizId);
        }
      }
    }
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const users = Array.from(this.onlineUsers.values());
    client.emit('onlineUsers', users);
  }
}