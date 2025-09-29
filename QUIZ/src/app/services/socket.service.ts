import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject, Subscription, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

// Define our custom event types
declare module 'socket.io-client' {
  interface Socket {
    // Custom events
    emit(event: 'getOnlineUsers', callback?: (users: OnlineUser[]) => void): this;
    emit(event: 'playerEliminated', data: { userId: string, questionIndex: number, reason: string }): this;
    emit(event: 'playerAnswered', data: { userId: string, questionIndex: number, isCorrect: boolean | null }): this;
    emit(event: 'playerWin', data: { userId: string, username: string, questionIndex: number }): this;
    emit(event: 'gameOver', data: { winner: { userId: string, username: string } | null }): this;

    on(event: 'onlineUsers', callback: (users: OnlineUser[]) => void): this;
    on(event: 'userConnected', callback: (user: OnlineUser) => void): this;
    on(event: 'userDisconnected', callback: (userId: string) => void): this;
    on(event: 'playerEliminated', callback: (data: { userId: string, questionIndex: number, reason: string }) => void): this;
    on(event: 'playerAnswered', callback: (data: { userId: string, questionIndex: number, isCorrect: boolean | null }) => void): this;
    on(event: 'playerWin', callback: (data: { userId: string, username: string, questionIndex: number }) => void): this;
    on(event: 'gameOver', callback: (data: { winner: { userId: string, username: string } | null }) => void): this;
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
  
  // Expose the socket connection status as an observable
  public connectionStatus$ = new BehaviorSubject<boolean>(false);
  constructor(private authService: AuthService) {
    // Initialize socket when the service is created
    this.connect();
  }


  ngOnDestroy(): void {
    // Ensure we disconnect and then complete subjects once
    this.disconnect();
    this.onlineUsersSubject.complete();
    this.connectionStatus$.complete();
  }


  private cleanup(): void {
    // Unsubscribe from all subscriptions
    this.connectionSubscriptions.forEach(sub => sub.unsubscribe());
    this.connectionSubscriptions = [];
    
    // Disconnect socket if connected
    
    // Do not complete subjects here; only in ngOnDestroy
  }

  public connect(): void {
    // Disconnect existing connection if any
    this.disconnect();
    
    
    const token = this.authService.getToken();
    if (!token) {
      console.warn('No authentication token available');
      return;
    }
    
    try {
      // Always create a new socket connection to ensure fresh state
      this.socket = io(environment.wsUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        auth: { token },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000, // 1 second
        reconnectionDelayMax: 3000, // 3 seconds
        timeout: 10000, // 10 seconds
        forceNew: true
      });
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!this.socket?.connected) {
          console.warn('WebSocket connection timeout');
          this.disconnect();
        }
      }, 15000); // 15 seconds timeout
      
      // Clear timeout on successful connection
      this.socket.once('connect', () => {
        clearTimeout(connectionTimeout);
      });
      
    } catch (error) {
      console.error('Error initializing WebSocket connection:', error);
      this.connectionStatus$.next(false);
      this.cleanup();
    }
  }

  public disconnect(): void {
    try {
      if (this.socket) {
        // Store a reference to the socket before nullifying it
        const socketToDisconnect = this.socket;
        
        // Remove all listeners to prevent memory leaks
        socketToDisconnect.removeAllListeners();
        
        // Disconnect if connected
        if (socketToDisconnect.connected) {
          socketToDisconnect.disconnect();
        }
        
        // Clean up
        this.socket = null;
        this.connectionStatus$.next(false);
      }
    } catch (error) {
      console.error('Error disconnecting from WebSocket:', error);
    } finally {
      // Ensure cleanup happens even if there's an error
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
      console.log('Connected to WebSocket server');
      this.connectionStatus$.next(true);
      
      // Request online users when connected
      this.socket?.emit('getOnlineUsers');
    };
    this.socket.on('connect', connectHandler);
    this.connectionSubscriptions.push(new Subscription(() => this.socket?.off('connect', connectHandler)));

    const disconnectHandler = (reason: string): void => {
      console.log(`Disconnected from WebSocket server: ${reason}`);
      // Don't clear online users on disconnect, just update status
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

    const reconnectAttemptHandler = (attemptNumber: number): void => {
      console.log(`Attempting to reconnect (${attemptNumber})...`);
    };
    this.socket.on('reconnect_attempt', reconnectAttemptHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('reconnect_attempt', reconnectAttemptHandler))
    );

    const reconnectFailedHandler = (): void => {
      console.error('Failed to reconnect to WebSocket server');
      this.connectionStatus$.next(false);
    };
    this.socket.on('reconnect_failed', reconnectFailedHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('reconnect_failed', reconnectFailedHandler))
    );

    // Application-specific events
    const onlineUsersHandler = (users: OnlineUser[]): void => {
      if (Array.isArray(users)) {
        // Filter out any invalid users
        const validUsers = users.filter(user => user && user.userId && user.username);
        
        // Only update if the list has actually changed
        const usersChanged = validUsers.length !== this.onlineUsers.length ||
          validUsers.some((user, index) => 
            !this.onlineUsers[index] || 
            user.userId !== this.onlineUsers[index].userId
          );
          
        if (usersChanged) {
          this.onlineUsers = validUsers;
          this.onlineUsersSubject.next([...this.onlineUsers]);
          
          if (environment.enableDebugLogging) {
            console.log('Online users updated:', this.onlineUsers);
          }
        }
      }
    };
    this.socket.on('onlineUsers', onlineUsersHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('onlineUsers', onlineUsersHandler))
    );

    const userConnectedHandler = (user: OnlineUser): void => {
      if (user?.userId && !this.onlineUsers.some(u => u.userId === user.userId)) {
        this.onlineUsers.push(user);
        this.onlineUsersSubject.next([...this.onlineUsers]);
        
        if (environment.enableDebugLogging) {
          console.log('User connected:', user);
        }
      }
    };
    this.socket.on('userConnected', userConnectedHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('userConnected', userConnectedHandler))
    );

    const userDisconnectedHandler = (userId: string): void => {
      const userIndex = this.onlineUsers.findIndex(u => u.userId === userId);
      if (userIndex > -1) {
        const disconnectedUser = this.onlineUsers[userIndex];
        this.onlineUsers.splice(userIndex, 1);
        this.onlineUsersSubject.next([...this.onlineUsers]);
        
        if (environment.enableDebugLogging) {
          console.log('User disconnected:', disconnectedUser);
        }
      }
    };
    this.socket.on('userDisconnected', userDisconnectedHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('userDisconnected', userDisconnectedHandler))
    );
    
    // Error handling
    const errorHandler = (error: any): void => {
      console.error('WebSocket error:', error);
      this.connectionStatus$.next(false);
      
      // Handle session expiration
      if (error?.message?.includes('Session expired') || error?.message?.includes('Unauthorized')) {
        console.warn('Session expired or unauthorized. Logging out...');
        // Delay the logout to prevent potential race conditions
        setTimeout(() => {
          this.authService.logout();
        }, 1000);
      }
    };
    this.socket.on('error', errorHandler);
    this.connectionSubscriptions.push(
      new Subscription(() => this.socket?.off('error', errorHandler))
    );
    
    // Handle authentication errors during connection
    this.socket.on('connect_error', (error: any) => {
      console.error('WebSocket connection error:', error);
      this.connectionStatus$.next(false);
      
      if (error?.message?.includes('Authentication error') || 
          error?.message?.includes('Session expired') ||
          error?.message?.includes('Unauthorized')) {
        console.warn('Authentication failed. Logging out...');
        setTimeout(() => {
          this.authService.logout();
        }, 1000);
      }
    });
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
  
  /**
   * Get the socket instance (readonly)
   */
  public getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Listen to custom socket events
   * @param eventName The name of the event to listen to
   * @returns Observable that emits when the event is received
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

      // Use type assertion to handle custom events
      (this.socket as any).on(eventName, listener);

      // Return cleanup function
      return () => {
        if (this.socket) {
          (this.socket as any).off(eventName, listener);
        }
      };
    });
  }

  /**
   * Emit a player eliminated event
   */
  public emitPlayerEliminated(data: { userId: string, questionIndex: number, reason: string }): void {
    if (this.socket?.connected) {
      this.socket.emit('playerEliminated', data);
    }
  }
/**
 * Emit a player answered event (isCorrect can be null to hide correctness)
 */
public emitPlayerAnswered(data: { userId: string, questionIndex: number, isCorrect: boolean | null }): void {
  if (this.socket?.connected) {
    this.socket.emit('playerAnswered', data);
  }
}

public emitPlayerWin(data: { userId: string, username: string, questionIndex: number }): void {
  if (this.socket?.connected) {
    this.socket.emit('playerWin', data);
  }
}

public emitGameOver(data: { winner: { userId: string, username: string } | null }): void {
  if (this.socket?.connected) {
    this.socket.emit('gameOver', data);
  }
}
  /**
   * Request the current list of online users from the server
   */
  public requestOnlineUsers(): void {
    if (this.socket?.connected) {
      this.socket.emit('getOnlineUsers');
    } else if (environment.enableDebugLogging) {
      console.warn('Cannot request online users: Socket not connected');
    }
  }
}
