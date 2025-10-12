import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { QuizService } from './quiz.service';
import { Question } from './quiz.service';

export interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
}

export interface QuestionStats {
  question: string;
  timesAnswered: number;
  timesAnsweredCorrectly: number;
  averageTimeSpent: number;
  accuracy: number;
}

export interface QuizStats {
  totalQuestions: number;
  totalResponses: number;
  totalCorrect: number;
  accuracy: number;
  avgTimeSpent: number;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private onlineUsers: OnlineUser[] = [];

  // Online Users Subjects
  private onlineUsersSubject = new BehaviorSubject<OnlineUser[]>([]);
  private connectionStatus$ = new BehaviorSubject<boolean>(false);

  // Authentication Subjects
  private authenticationSuccessSubject = new Subject<any>();
  private authenticationErrorSubject = new Subject<any>();
  private tokenExpiredSubject = new Subject<any>();
  private tokenRefreshedSubject = new Subject<any>();
  private tokenRefreshFailedSubject = new Subject<any>();
  private authenticationRequiredSubject = new Subject<any>();

  // Quiz Questions Subjects
  private soloQuestionsLoadedSubject = new Subject<{ questions: Question[]; totalQuestions: number; mode: string }>();  private synchronizedQuizCreatedSubject = new Subject<any>();
  private synchronizedQuizJoinedSubject = new Subject<any>();
  private moreQuestionsLoadedSubject = new Subject<{ questions: QuizService[], totalQuestions: number, mode: string }>();
  private questionLoadedSubject = new Subject<{ question: QuizService }>();
  private answerResultSubject = new Subject<any>();
  private soloQuestionsErrorSubject = new Subject<any>();

  // Synchronized Quiz Subjects
  private synchronizedQuestionSubject = new Subject<any>();
  private synchronizedTimeUpdateSubject = new Subject<any>();
  private synchronizedAnswerResultSubject = new Subject<any>();
  private synchronizedWinnerSubject = new Subject<any>();
  private synchronizedQuizFinishedSubject = new Subject<any>();
  private playerJoinedSubject = new Subject<any>();
  private playerAnsweredSynchronizedSubject = new Subject<any>();
  private playerAnsweredSubject = new Subject<any>();

  // Game Events Subjects
  private newQuestionSubject = new Subject<any>();
  private winnerDeterminedSubject = new Subject<any>();
  private playerEliminatedSubject = new Subject<any>();
  private playerWinSubject = new Subject<any>();
  private gameOverSubject = new Subject<any>();
  private playerReadySubject = new Subject<any>();
  private questionsLoadedSubject = new Subject<any>();
  private consistentQuestionsLoadedSubject = new Subject<any>();

  // Debug Subjects
  private debugDatabaseResultSubject = new Subject<any>();
  private debugConnectionResultSubject = new Subject<any>();
  private debugQuestionsFlowResultSubject = new Subject<any>();
  private debugQuestionsSampleSubject = new Subject<any>();

  // Connection Debug Subjects
  private connectionDebugSubject = new Subject<any>();

  private subscriptions: Subscription[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectionTimeout: any = null;
  private isManualDisconnect = false;

  constructor(private authService: AuthService) {
    this.initializeConnection();
  }

  ngOnDestroy(): void {
    this.isManualDisconnect = true;
    this.disconnect();
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private initializeConnection(): void {
    console.log('[SocketService] 🔌 Initializing WebSocket connection');
    
    // Try to connect immediately
    this.connect();
    
    // Also try to connect when auth state changes
    const authSub = this.authService.currentUser.subscribe(user => {
      if (user && !this.isConnected()) {
        console.log('[SocketService] 🔑 User authenticated, attempting connection');
        setTimeout(() => this.connect(), 100);
      }
    });

    this.subscriptions.push(authSub);
  }

  async connect(): Promise<void> {
    // Clear any existing connection
    this.disconnect();

    try {
      // Get the token - ensure this is synchronous and happens right before connection
      const token = this.authService.getToken();
      
      console.log('[SocketService] 🔌 Attempting WebSocket connection', { 
        hasToken: !!token,
        tokenLength: token?.length || 0,
        wsUrl: environment.wsUrl,
        timestamp: new Date().toISOString()
      });

      if (!token) {
        console.error('[SocketService] ❌ No authentication token available - connection may have limited functionality');
        // Don't return - allow connection for public features
      }

      // Clear any existing timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      this.socket = io(environment.wsUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: {
          token: token || '' // Always send auth object, even if token is empty
        },
        query: {
          token: token || '' // Add as query parameter as backup
        },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: false,
      });

      this.setupListeners();
      
      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected()) {
          console.error('[SocketService] ⏰ Connection timeout - server not responding after 8 seconds');
          this.handleConnectionError(new Error('Connection timeout - server not responding'));
        }
      }, 8000);

    } catch (error) {
      console.error('[SocketService] ❌ Connection setup error:', error);
      this.handleConnectionError(error);
    }
  }

  disconnect(): void {
    try {
      this.isManualDisconnect = true;
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      if (this.socket) {
        console.log('[SocketService] 🔌 Disconnecting socket');
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
        this.connectionStatus$.next(false);
        this.reconnectAttempts = 0;
      }
    } catch (err) {
      console.error('[SocketService] ❌ Disconnect error', err);
    }
  }

  private setupListeners(): void {
    if (!this.socket) {
      console.error('[SocketService] ❌ Cannot setup listeners - socket is null');
      return;
    }

    console.log('[SocketService] 📡 Setting up WebSocket listeners');

    // Connection events
    this.socket.on('connect', () => {
      console.log('[SocketService] ✅ Connected to server, Socket ID:', this.socket?.id);
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      this.connectionStatus$.next(true);
      this.reconnectAttempts = 0;
      this.isManualDisconnect = false;
      
      // Wait a bit for authentication to complete before marking as fully ready
      setTimeout(() => {
        console.log('[SocketService] 🚀 Socket connection fully ready for requests');
        // Request online users after connection is fully established
        this.requestOnlineUsers();
        this.emitDebugConnection();
      }, 300);
    });

    this.socket.on('disconnect', (reason: any) => {
      console.log('[SocketService] 🔌 Disconnected:', reason);
      this.connectionStatus$.next(false);
      
      if (!this.isManualDisconnect) {
        this.handleDisconnect(reason);
      }
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('[SocketService] ❌ Connection error:', error.message);
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      this.handleConnectionError(error);
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      console.log(`[SocketService] 🔄 Reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
    });

    this.socket.on('reconnect', (attempt: number) => {
      console.log(`[SocketService] ✅ Reconnected successfully after ${attempt} attempts`);
    });

    this.socket.on('reconnect_error', (error: any) => {
      console.error('[SocketService] ❌ Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketService] ❌ All reconnection attempts failed');
      this.connectionStatus$.next(false);
    });

    // Authentication events
    this.socket.on('authentication_success', (data: any) => {
      console.log('[SocketService] ✅ Authentication successful:', data);
      this.authenticationSuccessSubject.next(data);
    });

    this.socket.on('authentication_error', (data: any) => {
      console.error('[SocketService] ❌ Authentication error:', data);
      this.authenticationErrorSubject.next(data);
      this.handleAuthenticationError();
    });

    this.socket.on('token_expired', (data: any) => {
      console.log('[SocketService] 🔑 Token expired:', data);
      this.tokenExpiredSubject.next(data);
      this.handleTokenExpired();
    });

    this.socket.on('token_refreshed', (data: any) => {
      console.log('[SocketService] 🔑 Token refreshed:', data);
      this.tokenRefreshedSubject.next(data);
    });

    this.socket.on('token_refresh_failed', (data: any) => {
      console.error('[SocketService] ❌ Token refresh failed:', data);
      this.tokenRefreshFailedSubject.next(data);
      this.handleAuthenticationError();
    });

    // Authentication required event (for public connections)
    this.socket.on('authentication_required', (data: any) => {
      console.log('[SocketService] 🔐 Authentication required:', data);
      this.authenticationRequiredSubject.next(data);
    });

    // Connection debug event
    this.socket.on('connection_debug', (data: any) => {
      console.log('[SocketService] 🔧 Connection debug:', data);
      this.connectionDebugSubject.next(data);
    });

    // Online Users Listener
    this.socket.on('onlineUsers', (data: any) => {
      console.log('[SocketService] 👥 Online users received:', data?.length || 0);
      this.onlineUsers = Array.isArray(data) ? data : [];
      this.onlineUsersSubject.next(this.onlineUsers);
    });

    this.socket.on('userConnected', (data: any) => {
      console.log('[SocketService] ➕ User connected:', data.username);
      // Refresh online users list
      this.requestOnlineUsers();
    });

    this.socket.on('userDisconnected', (data: any) => {
      console.log('[SocketService] ➖ User disconnected:', data);
      // Refresh online users list
      this.requestOnlineUsers();
    });

    // Quiz Questions Events
    this.socket.on('soloQuestionsLoaded', (data: any) => {
      console.log('[SocketService] 📚 Solo questions loaded:', data.questions?.length);
      this.soloQuestionsLoadedSubject.next(data);
    });

    this.socket.on('soloQuestionsError', (data: any) => {
      console.error('[SocketService] ❌ Solo questions error received:', data);
      this.soloQuestionsErrorSubject.next(data);
    });

    this.socket.on('questionsLoaded', (data: any) => {
      console.log('[SocketService] 📚 Questions loaded for online mode:', data.questions?.length);
      this.questionsLoadedSubject.next(data);
    });

    this.socket.on('consistentQuestionsLoaded', (data: any) => {
      console.log('[SocketService] 🔄 Consistent questions loaded:', data.questions?.length, 'with seed:', data.seed);
      this.consistentQuestionsLoadedSubject.next(data);
    });

    this.socket.on('synchronizedQuizCreated', (data: any) => {
      console.log('[SocketService] 🎯 Synchronized quiz created:', data);
      this.synchronizedQuizCreatedSubject.next(data);
    });

    this.socket.on('synchronizedQuizJoined', (data: any) => {
      console.log('[SocketService] 🎯 Synchronized quiz joined:', data.questions?.length);
      this.synchronizedQuizJoinedSubject.next(data);
    });

    this.socket.on('moreQuestionsLoaded', (data: any) => {
      console.log('[SocketService] 📚 More questions loaded:', data.questions?.length);
      this.moreQuestionsLoadedSubject.next(data);
    });

    this.socket.on('questionLoaded', (data: any) => {
      console.log('[SocketService] ❓ Question loaded:', data.question?._id);
      this.questionLoadedSubject.next(data);
    });

    this.socket.on('answerResult', (data: any) => {
      console.log('[SocketService] ✅ Answer result:', data.isCorrect);
      this.answerResultSubject.next(data);
    });

    // Synchronized Quiz Listeners
    this.socket.on('synchronizedQuestion', (data: any) => {
      console.log('[SocketService] 🔄 Synchronized question:', data.questionIndex);
      this.synchronizedQuestionSubject.next(data);
    });

    this.socket.on('synchronizedTimeUpdate', (data: any) => {
      this.synchronizedTimeUpdateSubject.next(data);
    });

    this.socket.on('synchronizedAnswerResult', (data: any) => {
      console.log('[SocketService] ✅ Synchronized answer result:', data);
      this.synchronizedAnswerResultSubject.next(data);
    });

    this.socket.on('synchronizedWinner', (data: any) => {
      console.log('[SocketService] 🏆 Synchronized winner:', data);
      this.synchronizedWinnerSubject.next(data);
    });

    this.socket.on('synchronizedQuizFinished', (data: any) => {
      console.log('[SocketService] 🏁 Synchronized quiz finished:', data);
      this.synchronizedQuizFinishedSubject.next(data);
    });

    this.socket.on('playerJoined', (data: any) => {
      console.log('[SocketService] 👤 Player joined:', data.username);
      this.playerJoinedSubject.next(data);
    });

    this.socket.on('playerAnsweredSynchronized', (data: any) => {
      console.log('[SocketService] 📝 Player answered synchronized:', data.username);
      this.playerAnsweredSynchronizedSubject.next(data);
    });

    this.socket.on('playerAnswered', (data: any) => {
      console.log('[SocketService] 📝 Player answered:', data.username);
      this.playerAnsweredSubject.next(data);
    });

    // Game Events Listeners
    this.socket.on('newQuestion', (data: any) => {
      console.log('[SocketService] ❓ New question:', data.questionIndex);
      this.newQuestionSubject.next(data);
    });

    this.socket.on('winnerDetermined', (data: any) => {
      console.log('[SocketService] 🏆 Winner determined:', data);
      this.winnerDeterminedSubject.next(data);
    });

    this.socket.on('playerEliminated', (data: any) => {
      console.log('[SocketService] ❌ Player eliminated:', data.username);
      this.playerEliminatedSubject.next(data);
    });

    this.socket.on('playerWin', (data: any) => {
      console.log('[SocketService] 🎉 Player win:', data.username);
      this.playerWinSubject.next(data);
    });

    this.socket.on('gameOver', (data: any) => {
      console.log('[SocketService] 🏁 Game over:', data);
      this.gameOverSubject.next(data);
    });

    this.socket.on('playerReady', (data: any) => {
      console.log('[SocketService] ✅ Player ready:', data.username);
      this.playerReadySubject.next(data);
    });

    // Debug events
    this.socket.on('debug_database_result', (data: any) => {
      console.log('[SocketService] 🔍 Debug database result:', data);
      this.debugDatabaseResultSubject.next(data);
    });

    this.socket.on('debug_connection_result', (data: any) => {
      console.log('[SocketService] 🔌 Debug connection result:', data);
      this.debugConnectionResultSubject.next(data);
    });

    this.socket.on('debug_questions_flow_result', (data: any) => {
      console.log('[SocketService] 🔍 Debug questions flow result:', data);
      this.debugQuestionsFlowResultSubject.next(data);
    });

    this.socket.on('debug_questions_sample', (data: any) => {
      console.log('[SocketService] 🔍 Debug questions sample:', data);
      this.debugQuestionsSampleSubject.next(data);
    });

    // Error handling
    this.socket.on('error', (data: any) => {
      console.error('[SocketService] ❌ Server error:', data);
    });
  }

  // ========== AUTHENTICATION METHODS ==========

  emitRefreshToken(refreshToken: string): void {
    if (!this.isConnected()) {
      console.warn('[SocketService] ❌ Cannot refresh token - not connected');
      return;
    }
    console.log('[SocketService] 🔑 Refreshing token');
    this.socket?.emit('refresh_token', { refreshToken });
  }

  // ========== QUIZ QUESTIONS EMIT METHODS ==========

  emitGetSoloQuestions(count: number = 10): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot get solo questions - not connected');
      return;
    }
    console.log('[SocketService] 📚 Getting solo questions via WebSocket:', count);
    this.socket?.emit('getSoloQuestions', {
      count,
      timestamp: Date.now(),
      mode: 'solo',
    });
  }

  emitRequestQuestions(payload: { quizId: string; count: number }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot request questions - not connected');
      return;
    }
    console.log('[SocketService] 📚 Requesting questions for online mode:', payload);
    this.socket?.emit('requestQuestions', {
      ...payload,
      timestamp: Date.now(),
      mode: 'online',
    });
  }

  emitRequestConsistentQuestions(payload: { quizId: string; count: number; seed: string }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot request consistent questions - not connected');
      return;
    }
    console.log('[SocketService] 🔄 Requesting consistent questions with seed:', payload.seed);
    this.socket?.emit('requestConsistentQuestions', {
      ...payload,
      timestamp: Date.now(),
      mode: 'online',
    });
  }

  emitJoinOnlineQuiz(quizId: string, userId: string): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot join online quiz - not connected');
      return;
    }
    console.log('[SocketService] 🎯 Joining online quiz:', quizId);
    this.socket?.emit('joinOnlineQuiz', {
      quizId,
      userId,
      timestamp: Date.now(),
    });
  }

  emitCreateOnlineQuiz(quizId: string, questionCount: number): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot create online quiz - not connected');
      return;
    }
    console.log('[SocketService] 🎯 Creating online quiz:', quizId);
    this.socket?.emit('createOnlineQuiz', {
      quizId,
      questionCount,
      timestamp: Date.now(),
    });
  }

  emitStartOnlineQuiz(quizId: string): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot start online quiz - not connected');
      return;
    }
    console.log('[SocketService] 🎯 Starting online quiz:', quizId);
    this.socket?.emit('startSynchronizedQuiz', { quizId });
  }

  emitCreateSynchronizedQuiz(quizId: string, questionCount: number): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot create synchronized quiz - not connected');
      return;
    }
    console.log('[SocketService] 🔄 Creating synchronized quiz:', quizId, questionCount);
    this.socket?.emit('createSynchronizedQuiz', { quizId, questionCount });
  }

  emitJoinSynchronizedQuiz(quizId: string, userId: string): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot join synchronized quiz - not connected');
      return;
    }
    console.log('[SocketService] 🔄 Joining synchronized quiz:', quizId, userId);
    this.socket?.emit('joinSynchronizedQuiz', { quizId, userId });
  }

  emitSubmitAnswer(questionId: string, answerIndex: number, timeSpent: number, mode: 'solo' | 'online', quizId?: string, questionIndex?: number): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot submit answer - not connected');
      return;
    }
    console.log('[SocketService] 📝 Submitting answer:', { questionId, answerIndex, mode });
    this.socket?.emit('submitAnswer', {
      questionId,
      answerIndex,
      timeSpent,
      mode,
      quizId,
      questionIndex,
    });
  }

  emitGetMoreQuestions(count: number, mode: 'solo' | 'online'): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot get more questions - not connected');
      return;
    }
    console.log('[SocketService] 📚 Getting more questions:', count, mode);
    this.socket?.emit('getMoreQuestions', { count, mode });
  }

  emitGetQuestionById(questionId: string): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot get question by ID - not connected');
      return;
    }
    console.log('[SocketService] ❓ Getting question by ID:', questionId);
    this.socket?.emit('getQuestionById', { questionId });
  }

  // ========== SYNCHRONIZED QUIZ EMIT METHODS ==========

  emitStartSynchronizedQuiz(quizId: string): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot start synchronized quiz - not connected');
      return;
    }
    console.log('[SocketService] 🔄 Starting synchronized quiz:', quizId);
    this.socket?.emit('startSynchronizedQuiz', { quizId });
  }

  emitNextSynchronizedQuestion(quizId: string): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot request next synchronized question - not connected');
      return;
    }
    console.log('[SocketService] 🔄 Requesting next synchronized question:', quizId);
    this.socket?.emit('nextSynchronizedQuestion', { quizId });
  }

  emitSubmitSynchronizedAnswer(quizId: string, questionIndex: number, answerIndex: number): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot submit synchronized answer - not connected');
      return;
    }
    console.log('[SocketService] 📝 Submitting synchronized answer:', { quizId, questionIndex, answerIndex });
    this.socket?.emit('submitSynchronizedAnswer', { quizId, questionIndex, answerIndex });
  }

  // ========== GAME EVENTS EMIT METHODS ==========

  emitRequestQuestion(payload: { quizId: string; questionIndex: number }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot request question - not connected');
      return;
    }
    console.log('[SocketService] ❓ Requesting question:', payload);
    this.socket?.emit('requestQuestion', { ...payload, timestamp: Date.now() });
  }

  emitReadyForNextQuestion(payload: { quizId: string; userId: string; questionIndex: number }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot emit ready for next question - not connected');
      return;
    }
    console.log('[SocketService] ✅ Ready for next question:', payload);
    this.socket?.emit('readyForNextQuestion', { ...payload, timestamp: Date.now() });
  }

  emitPlayerAnswered(payload: { userId: string; questionIndex: number; isCorrect: boolean | null }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot emit player answered - not connected');
      return;
    }
    console.log('[SocketService] 📝 Player answered:', payload);
    this.socket?.emit('playerAnswered', payload);
  }

  emitPlayerEliminated(payload: { userId: string; questionIndex: number; reason: string }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot emit player eliminated - not connected');
      return;
    }
    console.log('[SocketService] ❌ Player eliminated:', payload);
    this.socket?.emit('playerEliminated', payload);
  }

  emitPlayerWin(payload: { userId: string; username: string; questionIndex: number }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot emit player win - not connected');
      return;
    }
    console.log('[SocketService] 🎉 Player win:', payload);
    this.socket?.emit('playerWin', payload);
  }

  emitGameOver(payload: { winner: { userId: string; username: string } | null }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot emit game over - not connected');
      return;
    }
    console.log('[SocketService] 🏁 Game over:', payload);
    this.socket?.emit('gameOver', payload);
  }

  emitDetermineWinner(payload: { quizId?: string; questionIndex: number }): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot determine winner - not connected');
      return;
    }
    console.log('[SocketService] 🏆 Determine winner:', payload);
    this.socket?.emit('determineWinner', { ...(payload || {}), timestamp: Date.now() });
  }

  // ========== DEBUG METHODS ==========

  emitDebugDatabase(): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot debug database - not connected');
      return;
    }
    console.log('[SocketService] 🔍 Debugging database...');
    this.socket?.emit('debug_database');
  }

  emitDebugConnection(): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot debug connection - not connected');
      return;
    }
    console.log('[SocketService] 🔌 Debugging connection...');
    this.socket?.emit('debug_connection');
  }

  emitDebugQuestionsFlow(count: number = 3): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot debug questions flow - not connected');
      return;
    }
    console.log('[SocketService] 🔍 Debugging questions flow...');
    this.socket?.emit('debug_questions_flow', { count });
  }

  // ========== ERROR HANDLING METHODS ==========

  private handleTokenExpired(): void {
    console.log('[SocketService] 🔑 Handling token expiration');
    const token = this.authService.getToken();
    if (!token) {
      console.warn('[SocketService] ❌ No token available for refresh');
      this.handleAuthenticationError();
      return;
    }

    console.log('[SocketService] 🔑 Attempting to refresh token...');
    const refreshSub = this.authService.refreshToken().subscribe({
      next: (response: any) => {
        if (response?.token) {
          console.log('[SocketService] ✅ Token refreshed successfully');
          // Reconnect with new token
          setTimeout(() => this.connect(), 100);
        } else {
          console.error('[SocketService] ❌ Refresh token response missing token');
          this.handleAuthenticationError();
        }
      },
      error: (error) => {
        console.error('[SocketService] ❌ Token refresh failed:', error);
        this.handleAuthenticationError();
      },
    });

    this.subscriptions.push(refreshSub);
  }

  private handleAuthenticationError(): void {
    console.log('[SocketService] 🔐 Handling authentication error');
    
    try {
      // Call logout directly (it returns void)
      this.authService.logout();
      console.log('[SocketService] 🔐 Logged out due to authentication error');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        this.redirectToLogin();
      }, 1000);
      
    } catch (error) {
      console.error('[SocketService] ❌ Error during logout:', error);
      this.redirectToLogin();
    }
  }

  private handleDisconnect(reason: any): void {
    console.log('[SocketService] 🔌 Handling disconnect:', reason);
    
    if (this.isManualDisconnect) {
      console.log('[SocketService] 🔌 Manual disconnect, not reconnecting');
      return;
    }

    if (reason === 'io server disconnect' && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * this.reconnectAttempts, 10000);
      console.log(`[SocketService] 🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SocketService] ❌ Max reconnection attempts reached');
      this.connectionStatus$.next(false);
    }
  }

  private handleConnectionError(error: any): void {
    console.error('[SocketService] ❌ Connection error:', error);
    
    if (error?.message?.includes('auth') || error?.type === 'UnauthorizedError') {
      this.handleAuthenticationError();
    } else {
      this.handleDisconnect('connection error');
    }
  }

  private redirectToLogin(): void {
    if (typeof window !== 'undefined') {
      console.log('[SocketService] 🔐 Redirecting to login page');
      // Use a more robust redirect method
      const currentPath = window.location.pathname;
      const loginUrl = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
      window.location.href = loginUrl;
    }
  }

  // ========== OBSERVABLES ==========

  // Authentication Observables
  onAuthenticationSuccess(): Observable<any> {
    return this.authenticationSuccessSubject.asObservable();
  }

  onAuthenticationError(): Observable<any> {
    return this.authenticationErrorSubject.asObservable();
  }

  onTokenExpired(): Observable<any> {
    return this.tokenExpiredSubject.asObservable();
  }

  onTokenRefreshed(): Observable<any> {
    return this.tokenRefreshedSubject.asObservable();
  }

  onTokenRefreshFailed(): Observable<any> {
    return this.tokenRefreshFailedSubject.asObservable();
  }

  onAuthenticationRequired(): Observable<any> {
    return this.authenticationRequiredSubject.asObservable();
  }

  onConnectionDebug(): Observable<any> {
    return this.connectionDebugSubject.asObservable();
  }

  // Quiz Questions Observables
  onSoloQuestionsLoaded(): Observable<{ questions: Question[]; totalQuestions: number; mode: string }> {
    return this.soloQuestionsLoadedSubject.asObservable();
  }

  onSoloQuestionsError(): Observable<any> {
    return this.soloQuestionsErrorSubject.asObservable();
  }

  onQuestionsLoaded(): Observable<any> {
    return this.questionsLoadedSubject.asObservable();
  }

  onConsistentQuestionsLoaded(): Observable<any> {
    return this.consistentQuestionsLoadedSubject.asObservable();
  }

  onSynchronizedQuizCreated(): Observable<any> {
    return this.synchronizedQuizCreatedSubject.asObservable();
  }

  onSynchronizedQuizJoined(): Observable<any> {
    return this.synchronizedQuizJoinedSubject.asObservable();
  }

  onMoreQuestionsLoaded(): Observable<{ questions: QuizService[]; totalQuestions: number; mode: string }> {
    return this.moreQuestionsLoadedSubject.asObservable();
  }

  onQuestionLoaded(): Observable<{ question: QuizService }> {
    return this.questionLoadedSubject.asObservable();
  }

  onAnswerResult(): Observable<any> {
    return this.answerResultSubject.asObservable();
  }

  // Synchronized Quiz Observables
  onSynchronizedQuestion(): Observable<any> {
    return this.synchronizedQuestionSubject.asObservable();
  }

  onSynchronizedTimeUpdate(): Observable<any> {
    return this.synchronizedTimeUpdateSubject.asObservable();
  }

  onSynchronizedAnswerResult(): Observable<any> {
    return this.synchronizedAnswerResultSubject.asObservable();
  }

  onSynchronizedWinner(): Observable<any> {
    return this.synchronizedWinnerSubject.asObservable();
  }

  onSynchronizedQuizFinished(): Observable<any> {
    return this.synchronizedQuizFinishedSubject.asObservable();
  }

  onPlayerJoined(): Observable<any> {
    return this.playerJoinedSubject.asObservable();
  }

  onPlayerAnsweredSynchronized(): Observable<any> {
    return this.playerAnsweredSynchronizedSubject.asObservable();
  }

  onPlayerAnswered(): Observable<any> {
    return this.playerAnsweredSubject.asObservable();
  }

  // Game Events Observables
  onNewQuestion(): Observable<any> {
    return this.newQuestionSubject.asObservable();
  }

  onWinnerDetermined(): Observable<any> {
    return this.winnerDeterminedSubject.asObservable();
  }

  onPlayerWin(): Observable<any> {
    return this.playerWinSubject.asObservable();
  }

  onGameOver(): Observable<any> {
    return this.gameOverSubject.asObservable();
  }

  onPlayerEliminated(): Observable<any> {
    return this.playerEliminatedSubject.asObservable();
  }

  onPlayerReady(): Observable<any> {
    return this.playerReadySubject.asObservable();
  }

  // Debug Observables
  onDebugDatabaseResult(): Observable<any> {
    return this.debugDatabaseResultSubject.asObservable();
  }

  onDebugConnectionResult(): Observable<any> {
    return this.debugConnectionResultSubject.asObservable();
  }

  onDebugQuestionsFlowResult(): Observable<any> {
    return this.debugQuestionsFlowResultSubject.asObservable();
  }

  onDebugQuestionsSample(): Observable<any> {
    return this.debugQuestionsSampleSubject.asObservable();
  }

  // Online Users Observables
  requestOnlineUsers(): void {
    if (!this.isConnected()) {
      console.warn('[SocketService] ❌ Cannot request online users - not connected');
      return;
    }
    console.log('[SocketService] 👥 Requesting online users');
    this.socket?.emit('getOnlineUsers');
  }

  getOnlineUsers(): Observable<OnlineUser[]> {
    return this.onlineUsersSubject.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  // Utility methods
  isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // Manual reconnection
  manualReconnect(): void {
    console.log('[SocketService] 🔄 Manual reconnection requested');
    this.reconnectAttempts = 0;
    this.connect();
  }

  // Connection health check
  checkConnectionHealth(): { connected: boolean; socketId: string | null; reconnectAttempts: number } {
    return {
      connected: this.isConnected(),
      socketId: this.getSocketId(),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Debug authentication status
  debugAuthStatus(): void {
    const token = this.authService.getToken();
    console.log('[SocketService] 🔍 Auth Debug:', {
      hasToken: !!token,
      tokenLength: token?.length,
      socketConnected: this.isConnected(),
      socketId: this.getSocketId(),
      reconnectAttempts: this.reconnectAttempts
    });
  }
}