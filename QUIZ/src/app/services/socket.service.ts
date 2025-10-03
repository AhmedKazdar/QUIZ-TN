import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, Subscription, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// Define our custom event types
declare module 'socket.io-client' {
  interface Socket {
    // Custom events - emit (add new ones)
    emit(event: 'getOnlineUsers', callback?: (users: OnlineUser[]) => void): this;
    emit(event: 'playerEliminated', data: { userId: string, questionIndex: number, reason: string }): this;
    emit(event: 'playerAnswered', data: { userId: string, questionIndex: number, isCorrect: boolean | null }): this;
    emit(event: 'playerWin', data: { userId: string, username: string, questionIndex: number }): this;
    emit(event: 'gameOver', data: { winner: { userId: string, username: string } | null }): this;
    emit(event: 'determineWinner', data: { quizId?: string, questionIndex: number }): this;
    emit(event: 'requestQuestion', data: { quizId: string; questionIndex: number; timestamp: number }): this;
    emit(event: 'readyForNextQuestion', data: { quizId: string; userId: string; questionIndex: number; timestamp: number }): this;

    // Custom events - on (add new ones)
    on(event: 'onlineUsers', callback: (users: OnlineUser[]) => void): this;
    on(event: 'userConnected', callback: (user: OnlineUser) => void): this;
    on(event: 'userDisconnected', callback: (userId: string) => void): this;
    on(event: 'playerEliminated', callback: (data: { userId: string, questionIndex: number, reason: string }) => void): this;
    on(event: 'playerAnswered', callback: (data: { userId: string, questionIndex: number, isCorrect: boolean | null }) => void): this;
    on(event: 'playerWin', callback: (data: { userId: string, username: string, questionIndex: number }) => void): this;
    on(event: 'gameOver', callback: (data: { winner: { userId: string, username: string } | null }) => void): this;
    on(event: 'winnerDetermined', callback: (data: { winner: { userId: string, username: string } | null }) => void): this;
    on(event: 'newQuestion', callback: (data: { question: any; questionIndex: number; totalQuestions: number }) => void): this;
    on(event: 'playerReady', callback: (data: { userId: string; questionIndex: number; username: string }) => void): this;
    
    // Standard socket.io events
    on(event: 'connect' | 'disconnect' | 'connect_error' | 'reconnect_attempt' | 'reconnect_failed' | 'error', 
       callback: (...args: any[]) => void): this;
  }
}

export interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private onlineUsers: OnlineUser[] = [];
  private onlineUsersSubject = new BehaviorSubject<OnlineUser[]>([]);
  private connectionSubscriptions: Subscription[] = [];
  
  // Subjects for custom events
  private winnerDeterminedSubject = new Subject<{ winner: { userId: string, username: string } | null }>();
  private playerWinSubject = new Subject<{ userId: string, username: string, questionIndex: number }>();
  private gameOverSubject = new Subject<{ winner: { userId: string, username: string } | null }>();
  private playerEliminatedSubject = new Subject<{ userId: string, questionIndex: number, reason: string }>();
  private playerAnsweredSubject = new Subject<{ userId: string, questionIndex: number, isCorrect: boolean | null }>();

  // Expose the socket connection status as an observable
  public connectionStatus$ = new BehaviorSubject<boolean>(false);

  constructor(private authService: AuthService) {
    // Initialize socket when the service is created
    this.connect();
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.onlineUsersSubject.complete();
    this.connectionStatus$.complete();
    
    // Complete all subjects
    this.winnerDeterminedSubject.complete();
    this.playerWinSubject.complete();
    this.gameOverSubject.complete();
    this.playerEliminatedSubject.complete();
    this.playerAnsweredSubject.complete();
  }

  private cleanup(): void {
    this.connectionSubscriptions.forEach(sub => sub.unsubscribe());
    this.connectionSubscriptions = [];
  }

  public connect(): void {
    this.disconnect();
    
    const token = this.authService.getToken();
    if (!token) {
      console.warn('No authentication token available');
      return;
    }
    
    try {
      this.socket = io(environment.wsUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'], // Add polling as fallback
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        forceNew: true
      });
      
      this.setupEventListeners();
      
      const connectionTimeout = setTimeout(() => {
        if (!this.socket?.connected) {
          console.warn('WebSocket connection timeout');
          this.disconnect();
        }
      }, 15000);
      
      this.socket.once('connect', () => {
        clearTimeout(connectionTimeout);
      });
      
    } catch (error) {
      console.error('Error initializing WebSocket connection:', error);
      this.connectionStatus$.next(false);
      this.cleanup();
    }
  }




  public emitRequestQuestion(data: { quizId: string; questionIndex: number }): void {
    this.emit('requestQuestion', {
      quizId: data.quizId,
      questionIndex: data.questionIndex,
      timestamp: Date.now()
    });
  }

  /**
   * Notify server that player is ready for next question
   */
  public emitReadyForNextQuestion(data: { quizId: string; userId: string; questionIndex: number }): void {
    this.emit('readyForNextQuestion', {
      quizId: data.quizId,
      userId: data.userId,
      questionIndex: data.questionIndex,
      timestamp: Date.now()
    });
  }

  /**
   * Listen for new questions from server
   */
  public onNewQuestion(): Observable<{ question: any; questionIndex: number; totalQuestions: number }> {
    return new Observable(observer => {
      if (!this.socket) {
        observer.error(new Error('Socket not initialized'));
        return;
      }

      const listener = (data: { question: any; questionIndex: number; totalQuestions: number }) => {
        console.log('📝 Received new question:', data.questionIndex);
        observer.next(data);
      };

      this.socket.on('newQuestion', listener);

      return () => {
        if (this.socket) {
          this.socket.off('newQuestion', listener);
        }
      };
    });
  }

  /**
   * Listen for player ready events
   */
  public onPlayerReady(): Observable<{ userId: string; questionIndex: number; username: string }> {
    return new Observable(observer => {
      if (!this.socket) {
        observer.error(new Error('Socket not initialized'));
        return;
      }

      const listener = (data: { userId: string; questionIndex: number; username: string }) => {
        observer.next(data);
      };

      this.socket.on('playerReady', listener);

      return () => {
        if (this.socket) {
          this.socket.off('playerReady', listener);
        }
      };
    });
  }




  public disconnect(): void {
    try {
      if (this.socket) {
        const socketToDisconnect = this.socket;
        socketToDisconnect.removeAllListeners();
        
        if (socketToDisconnect.connected) {
          socketToDisconnect.disconnect();
        }
        
        this.socket = null;
        this.connectionStatus$.next(false);
      }
    } catch (error) {
      console.error('Error disconnecting from WebSocket:', error);
    } finally {
      this.cleanup();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) {
      console.warn('Socket is not initialized');
      return;
    }
    
    // Clear any existing subscriptions
    this.connectionSubscriptions.forEach(sub => sub.unsubscribe());
    this.connectionSubscriptions = [];
  
    // Connection events
    const connectHandler = (): void => {
      console.log('✅ Connected to WebSocket server');
      this.connectionStatus$.next(true);
      this.socket?.emit('getOnlineUsers');
    };
    this.socket.on('connect', connectHandler);
    this.connectionSubscriptions.push(new Subscription(() => this.socket?.off('connect', connectHandler)));
  
    const disconnectHandler = (reason: string): void => {
      console.log(`❌ Disconnected from WebSocket server: ${reason}`);
      this.connectionStatus$.next(false);
    };
    this.socket.on('disconnect', disconnectHandler);
    this.connectionSubscriptions.push(new Subscription(() => this.socket?.off('disconnect', disconnectHandler)));
  
    const connectErrorHandler = (error: Error): void => {
      console.error('WebSocket connection error:', error);
      this.connectionStatus$.next(false);
    };
    this.socket.on('connect_error', connectErrorHandler);
    this.connectionSubscriptions.push(new Subscription(() => this.socket?.off('connect_error', connectErrorHandler)));
  
    // Application-specific events with proper typing
    const onlineUsersHandler = (users: OnlineUser[]): void => {
      if (Array.isArray(users)) {
        const validUsers = users.filter(user => user && user.userId && user.username);
        const usersChanged = validUsers.length !== this.onlineUsers.length ||
          validUsers.some((user, index) => 
            !this.onlineUsers[index] || 
            user.userId !== this.onlineUsers[index].userId
          );
          
        if (usersChanged) {
          this.onlineUsers = validUsers;
          this.onlineUsersSubject.next([...this.onlineUsers]);
          console.log('👥 Online users updated:', this.onlineUsers.length, 'users');
        }
      }
    };
    this.socket.on('onlineUsers', onlineUsersHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('onlineUsers', onlineUsersHandler))
    );

    // WINNER DETERMINED EVENT - CRITICAL FIX
    const winnerDeterminedHandler = (data: { winner: { userId: string, username: string } | null }) => {
      console.log('🎉 WINNER DETERMINED by server:', data);
      this.winnerDeterminedSubject.next(data);
    };
    this.socket.on('winnerDetermined', winnerDeterminedHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('winnerDetermined', winnerDeterminedHandler))
    );

    // PLAYER WIN EVENT
    const playerWinHandler = (data: { userId: string, username: string, questionIndex: number }) => {
      console.log('🏆 Player win event:', data.username);
      this.playerWinSubject.next(data);
    };
    this.socket.on('playerWin', playerWinHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('playerWin', playerWinHandler))
    );

    // GAME OVER EVENT
    const gameOverHandler = (data: { winner: { userId: string, username: string } | null }) => {
      console.log('🛑 Game over event:', data);
      this.gameOverSubject.next(data);
    };
    this.socket.on('gameOver', gameOverHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('gameOver', gameOverHandler))
    );

    // PLAYER ELIMINATED EVENT
    const playerEliminatedHandler = (data: { userId: string, questionIndex: number, reason: string }) => {
      console.log('❌ Player eliminated:', data.userId);
      this.playerEliminatedSubject.next(data);
    };
    this.socket.on('playerEliminated', playerEliminatedHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('playerEliminated', playerEliminatedHandler))
    );

    // PLAYER ANSWERED EVENT
    const playerAnsweredHandler = (data: { userId: string, questionIndex: number, isCorrect: boolean | null }) => {
      console.log('📝 Player answered:', data.userId, 'correct:', data.isCorrect);
      this.playerAnsweredSubject.next(data);
    };
    this.socket.on('playerAnswered', playerAnsweredHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('playerAnswered', playerAnsweredHandler))
    );
  }

  // Observable getters for custom events
  public onWinnerDetermined(): Observable<{ winner: { userId: string, username: string } | null }> {
    return this.winnerDeterminedSubject.asObservable();
  }

  public onPlayerWin(): Observable<{ userId: string, username: string, questionIndex: number }> {
    return this.playerWinSubject.asObservable();
  }

  public onGameOver(): Observable<{ winner: { userId: string, username: string } | null }> {
    return this.gameOverSubject.asObservable();
  }

  public onPlayerEliminated(): Observable<{ userId: string, questionIndex: number, reason: string }> {
    return this.playerEliminatedSubject.asObservable();
  }

  public onPlayerAnswered(): Observable<{ userId: string, questionIndex: number, isCorrect: boolean | null }> {
    return this.playerAnsweredSubject.asObservable();
  }

  public getOnlineUsers(): Observable<OnlineUser[]> {
    return this.onlineUsersSubject.asObservable();
  }
  
  public getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  public getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Generic method to listen to any event (fallback)
   */
  public onEvent<T = any>(eventName: string): Observable<T> {
    return new Observable<T>(subscriber => {
      if (!this.socket) {
        subscriber.error(new Error('Socket not initialized'));
        return;
      }

      const listener = (data: T) => {
        subscriber.next(data);
      };

      (this.socket as any).on(eventName, listener);

      return () => {
        if (this.socket) {
          (this.socket as any).off(eventName, listener);
        }
      };
    });
  }

  /**
   * Generic method to emit any event
   */
  public emit(eventName: string, data: any): void {
    if (this.socket?.connected) {
      console.log(`📤 Emitting ${eventName}:`, data);
      this.socket.emit(eventName, data);
    } else {
      console.warn(`⚠️ Cannot emit ${eventName}: Socket not connected`);
    }
  }

  // Specific emit methods with proper typing
  public emitPlayerEliminated(data: { userId: string, questionIndex: number, reason: string }): void {
    this.emit('playerEliminated', data);
  }

  public emitPlayerAnswered(data: { userId: string, questionIndex: number, isCorrect: boolean | null }): void {
    this.emit('playerAnswered', data);
  }

  public emitPlayerWin(data: { userId: string, username: string, questionIndex: number }): void {
    this.emit('playerWin', data);
  }

  public emitGameOver(data: { winner: { userId: string, username: string } | null }): void {
    this.emit('gameOver', data);
  }

  /**
   * Emit a determineWinner event
   */
  public emitDetermineWinner(data: { quizId?: string, questionIndex: number }): void {
    this.emit('determineWinner', {
      quizId: data.quizId || 'default-quiz',
      questionIndex: data.questionIndex,
      timestamp: Date.now()
    });
  }

  /**
   * Request the current list of online users from the server
   */
  public requestOnlineUsers(): void {
    if (this.socket?.connected) {
      this.socket.emit('getOnlineUsers');
    } else {
      console.warn('Cannot request online users: Socket not connected');
    }
  }
}