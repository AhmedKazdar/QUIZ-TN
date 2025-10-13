import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Question } from './quiz.service';

export interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
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
  private authenticationRequiredSubject = new Subject<any>();

  // User Connection Subjects
  private userConnectedSubject = new Subject<OnlineUser>();
  private userDisconnectedSubject = new Subject<string>();

  // Quiz Questions Subjects
  private soloQuestionsLoadedSubject = new Subject<{ questions: Question[]; totalQuestions: number; mode: string }>();
  private soloQuestionsErrorSubject = new Subject<any>();
  private questionsLoadedSubject = new Subject<any>();
  private consistentQuestionsLoadedSubject = new Subject<any>();

  // Synchronized Quiz Subjects
  private synchronizedQuizCreatedSubject = new Subject<any>();
  private synchronizedQuizJoinedSubject = new Subject<any>();
  private synchronizedAnswerResultSubject = new Subject<any>();
  private synchronizedQuizFinishedSubject = new Subject<any>();
  private playerJoinedSubject = new Subject<any>();
  private playerAnsweredSynchronizedSubject = new Subject<any>();

  // Answer Results
  private answerResultSubject = new Subject<any>();

  // Game Events Subjects
  private newQuestionSubject = new Subject<any>();
  private winnerDeterminedSubject = new Subject<any>();
  private playerEliminatedSubject = new Subject<any>();
  private playerWinSubject = new Subject<any>();
  private gameOverSubject = new Subject<any>();
  private playerReadySubject = new Subject<any>();
  private playerAnsweredSubject = new Subject<any>();

  // Debug Subjects
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
    
    const authSub = this.authService.currentUser.subscribe(user => {
      if (user) {
        console.log('[SocketService] 🔑 User authenticated, attempting connection');
        this.connect();
      } else {
        console.log('[SocketService] ⚠️ No authenticated user, delaying connection');
        this.disconnect();
      }
    });

    this.subscriptions.push(authSub);
  }

  async connect(): Promise<void> {
    this.disconnect();

    try {
      const token = this.authService.getToken();
      
      console.log('[SocketService] 🔌 Attempting WebSocket connection', { 
        hasToken: !!token,
        tokenLength: token?.length || 0,
        wsUrl: environment.wsUrl,
        timestamp: new Date().toISOString()
      });

      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      // Connect to the quiz namespace
      this.socket = io(`${environment.wsUrl}/quiz`, {
        transports: ['websocket', 'polling'],
        auth: {
          token: token || ''
        },
        query: {
          token: token || ''
        },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.setupListeners();
      
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
      
      setTimeout(() => {
        console.log('[SocketService] 🚀 Socket connection fully ready for requests');
        this.requestOnlineUsers();
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

    this.socket.on('authentication_required', (data: any) => {
      console.log('[SocketService] 🔐 Authentication required:', data);
      this.authenticationRequiredSubject.next(data);
    });

    // Online Users Listeners
    this.socket.on('onlineUsers', (data: any) => {
      console.log('[SocketService] 👥 Online users received:', data?.length || 0);
      this.onlineUsers = Array.isArray(data) ? data : [];
      this.onlineUsersSubject.next(this.onlineUsers);
    });

    this.socket.on('userConnected', (data: any) => {
      console.log('[SocketService] ➕ User connected:', data.username);
      this.userConnectedSubject.next(data);
    });

    this.socket.on('userDisconnected', (data: any) => {
      console.log('[SocketService] ➖ User disconnected:', data);
      this.userDisconnectedSubject.next(data);
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

    // Synchronized Quiz Events
    this.socket.on('synchronizedQuizCreated', (data: any) => {
      console.log('[SocketService] 🎯 Synchronized quiz created:', data);
      this.synchronizedQuizCreatedSubject.next(data);
    });

    this.socket.on('synchronizedQuizJoined', (data: any) => {
      console.log('[SocketService] 🎯 Synchronized quiz joined:', data.questions?.length);
      this.synchronizedQuizJoinedSubject.next(data);
    });

    this.socket.on('playerJoined', (data: any) => {
      console.log('[SocketService] 👤 Player joined:', data.username);
      this.playerJoinedSubject.next(data);
    });

    this.socket.on('playerAnsweredSynchronized', (data: any) => {
      console.log('[SocketService] 📝 Player answered synchronized:', data.username);
      this.playerAnsweredSynchronizedSubject.next(data);
    });

    this.socket.on('synchronizedAnswerResult', (data: any) => {
      console.log('[SocketService] ✅ Synchronized answer result:', data);
      this.synchronizedAnswerResultSubject.next(data);
    });

    this.socket.on('synchronizedQuizFinished', (data: any) => {
      console.log('[SocketService] 🏁 Synchronized quiz finished:', data);
      this.synchronizedQuizFinishedSubject.next(data);
    });

    // Answer Results
    this.socket.on('answerResult', (data: any) => {
      console.log('[SocketService] ✅ Answer result:', data.isCorrect);
      this.answerResultSubject.next(data);
    });

    // Game Events
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

    this.socket.on('playerAnswered', (data: any) => {
      console.log('[SocketService] 📝 Player answered:', data.username);
      this.playerAnsweredSubject.next(data);
    });

    // Connection debug
    this.socket.on('connection_debug', (data: any) => {
      console.log('[SocketService] 🔧 Connection debug:', data);
      this.connectionDebugSubject.next(data);
    });

    // Error handling
    this.socket.on('error', (data: any) => {
      console.error('[SocketService] ❌ Server error:', data);
    });
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

  emitRequestQuestions(payload: { quizId: string; count: number; mode?: string }): void {
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

  // ========== SYNCHRONIZED QUIZ EMIT METHODS ==========

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

  emitSubmitSynchronizedAnswer(quizId: string, questionIndex: number, answerIndex: number): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot submit synchronized answer - not connected');
      return;
    }
    console.log('[SocketService] 📝 Submitting synchronized answer:', { quizId, questionIndex, answerIndex });
    this.socket?.emit('submitSynchronizedAnswer', { quizId, questionIndex, answerIndex });
  }

  // ========== ANSWER SUBMISSION ==========

  emitSubmitAnswer(
    questionId: string, 
    answerIndex: number, 
    timeSpent: number, 
    mode: 'solo' | 'online', 
    quizId?: string, 
    questionIndex?: number
  ): void {
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

  emitDebugConnection(): void {
    if (!this.isConnected()) {
      console.error('[SocketService] ❌ Cannot debug connection - not connected');
      return;
    }
    console.log('[SocketService] 🔌 Debugging connection...');
    this.socket?.emit('debug_connection');
  }

  // ========== ERROR HANDLING METHODS ==========

  private handleAuthenticationError(): void {
    console.log('[SocketService] 🔐 Handling authentication error');
    
    try {
      this.authService.logout();
      console.log('[SocketService] 🔐 Logged out due to authentication error');
      
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
      console.log('[SocketService] 🔐 Authentication error - stopping reconnection attempts');
      this.reconnectAttempts = this.maxReconnectAttempts;
      this.handleAuthenticationError();
    } else {
      this.handleDisconnect('connection error');
    }
  }

  private redirectToLogin(): void {
    if (typeof window !== 'undefined') {
      console.log('[SocketService] 🔐 Redirecting to login page');
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

  onAuthenticationRequired(): Observable<any> {
    return this.authenticationRequiredSubject.asObservable();
  }

  // User Connection Observables
  onUserConnected(): Observable<OnlineUser> {
    return this.userConnectedSubject.asObservable();
  }

  onUserDisconnected(): Observable<string> {
    return this.userDisconnectedSubject.asObservable();
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

  // Synchronized Quiz Observables
  onSynchronizedQuizCreated(): Observable<any> {
    return this.synchronizedQuizCreatedSubject.asObservable();
  }

  onSynchronizedQuizJoined(): Observable<any> {
    return this.synchronizedQuizJoinedSubject.asObservable();
  }

  onPlayerJoined(): Observable<any> {
    return this.playerJoinedSubject.asObservable();
  }

  onPlayerAnsweredSynchronized(): Observable<any> {
    return this.playerAnsweredSynchronizedSubject.asObservable();
  }

  onSynchronizedAnswerResult(): Observable<any> {
    return this.synchronizedAnswerResultSubject.asObservable();
  }

  onSynchronizedQuizFinished(): Observable<any> {
    return this.synchronizedQuizFinishedSubject.asObservable();
  }

  // Answer Results
  onAnswerResult(): Observable<any> {
    return this.answerResultSubject.asObservable();
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

  onPlayerAnswered(): Observable<any> {
    return this.playerAnsweredSubject.asObservable();
  }

  // Connection Debug
  onConnectionDebug(): Observable<any> {
    return this.connectionDebugSubject.asObservable();
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
}