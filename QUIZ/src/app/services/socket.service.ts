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

export interface SoloAnswerValidationRequest {
  userId: string;
  quizId: string;
  answers: Array<{
    questionId: string;
    selectedOption: number;
  }>;
  timeSpent: number;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private onlineUsers: OnlineUser[] = [];

  // Connection state management
  private isInitialized = false;
  private initializationInProgress = false;
  private connectionPromise: Promise<boolean> | null = null;
  private connectionInProgress = false;
  private shouldReconnect = true;
  private isPageReload = false;
  private reloadDetectionCompleted = false;

  // Online Users Subjects
  private onlineUsersSubject = new BehaviorSubject<OnlineUser[]>([]);
  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private connectionReadySubject = new BehaviorSubject<boolean>(false);
  public connectionReady$ = this.connectionReadySubject.asObservable();

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

  // Sequential Quiz Subjects
  private sequentialQuizStartedSubject = new Subject<any>();
  private sequentialQuizJoinedSubject = new Subject<any>();
  private nextQuestionSubject = new Subject<any>();
  private sequentialAnswerResultSubject = new Subject<any>();
  private playerJoinedSequentialSubject = new Subject<any>();
  private playerAnsweredSequentialSubject = new Subject<any>();
  private sequentialQuizFinishedSubject = new Subject<any>();

  // Solo Answer Validation Subject
  private soloAnswerValidationSubject = new Subject<any>();

  // Fastest winner subject
  private fastestWinnerDeclaredSubject = new Subject<any>();

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
    console.log('[SocketService] 🔌 SocketService constructed');
    
    // Improved page reload detection
    this.detectPageReload();
    
    // Listen for page unload to prevent reconnection
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        console.log('[SocketService] 📄 Page unloading - marking as reload');
        this.isPageReload = true;
        this.shouldReconnect = true;
        this.isManualDisconnect = false;
        
        // Store connection state for reload
        if (this.socket?.connected) {
          sessionStorage.setItem('socketWasConnected', 'true');
          sessionStorage.setItem('socketId', this.socket.id || '');
        }
      });

      // Listen for page load completion
      window.addEventListener('load', () => {
        console.log('[SocketService] 📄 Page load complete');
        this.reloadDetectionCompleted = true;
        
        // Clear reload markers after a short time
        setTimeout(() => {
          sessionStorage.removeItem('socketWasConnected');
          sessionStorage.removeItem('socketId');
          this.isPageReload = false;
        }, 2000);
      });
    }
  }

  private detectPageReload(): void {
    if (typeof window !== 'undefined') {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const wasReloaded = navigationEntry?.type === 'reload';
      
      if (wasReloaded || sessionStorage.getItem('isReloading') === 'true') {
        console.log('[SocketService] 🔄 Page reload detected');
        this.isPageReload = true;
        
        // Check if we had a previous connection
        const socketWasConnected = sessionStorage.getItem('socketWasConnected') === 'true';
        if (socketWasConnected) {
          console.log('[SocketService] 🔌 Previous socket connection detected, attempting to maintain');
        }
      }
      
      // Set for next reload detection
      sessionStorage.setItem('isReloading', 'true');
      
      // Clear the reload marker after a short time
      setTimeout(() => {
        if (sessionStorage.getItem('isReloading') === 'true') {
          sessionStorage.removeItem('isReloading');
        }
      }, 1000);
    }
  }

ngOnDestroy(): void {
    // Only fully disconnect if this is not a page reload
    if (!this.isPageReload) {
      console.log('[SocketService] 🔌 Normal destruction - disconnecting');
      this.isManualDisconnect = true;
      this.disconnect();
    } else {
      console.log('[SocketService] 🔄 Page reload - preserving connection state');
      // Don't disconnect during reloads
    }
    
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  public async initializeService(): Promise<boolean> {
    // If we're in a page reload scenario and already have a connection, use it
    if (this.isPageReload && this.isConnected()) {
      console.log('[SocketService] 🔄 Page reload - reusing existing connection');
      this.connectionReadySubject.next(true);
      this.connectionStatus$.next(true);
      return Promise.resolve(true);
    }

    if (this.connectionInProgress) {
      console.log('[SocketService] 🔄 Initialization already in progress');
      return this.connectionPromise!;
    }

    if (this.isConnected()) {
      console.log('[SocketService] ✅ Already connected');
      return Promise.resolve(true);
    }

    console.log('[SocketService] 🚀 Starting WebSocket initialization');
    this.connectionInProgress = true;
    this.initializationInProgress = true;

    this.connectionPromise = new Promise<boolean>(async (resolve) => {
      try {
        await this.initializeConnection();
        
        const connected = await this.waitForConnectionWithTimeout(10000); // Reduced timeout
        
        if (connected) {
          console.log('[SocketService] ✅ WebSocket connection established');
          this.isInitialized = true;
          this.isPageReload = false; // Reset reload flag after successful connection
          resolve(true);
        } else {
          console.error('[SocketService] ❌ WebSocket connection failed - timeout');
          this.isInitialized = false;
          this.connectionInProgress = false;
          resolve(false);
        }
      } catch (error) {
        console.error('[SocketService] ❌ Initialization error:', error);
        this.isInitialized = false;
        this.connectionInProgress = false;
        resolve(false);
      } finally {
        this.initializationInProgress = false;
      }
    });

    return this.connectionPromise;
  }

  private async initializeConnection(): Promise<void> {
    console.log('[SocketService] 🔌 Initializing WebSocket connection');
    
    return new Promise((resolve) => {
      const currentUser = this.authService.currentUserValue;
      const token = this.authService.getToken();
      
      // If we have credentials, connect immediately
      if (currentUser && token) {
        console.log('[SocketService] 🔑 User authenticated, connecting');
        this.connect();
        resolve();
        return;
      }
      
      // For page reloads, try to connect immediately even without auth
      if (this.isPageReload) {
        console.log('[SocketService] 🔄 Page reload - attempting immediate connection');
        this.connect();
        resolve();
        return;
      }
      
      console.log('[SocketService] ⏳ Waiting for user authentication...');
      const authSub = this.authService.currentUser.subscribe(user => {
        if (user) {
          console.log('[SocketService] 🔑 User authenticated via subscription, connecting');
          authSub.unsubscribe();
          this.connect();
          resolve();
        }
      });

      // Shorter timeout for page reloads
      const timeout = this.isPageReload ? 1000 : 3000;
      
      setTimeout(() => {
        authSub.unsubscribe();
        console.log('[SocketService] ⏰ Auth wait timeout, connecting anyway');
        this.connect();
        resolve();
      }, timeout);
    });
  }

  private waitForConnectionWithTimeout(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        console.log('[SocketService] ✅ Already connected in waitForConnection');
        resolve(true);
        return;
      }

      let timeoutHandled = false;
      
      const subscription = this.connectionReady$.subscribe(ready => {
        if (ready && !timeoutHandled) {
          console.log('[SocketService] ✅ Connection ready received');
          subscription.unsubscribe();
          resolve(true);
        }
      });

      const connectionCheck = setInterval(() => {
        if (this.isConnected() && !timeoutHandled) {
          console.log('[SocketService] ✅ Direct connection check passed');
          clearInterval(connectionCheck);
          subscription.unsubscribe();
          resolve(true);
        }
      }, 500);

      setTimeout(() => {
        if (!timeoutHandled) {
          timeoutHandled = true;
          console.warn('[SocketService] ⏰ Connection timeout reached');
          subscription.unsubscribe();
          clearInterval(connectionCheck);
          resolve(false);
        }
      }, timeoutMs);
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      console.log('[SocketService] ✅ Already connected, skipping connect');
      return;
    }

    if (this.connectionInProgress && !this.isPageReload) {
      console.log('[SocketService] 🔄 Connection already in progress, skipping');
      return;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.connectionInProgress = true;

    try {
      const token = this.authService.getToken();
      const currentUser = this.authService.currentUserValue;
      
      console.log('[SocketService] 🔌 Creating WebSocket connection', { 
        hasToken: !!token,
        hasUser: !!currentUser,
        userId: currentUser?._id,
        username: currentUser?.username,
        isPageReload: this.isPageReload
      });

      // For page reloads, attempt connection even without immediate auth
      if (!token && !this.isPageReload) {
        console.warn('[SocketService] ⚠️ No token and not page reload - cannot connect');
        this.connectionInProgress = false;
        throw new Error('No authentication token available');
      }

      // Only cleanup if not in page reload scenario
      if (!this.isPageReload) {
        this.cleanupSocket();
      } else if (this.socket && !this.socket.connected) {
        // During reload, only cleanup if socket exists but isn't connected
        this.cleanupSocket();
      }

      console.log('[SocketService] 🔗 Connecting to:', `${environment.wsUrl}/quiz`);
      
      const authData: any = {};
      if (token) {
        authData.token = token;
      }
      if (currentUser) {
        authData.user = JSON.stringify({
          userId: currentUser._id,
          username: currentUser.username
        });
      }

      // Use forceNew: false to allow connection reuse
      this.socket = io(`${environment.wsUrl}/quiz`, {
        transports: ['websocket', 'polling'],
        auth: authData,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 8000, // Reduced timeout
        forceNew: false, // Allow connection reuse
        closeOnBeforeunload: false // Important: don't close on page reload
      });

      this.setupListeners();

      this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected() && this.connectionInProgress) {
          console.error('[SocketService] ⏰ Connection timeout - server not responding');
          this.handleConnectionError(new Error('Connection timeout'));
          this.connectionInProgress = false;
        }
      }, 8000);

    } catch (error) {
      console.error('[SocketService] ❌ Connection setup error:', error);
      this.initializationInProgress = false;
      this.connectionInProgress = false;
      this.connectionPromise = null;
      this.handleConnectionError(error);
      throw error;
    }
  }

private cleanupSocket(): void {
    if (this.socket) {
      console.log('[SocketService] 🧹 Cleaning up existing socket');
      this.socket.removeAllListeners();
      
      // Only disconnect if not in page reload scenario
      if (!this.isPageReload) {
        this.socket.disconnect();
      }
      
      this.socket = null;
    }
  }


  public async getConnection(): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }
    
    if (!this.isInitialized && !this.initializationInProgress) {
      return await this.initializeService();
    }
    
    return await this.waitForConnectionWithTimeout(5000);
  }

  public ensureInitialized(): void {
    if (!this.isInitialized && !this.initializationInProgress) {
      console.log('[SocketService] 🔄 Ensuring service is initialized');
      this.initializeService().catch(error => {
        console.error('[SocketService] ❌ Failed to ensure initialization:', error);
      });
    } else if (this.isConnected()) {
      console.log('[SocketService] ✅ Already connected and initialized');
    }
  }
    disconnect(): void {
    // Only fully disconnect if this is not a page reload
    if (this.isPageReload) {
      console.log('[SocketService] 🔄 Page reload - skipping full disconnect');
      return;
    }

    try {
      this.isManualDisconnect = true;
      this.shouldReconnect = false;
      this.connectionInProgress = false;
      this.connectionPromise = null;
      
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      this.cleanupSocket();
      
      this.connectionStatus$.next(false);
      this.connectionReadySubject.next(false);
      this.reconnectAttempts = 0;
      this.isInitialized = false;
      
      console.log('[SocketService] 🔌 Socket disconnected and cleaned up');
    } catch (err) {
      console.error('[SocketService] ❌ Disconnect error', err);
    }
  }

    public async recoverConnection(): Promise<boolean> {
    if (this.isConnected()) {
      return true;
    }

    console.log('[SocketService] 🔄 Attempting connection recovery');
    
    // Reset state for recovery
    this.isPageReload = false;
    this.connectionInProgress = false;
    this.connectionPromise = null;
    
    return await this.initializeService();
  }

  private setupListeners(): void {
    if (!this.socket) {
      console.error('[SocketService] ❌ Cannot setup listeners - socket is null');
      return;
    }
    console.log('[SocketService] 📡 Setting up WebSocket listeners');

   this.socket.on('connect', () => {
      console.log('[SocketService] ✅ Connected to server, Socket ID:', this.socket?.id);
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
      this.connectionStatus$.next(true);
      this.connectionReadySubject.next(true);
      this.reconnectAttempts = 0;
      this.isManualDisconnect = false;
      this.connectionInProgress = false;

 // Clear page reload flag once connected
      this.isPageReload = false;
      sessionStorage.removeItem('isReloading');
      sessionStorage.removeItem('socketWasConnected');
      
      console.log('[SocketService] 🚀 Socket connection fully ready for requests');
      
      // Request online users after connection
      setTimeout(() => {
        this.requestOnlineUsers();
      }, 300);
    });

    this.socket.on('disconnect', (reason: any) => {
      console.log('[SocketService] 🔌 Disconnected:', reason);
      this.connectionStatus$.next(false);
      this.connectionReadySubject.next(false);
      this.connectionInProgress = false;
      
      if (this.isPageReload) {
        console.log('[SocketService] 🔄 Page reload - not attempting reconnection');
        return;
      }
      
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
      this.connectionInProgress = false;
      
      if (this.isPageReload) {
        console.log('[SocketService] 🔄 Page reload - not handling connection error');
        return;
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

    // Sequential Quiz Events
    this.socket.on('sequentialQuizStarted', (data: any) => {
      console.log('[SocketService] 🎯 Sequential quiz started:', data.quizId);
      this.sequentialQuizStartedSubject.next(data);
    });

    this.socket.on('sequentialQuizJoined', (data: any) => {
      console.log('[SocketService] 🎯 Sequential quiz joined:', data.quizId);
      this.sequentialQuizJoinedSubject.next(data);
    });

    this.socket.on('nextQuestion', (data: any) => {
      console.log('[SocketService] ❓ Next question received:', data.questionIndex);
      this.nextQuestionSubject.next(data);
    });

    this.socket.on('sequentialAnswerResult', (data: any) => {
      console.log('[SocketService] ✅ Sequential answer result:', data.isCorrect);
      this.sequentialAnswerResultSubject.next(data);
    });

    this.socket.on('playerJoinedSequential', (data: any) => {
      console.log('[SocketService] 👤 Player joined sequential:', data.player.username);
      this.playerJoinedSequentialSubject.next(data);
    });

    this.socket.on('playerAnsweredSequential', (data: any) => {
      console.log('[SocketService] 📝 Player answered sequential:', data.player.username);
      this.playerAnsweredSequentialSubject.next(data);
    });

    this.socket.on('sequentialQuizFinished', (data: any) => {
      console.log('[SocketService] 🏁 Sequential quiz finished:', data.quizId);
      this.sequentialQuizFinishedSubject.next(data);
    });

    // Solo Events
    this.socket.on('soloQuestionsLoaded', (data: any) => {
      console.log('[SocketService] 📚 Solo questions loaded:', data.questions?.length);
      this.soloQuestionsLoadedSubject.next(data);
    });

    this.socket.on('soloQuestionsError', (data: any) => {
      console.error('[SocketService] ❌ Solo questions error received:', data);
      this.soloQuestionsErrorSubject.next(data);
    });

    this.socket.on('soloAnswerValidation', (data: any) => {
      console.log('[SocketService] ✅ Solo answer validation received:', data);
      this.soloAnswerValidationSubject.next(data);
    });

    // Fastest Winner Event
    this.socket.on('fastestWinnerDeclared', (data: any) => {
      console.log('[SocketService] 🏆 Fastest winner declared:', data);
      this.fastestWinnerDeclaredSubject.next(data);
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

  // ========== SOLO METHODS ==========

  emitGetSoloQuestions(count: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.log('[SocketService] 🔄 No active connection, attempting recovery before emitting');
        
        try {
          const success = await this.recoverConnection();
          if (success && this.socket) {
            console.log(`[SocketService] 📤 Emitting getSoloQuestions after recovery`);
            this.socket.emit('getSoloQuestions', { count, mode: 'solo' });
            resolve(true);
          } else {
            console.error('[SocketService] ❌ Failed to recover connection');
            resolve(false);
          }
        } catch (error) {
          console.error('[SocketService] ❌ Connection recovery error:', error);
          resolve(false);
        }
        return;
      }
      
      console.log(`[SocketService] 📤 Emitting getSoloQuestions for ${count} questions`);
      this.socket.emit('getSoloQuestions', { count, mode: 'solo' });
      resolve(true);
    });
  }
  emitSubmitSoloAnswer(quizId: string, questionIndex: number, answerIndex: number, timeSpent: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot submit solo answer - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log(`[SocketService] 📤 Emitting submitSoloAnswer after reconnect`);
            this.socket.emit('submitSoloAnswer', {
              quizId,
              questionIndex,
              answerIndex,
              timeSpent
            });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log(`[SocketService] 📤 Emitting submitSoloAnswer:`, {
        quizId, questionIndex, answerIndex, timeSpent
      });
      
      this.socket.emit('submitSoloAnswer', {
        quizId,
        questionIndex,
        answerIndex,
        timeSpent
      });
      resolve(true);
    });
  }

  emitValidateSoloAnswers(data: SoloAnswerValidationRequest): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot validate solo answers - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] ✅ Submitting solo answers for validation after reconnect:', data);
            this.socket.emit('validateSoloAnswers', data);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] ✅ Submitting solo answers for validation:', data);
      this.socket.emit('validateSoloAnswers', data);
      resolve(true);
    });
  }

  // ========== SOLO OBSERVABLES ==========

  onSoloQuestionsLoaded(): Observable<any> {
    return this.soloQuestionsLoadedSubject.asObservable();
  }

  onSoloQuestionsError(): Observable<any> {
    return this.soloQuestionsErrorSubject.asObservable();
  }

  onSoloAnswerValidation(): Observable<any> {
    return this.soloAnswerValidationSubject.asObservable();
  }

  // ========== SEQUENTIAL QUIZ EMIT METHODS ==========

  emitStartSequentialQuiz(quizId: string, questionCount: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot start sequential quiz - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🎯 Starting sequential quiz after reconnect:', quizId, questionCount);
            this.socket.emit('startSequentialQuiz', { quizId, questionCount });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🎯 Starting sequential quiz:', quizId, questionCount);
      this.socket.emit('startSequentialQuiz', { quizId, questionCount });
      resolve(true);
    });
  }

  emitJoinSequentialQuiz(quizId: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot join sequential quiz - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🎯 Joining sequential quiz after reconnect:', quizId);
            this.socket.emit('joinSequentialQuiz', { quizId });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🎯 Joining sequential quiz:', quizId);
      this.socket.emit('joinSequentialQuiz', { quizId });
      resolve(true);
    });
  }

  emitRequestNextQuestion(quizId: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot request next question - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] ❓ Requesting next question for quiz after reconnect:', quizId);
            this.socket.emit('requestNextQuestion', { quizId });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] ❓ Requesting next question for quiz:', quizId);
      this.socket.emit('requestNextQuestion', { quizId });
      resolve(true);
    });
  }

  emitSubmitSequentialAnswer(quizId: string, questionIndex: number, answerIndex: number, timeSpent: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot submit sequential answer - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 📝 Submitting sequential answer after reconnect:', { 
              quizId, 
              questionIndex, 
              answerIndex, 
              timeSpent: timeSpent.toFixed(2) + 's' 
            });
            this.socket.emit('submitSequentialAnswer', { quizId, questionIndex, answerIndex, timeSpent });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 📝 Submitting sequential answer:', { 
        quizId, 
        questionIndex, 
        answerIndex, 
        timeSpent: timeSpent.toFixed(2) + 's' 
      });
      this.socket.emit('submitSequentialAnswer', { quizId, questionIndex, answerIndex, timeSpent });
      resolve(true);
    });
  }

  // ========== QUIZ QUESTIONS EMIT METHODS ==========

  emitRequestQuestions(payload: { quizId: string; count: number; mode?: string }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot request questions - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 📚 Requesting questions for online mode after reconnect:', payload);
            this.socket.emit('requestQuestions', {
              ...payload,
              timestamp: Date.now(),
              mode: 'online',
            });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 📚 Requesting questions for online mode:', payload);
      this.socket.emit('requestQuestions', {
        ...payload,
        timestamp: Date.now(),
        mode: 'online',
      });
      resolve(true);
    });
  }

  emitRequestConsistentQuestions(payload: { quizId: string; count: number; seed: string }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot request consistent questions - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🔄 Requesting consistent questions with seed after reconnect:', payload.seed);
            this.socket.emit('requestConsistentQuestions', {
              ...payload,
              timestamp: Date.now(),
              mode: 'online',
            });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🔄 Requesting consistent questions with seed:', payload.seed);
      this.socket.emit('requestConsistentQuestions', {
        ...payload,
        timestamp: Date.now(),
        mode: 'online',
      });
      resolve(true);
    });
  }

  // ========== SYNCHRONIZED QUIZ EMIT METHODS ==========

  emitCreateSynchronizedQuiz(quizId: string, questionCount: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot create synchronized quiz - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🔄 Creating synchronized quiz after reconnect:', quizId, questionCount);
            this.socket.emit('createSynchronizedQuiz', { quizId, questionCount });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🔄 Creating synchronized quiz:', quizId, questionCount);
      this.socket.emit('createSynchronizedQuiz', { quizId, questionCount });
      resolve(true);
    });
  }

  emitJoinSynchronizedQuiz(quizId: string, userId: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot join synchronized quiz - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🔄 Joining synchronized quiz after reconnect:', quizId, userId);
            this.socket.emit('joinSynchronizedQuiz', { quizId, userId });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🔄 Joining synchronized quiz:', quizId, userId);
      this.socket.emit('joinSynchronizedQuiz', { quizId, userId });
      resolve(true);
    });
  }

  emitSubmitSynchronizedAnswer(quizId: string, questionIndex: number, answerIndex: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot submit synchronized answer - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 📝 Submitting synchronized answer after reconnect:', { quizId, questionIndex, answerIndex });
            this.socket.emit('submitSynchronizedAnswer', { quizId, questionIndex, answerIndex });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 📝 Submitting synchronized answer:', { quizId, questionIndex, answerIndex });
      this.socket.emit('submitSynchronizedAnswer', { quizId, questionIndex, answerIndex });
      resolve(true);
    });
  }

  // ========== ANSWER SUBMISSION ==========

  emitSubmitAnswer(
    questionId: string, 
    answerIndex: number, 
    timeSpent: number, 
    mode: 'solo' | 'online', 
    quizId?: string, 
    questionIndex?: number
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot submit answer - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 📝 Submitting answer after reconnect:', { questionId, answerIndex, mode });
            this.socket.emit('submitAnswer', {
              questionId,
              answerIndex,
              timeSpent,
              mode,
              quizId,
              questionIndex,
            });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 📝 Submitting answer:', { questionId, answerIndex, mode });
      this.socket.emit('submitAnswer', {
        questionId,
        answerIndex,
        timeSpent,
        mode,
        quizId,
        questionIndex,
      });
      resolve(true);
    });
  }

  // ========== GAME EVENTS EMIT METHODS ==========

  emitRequestQuestion(payload: { quizId: string; questionIndex: number }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot request question - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] ❓ Requesting question after reconnect:', payload);
            this.socket.emit('requestQuestion', { ...payload, timestamp: Date.now() });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] ❓ Requesting question:', payload);
      this.socket.emit('requestQuestion', { ...payload, timestamp: Date.now() });
      resolve(true);
    });
  }

  emitReadyForNextQuestion(payload: { quizId: string; userId: string; questionIndex: number }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot emit ready for next question - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] ✅ Ready for next question after reconnect:', payload);
            this.socket.emit('readyForNextQuestion', { ...payload, timestamp: Date.now() });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] ✅ Ready for next question:', payload);
      this.socket.emit('readyForNextQuestion', { ...payload, timestamp: Date.now() });
      resolve(true);
    });
  }

  emitPlayerAnswered(payload: { userId: string; questionIndex: number; isCorrect: boolean | null }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot emit player answered - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 📝 Player answered after reconnect:', payload);
            this.socket.emit('playerAnswered', payload);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 📝 Player answered:', payload);
      this.socket.emit('playerAnswered', payload);
      resolve(true);
    });
  }

  emitPlayerEliminated(payload: { userId: string; questionIndex: number; reason: string }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot emit player eliminated - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] ❌ Player eliminated after reconnect:', payload);
            this.socket.emit('playerEliminated', payload);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] ❌ Player eliminated:', payload);
      this.socket.emit('playerEliminated', payload);
      resolve(true);
    });
  }

  emitPlayerWin(payload: { userId: string; username: string; questionIndex: number }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot emit player win - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🎉 Player win after reconnect:', payload);
            this.socket.emit('playerWin', payload);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🎉 Player win:', payload);
      this.socket.emit('playerWin', payload);
      resolve(true);
    });
  }

  emitGameOver(payload: { winner: { userId: string; username: string } | null }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot emit game over - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🏁 Game over after reconnect:', payload);
            this.socket.emit('gameOver', payload);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🏁 Game over:', payload);
      this.socket.emit('gameOver', payload);
      resolve(true);
    });
  }

  emitDetermineWinner(payload: { quizId?: string; questionIndex: number }): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot determine winner - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🏆 Determine winner after reconnect:', payload);
            this.socket.emit('determineWinner', { ...(payload || {}), timestamp: Date.now() });
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🏆 Determine winner:', payload);
      this.socket.emit('determineWinner', { ...(payload || {}), timestamp: Date.now() });
      resolve(true);
    });
  }

  // ========== LEAVE QUIZ SESSION ==========

  emitLeaveQuizSession(quizId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.warn('[SocketService] ❌ Socket not connected, cannot emit leaveQuizSession');
        resolve(false);
        return;
      }
      
      console.log(`🚪 [SocketService] Emitting leaveQuizSession for: ${quizId}`);
      this.socket.emit('leaveQuizSession', { quizId });
      resolve(true);
    });
  }

  // ========== DEBUG METHODS ==========

  emitDebugConnection(): Promise<boolean> {
    return new Promise(async (resolve) => {
      if (!this.isConnected() || !this.socket) {
        console.error('[SocketService] ❌ Cannot debug connection - not connected');
        
        try {
          const success = await this.initializeService();
          if (success && this.socket) {
            console.log('[SocketService] 🔌 Debugging connection after reconnect...');
            this.socket.emit('debug_connection');
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (error) {
          resolve(false);
        }
        return;
      }
      
      console.log('[SocketService] 🔌 Debugging connection...');
      this.socket.emit('debug_connection');
      resolve(true);
    });
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
    
    if (this.isManualDisconnect || !this.shouldReconnect || this.isPageReload) {
      console.log('[SocketService] 🔌 Manual disconnect, no reconnection, or page reload - not reconnecting');
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * this.reconnectAttempts, 10000);
      console.log(`[SocketService] 🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => {
        if (this.shouldReconnect && !this.isPageReload) {
          this.connect();
        }
      }, delay);
    } else {
      console.error('[SocketService] ❌ Max reconnection attempts reached');
      this.connectionStatus$.next(false);
      this.connectionReadySubject.next(false);
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

  // Sequential Quiz Observables
  onSequentialQuizStarted(): Observable<any> {
    return this.sequentialQuizStartedSubject.asObservable();
  }

  onSequentialQuizJoined(): Observable<any> {
    return this.sequentialQuizJoinedSubject.asObservable();
  }

  onNextQuestion(): Observable<any> {
    return this.nextQuestionSubject.asObservable();
  }

  onSequentialAnswerResult(): Observable<any> {
    return this.sequentialAnswerResultSubject.asObservable();
  }

  onPlayerJoinedSequential(): Observable<any> {
    return this.playerJoinedSequentialSubject.asObservable();
  }

  onPlayerAnsweredSequential(): Observable<any> {
    return this.playerAnsweredSequentialSubject.asObservable();
  }

  onSequentialQuizFinished(): Observable<any> {
    return this.sequentialQuizFinishedSubject.asObservable();
  }

  // Fastest Winner Observable
  onFastestWinnerDeclared(): Observable<any> {
    return this.fastestWinnerDeclaredSubject.asObservable();
  }

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
    if (!this.isConnected() || !this.socket) {
      console.warn('[SocketService] ❌ Cannot request online users - not connected');
      
      if (!this.connectionInProgress) {
        console.log('[SocketService] 🔄 Attempting to reconnect for online users request');
        this.initializeService().then(success => {
          if (success) {
            setTimeout(() => {
              if (this.socket && this.isConnected()) {
                console.log('[SocketService] 👥 Retrying online users request after reconnect');
                this.socket.emit('getOnlineUsers');
              }
            }, 1000);
          }
        });
      }
      return;
    }
    
    console.log('[SocketService] 👥 Requesting online users');
    this.socket.emit('getOnlineUsers');
  }

  getOnlineUsers(): Observable<OnlineUser[]> {
    if (this.onlineUsers.length === 0 && this.isConnected()) {
      setTimeout(() => {
        this.requestOnlineUsers();
      }, 500);
    }
    
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
    this.connectionPromise = null;
    this.connectionInProgress = false;
    this.isPageReload = false;
    this.connect();
  }

  onTimeExpired(): Observable<any> {
    return new Observable(observer => {
      if (!this.socket) {
        console.error('[SocketService] ❌ Cannot listen to timeExpired - socket is null');
        return;
      }
      
      this.socket.on('timeExpired', (data: any) => {
        observer.next(data);
      });
    });
  }

  // Connection health check
  checkConnectionHealth(): { connected: boolean; socketId: string | null; reconnectAttempts: number } {
    return {
      connected: this.isConnected(),
      socketId: this.getSocketId(),
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Debug connection state
  public debugConnectionState(): void {
    console.log('🔍 [SocketService] Connection Debug:', {
      isInitialized: this.isInitialized,
      initializationInProgress: this.initializationInProgress,
      connectionInProgress: this.connectionInProgress,
      isConnected: this.isConnected(),
      socketId: this.getSocketId(),
      hasSocket: !!this.socket,
      reconnectAttempts: this.reconnectAttempts,
      connectionPromise: !!this.connectionPromise,
      onlineUsersCount: this.onlineUsers.length,
      isPageReload: this.isPageReload
    });
  }

  // Debug connection issues
  public debugConnectionIssues(): void {
    const currentUser = this.authService.currentUserValue;
    const token = this.authService.getToken();
    
    console.log('🔍 [SocketService] Connection Issue Debug:', {
      isInitialized: this.isInitialized,
      initializationInProgress: this.initializationInProgress,
      connectionInProgress: this.connectionInProgress,
      isConnected: this.isConnected(),
      socketId: this.getSocketId(),
      hasSocket: !!this.socket,
      shouldReconnect: this.shouldReconnect,
      isManualDisconnect: this.isManualDisconnect,
      isPageReload: this.isPageReload,
      reconnectAttempts: this.reconnectAttempts,
      onlineUsersCount: this.onlineUsers.length,
      connectionPromise: !!this.connectionPromise,
      hasUser: !!currentUser,
      hasToken: !!token,
      userId: currentUser?._id,
      username: currentUser?.username,
      wsUrl: environment.wsUrl
    });
  }
}