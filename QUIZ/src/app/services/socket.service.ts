import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface OnlineUser {
  userId: string;
  username: string;
  socketId: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  private onlineUsers: OnlineUser[] = [];
  private onlineUsersSubject = new BehaviorSubject<OnlineUser[]>([]);
  private questionsLoadedSubject = new Subject<{ questions: any[], quizId: string, totalQuestions: number }>();
  private winnerDeterminedSubject = new Subject<{ winner: { userId: string, username: string } | null }>();
  private playerWinSubject = new Subject<{ userId: string, username: string, questionIndex: number }>();
  private gameOverSubject = new Subject<{ winner: { userId: string, username: string } | null }>();
  private playerEliminatedSubject = new Subject<{ userId: string, questionIndex: number, reason: string }>();
  private playerAnsweredSubject = new Subject<{ userId: string, questionIndex: number, isCorrect: boolean | null }>();
  private playerReadySubject = new Subject<{ userId: string, questionIndex: number, username: string }>();

  // NEW: Synchronized quiz subjects
  private synchronizedQuizCreatedSubject = new Subject<any>();
  private synchronizedQuizJoinedSubject = new Subject<any>();
  private synchronizedQuestionSubject = new Subject<any>();
  private synchronizedTimeUpdateSubject = new Subject<any>();
  private synchronizedAnswerResultSubject = new Subject<any>();
  private synchronizedWinnerSubject = new Subject<any>();
  private synchronizedQuizFinishedSubject = new Subject<any>();
  private playerJoinedSubject = new Subject<any>();
  private playerAnsweredSynchronizedSubject = new Subject<any>();

  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private subscriptions: Subscription[] = [];

  constructor(private authService: AuthService) {
    this.connect();
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.onlineUsersSubject.complete();
    this.questionsLoadedSubject.complete();
    this.winnerDeterminedSubject.complete();
    this.playerWinSubject.complete();
    this.gameOverSubject.complete();
    this.playerEliminatedSubject.complete();
    this.playerAnsweredSubject.complete();
    this.playerReadySubject.complete();
    
    // NEW: Complete synchronized subjects
    this.synchronizedQuizCreatedSubject.complete();
    this.synchronizedQuizJoinedSubject.complete();
    this.synchronizedQuestionSubject.complete();
    this.synchronizedTimeUpdateSubject.complete();
    this.synchronizedAnswerResultSubject.complete();
    this.synchronizedWinnerSubject.complete();
    this.synchronizedQuizFinishedSubject.complete();
    this.playerJoinedSubject.complete();
    this.playerAnsweredSynchronizedSubject.complete();
    
    this.connectionStatus$.complete();
  }

  connect(): void {
    this.disconnect();

    const token = this.authService?.getToken?.() || null;
    if (!token) {
      console.warn('[SocketService] No auth token, skipping socket connection');
      return;
    }

    this.socket = io(environment.wsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
    });

    this.setupListeners();
  }

  disconnect(): void {
    try {
      if (this.socket) {
        this.socket.removeAllListeners();
        if (this.socket.connected) this.socket.disconnect();
        this.socket = null;
        this.connectionStatus$.next(false);
      }
    } catch (err) {
      console.error('[SocketService] Disconnect error', err);
    }

    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[SocketService] connected');
      this.connectionStatus$.next(true);
      this.socket?.emit('getOnlineUsers');
    });

    this.socket.on('disconnect', (reason: any) => {
      console.log('[SocketService] disconnected:', reason);
      this.connectionStatus$.next(false);
    });

    this.socket.on('onlineUsers', (users: OnlineUser[]) => {
      if (!Array.isArray(users)) return;
      this.onlineUsers = users;
      this.onlineUsersSubject.next([...this.onlineUsers]);
    });

    this.socket.on('questionsLoaded', (data: any) => {
      console.log('[SocketService] questionsLoaded received:', data);
      this.questionsLoadedSubject.next(data);
    });

    // NEW: Synchronized quiz listeners
    this.socket.on('synchronizedQuizCreated', (data: any) => {
      console.log('[SocketService] synchronizedQuizCreated:', data);
      this.synchronizedQuizCreatedSubject.next(data);
    });

    this.socket.on('synchronizedQuizJoined', (data: any) => {
      console.log('[SocketService] synchronizedQuizJoined:', data);
      this.synchronizedQuizJoinedSubject.next(data);
    });

    this.socket.on('synchronizedQuestion', (data: any) => {
      console.log('[SocketService] synchronizedQuestion:', data.questionIndex);
      this.synchronizedQuestionSubject.next(data);
    });

    this.socket.on('synchronizedTimeUpdate', (data: any) => {
      this.synchronizedTimeUpdateSubject.next(data);
    });

    this.socket.on('synchronizedAnswerResult', (data: any) => {
      console.log('[SocketService] synchronizedAnswerResult:', data);
      this.synchronizedAnswerResultSubject.next(data);
    });

    this.socket.on('synchronizedWinner', (data: any) => {
      console.log('[SocketService] synchronizedWinner:', data);
      this.synchronizedWinnerSubject.next(data);
    });

    this.socket.on('synchronizedQuizFinished', (data: any) => {
      console.log('[SocketService] synchronizedQuizFinished:', data);
      this.synchronizedQuizFinishedSubject.next(data);
    });

    this.socket.on('playerJoined', (data: any) => {
      console.log('[SocketService] playerJoined:', data);
      this.playerJoinedSubject.next(data);
    });

    this.socket.on('playerAnsweredSynchronized', (data: any) => {
      console.log('[SocketService] playerAnsweredSynchronized:', data);
      this.playerAnsweredSynchronizedSubject.next(data);
    });

    // Existing events
    this.socket.on('winnerDetermined', (data: any) => this.winnerDeterminedSubject.next(data));
    this.socket.on('playerWin', (data: any) => this.playerWinSubject.next(data));
    this.socket.on('gameOver', (data: any) => this.gameOverSubject.next(data));
    this.socket.on('playerEliminated', (data: any) => this.playerEliminatedSubject.next(data));
    this.socket.on('playerAnswered', (data: any) => this.playerAnsweredSubject.next(data));
    this.socket.on('playerReady', (data: any) => this.playerReadySubject.next(data));

    this.socket.on('newQuestion', (data: any) => {
      console.debug('[SocketService] newQuestion', data?.questionIndex);
    });
  }

  // ========== SYNCHRONIZED QUIZ EMIT METHODS ==========

  emitCreateSynchronizedQuiz(payload: { quizId: string; questionCount: number }): void {
    console.log('[SocketService] Creating synchronized quiz:', payload);
    this.socket?.emit('createSynchronizedQuiz', { ...payload, timestamp: Date.now() });
  }

  emitJoinSynchronizedQuiz(payload: { quizId: string }): void {
    console.log('[SocketService] Joining synchronized quiz:', payload);
    this.socket?.emit('joinSynchronizedQuiz', { ...payload, timestamp: Date.now() });
  }

  emitStartSynchronizedQuiz(payload: { quizId: string }): void {
    console.log('[SocketService] Starting synchronized quiz:', payload);
    this.socket?.emit('startSynchronizedQuiz', { ...payload, timestamp: Date.now() });
  }

  emitNextSynchronizedQuestion(payload: { quizId: string }): void {
    console.log('[SocketService] Requesting next synchronized question:', payload);
    this.socket?.emit('nextSynchronizedQuestion', { ...payload, timestamp: Date.now() });
  }

  emitSubmitSynchronizedAnswer(payload: { quizId: string; questionIndex: number; answerIndex: number }): void {
    console.log('[SocketService] Submitting synchronized answer:', payload);
    this.socket?.emit('submitSynchronizedAnswer', { ...payload, timestamp: Date.now() });
  }

  // ========== EXISTING EMIT METHODS ==========

  emitRequestQuestion(payload: { quizId: string; questionIndex: number }): void {
    this.socket?.emit('requestQuestion', { ...payload, timestamp: Date.now() });
  }

  emitReadyForNextQuestion(payload: { quizId: string; userId: string; questionIndex: number }): void {
    this.socket?.emit('readyForNextQuestion', { ...payload, timestamp: Date.now() });
  }

  emitRequestQuestions(payload: { quizId: string; count: number }): void {
    this.socket?.emit('requestQuestions', { ...payload, timestamp: Date.now() });
  }

  emitPlayerAnswered(payload: { userId: string; questionIndex: number; isCorrect: boolean | null }): void {
    this.socket?.emit('playerAnswered', payload);
  }

  emitPlayerEliminated(payload: { userId: string; questionIndex: number; reason: string }): void {
    this.socket?.emit('playerEliminated', payload);
  }

  emitPlayerWin(payload: { userId: string; username: string; questionIndex: number }): void {
    this.socket?.emit('playerWin', payload);
  }

  emitGameOver(payload: { winner: { userId: string; username: string } | null }): void {
    this.socket?.emit('gameOver', payload);
  }

  emitDetermineWinner(payload: { quizId?: string; questionIndex: number }): void {
    this.socket?.emit('determineWinner', { ...(payload || {}), timestamp: Date.now() });
  }

  requestOnlineUsers(): void {
    this.socket?.emit('getOnlineUsers');
  }

  // ========== SYNCHRONIZED QUIZ OBSERVABLES ==========

  onSynchronizedQuizCreated(): Observable<any> {
    return this.synchronizedQuizCreatedSubject.asObservable();
  }

  onSynchronizedQuizJoined(): Observable<any> {
    return this.synchronizedQuizJoinedSubject.asObservable();
  }

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

  // ========== EXISTING OBSERVABLES ==========

  onQuestionsLoaded(): Observable<any> {
    return this.questionsLoadedSubject.asObservable();
  }

  onNewQuestion(): Observable<any> {
    return new Observable(observer => {
      if (!this.socket) {
        observer.error(new Error('Socket not connected'));
        return;
      }
      const listener = (data: any) => observer.next(data);
      this.socket.on('newQuestion', listener);
      return () => this.socket?.off('newQuestion', listener);
    });
  }

  onPlayerReady(): Observable<any> {
    return this.playerReadySubject.asObservable();
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
  
  onPlayerAnswered(): Observable<any> { 
    return this.playerAnsweredSubject.asObservable(); 
  }
  
  getOnlineUsers(): Observable<OnlineUser[]> { 
    return this.onlineUsersSubject.asObservable(); 
  }
  
  getConnectionStatus(): Observable<boolean> { 
    return this.connectionStatus$.asObservable(); 
  }
}