import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, Subscription, throwError } from 'rxjs';
import { tap, timeout, catchError } from 'rxjs/operators';
import { SocketService, OnlineUser } from './socket.service';
import { filter, take } from 'rxjs/operators';

export interface AnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  _id: string;
  id: string;
  question: string;
  options: AnswerOption[];
  category?: string;
  difficulty?: string;
}

export interface QuizResult {
  _id?: string;
  userId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GameWinner {
  userId: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private currentQuiz: Question[] = [];
  private currentAnswers: (number | -1)[] = [];
  private quizStartTime = 0;
  private quizMode: 'practice' | 'online' = 'practice';
  private quizResult$ = new BehaviorSubject<QuizResult | null>(null);

  // WebSocket subscriptions for cleanup
  private socketSubscriptions: Subscription = new Subscription();

  // Online users tracking
  private onlineUsers$ = new BehaviorSubject<OnlineUser[]>([]);
  private connectionStatus$ = new BehaviorSubject<boolean>(false);

  constructor(private socketService: SocketService) {
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    // Monitor connection status changes
    const connectionSub = this.socketService.getConnectionStatus().subscribe((connected) => {
      this.connectionStatus$.next(connected);
    });

    // Monitor online users
    const usersSub = this.socketService.getOnlineUsers().subscribe((users) => {
      this.onlineUsers$.next(users || []);
    });

    // Listen for user connection events
    const userConnectedSub = this.socketService.onUserConnected().subscribe((user: OnlineUser) => {
      const currentUsers = this.onlineUsers$.value;
      if (!currentUsers.find(u => u.userId === user.userId)) {
        this.onlineUsers$.next([...currentUsers, user]);
      }
    });

    // Listen for user disconnection events
    const userDisconnectedSub = this.socketService.onUserDisconnected().subscribe((userId: string) => {
      const currentUsers = this.onlineUsers$.value;
      this.onlineUsers$.next(currentUsers.filter(user => user.userId !== userId));
    });

    this.socketSubscriptions.add(connectionSub);
    this.socketSubscriptions.add(usersSub);
    this.socketSubscriptions.add(userConnectedSub);
    this.socketSubscriptions.add(userDisconnectedSub);
  }

  getMockQuestions(count = 10): Observable<Question[]> {
    console.log('🎯 Using mock questions as fallback');
    
    const mockQuestions: Question[] = [
      {
        _id: '1',
        id: '1',
        question: 'What is the capital of France?',
        options: [
          { id: '1', text: 'London', isCorrect: false },
          { id: '2', text: 'Paris', isCorrect: true },
          { id: '3', text: 'Berlin', isCorrect: false },
          { id: '4', text: 'Madrid', isCorrect: false }
        ],
        category: 'Geography',
        difficulty: 'easy'
      },
      {
        _id: '2',
        id: '2',
        question: 'Which planet is known as the Red Planet?',
        options: [
          { id: '1', text: 'Earth', isCorrect: false },
          { id: '2', text: 'Mars', isCorrect: true },
          { id: '3', text: 'Jupiter', isCorrect: false },
          { id: '4', text: 'Venus', isCorrect: false }
        ],
        category: 'Science',
        difficulty: 'easy'
      },
      {
        _id: '3',
        id: '3',
        question: 'What is 2 + 2?',
        options: [
          { id: '1', text: '3', isCorrect: false },
          { id: '2', text: '4', isCorrect: true },
          { id: '3', text: '5', isCorrect: false },
          { id: '4', text: '6', isCorrect: false }
        ],
        category: 'Math',
        difficulty: 'easy'
      }
    ];
  
    // Return requested number of questions
    const questionsToReturn = mockQuestions.slice(0, count);
    return of(questionsToReturn);
  }

  startQuiz(mode: 'practice' | 'online' = 'practice', limit = 10): Observable<Question[]> {
    this.quizMode = mode;
    this.quizStartTime = Date.now();
    this.currentAnswers = [];

    if (mode === 'practice') {
      return this.getSoloQuestions(limit);
    }

    return this.getOnlineQuestions(limit);
  }

  emitRequestQuestions(data: { quizId: string; count: number; mode?: string }): void {
    this.socketService.emitRequestQuestions(data);
  }
  
  onQuestionsLoaded(): Observable<any> {
    return this.socketService.onQuestionsLoaded();
  }

  // WebSocket method for solo questions
  getSoloQuestions(count: number): Observable<Question[]> {
    return new Observable((observer) => {
      this.waitForSocketReady().pipe(
        timeout(20000),
        catchError((error: any) => {
          console.error('❌ Timeout waiting for solo questions:', error);
          return throwError(() => new Error('Questions request timed out. Please try again.'));
        })
      ).subscribe({
        next: (ready) => {
          if (ready) {
            console.log(`🎯 WebSocket ready, requesting ${count} solo questions`);
            this.requestSoloQuestions(count, observer);
          } else {
            observer.error(new Error('WebSocket connection failed'));
          }
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  private waitForSocketReady(): Observable<boolean> {
    return new Observable((observer) => {
      if (this.socketService.isConnected()) {
        console.log('✅ Socket already connected, checking authentication...');
        
        const authSub = this.socketService.onAuthenticationSuccess().pipe(
          timeout(5000),
          catchError(() => of(null))
        ).subscribe({
          next: (authData) => {
            console.log('✅ Authentication confirmed, socket is ready');
            observer.next(true);
            observer.complete();
          },
          error: (error) => {
            console.warn('⚠️ Auth check timeout, proceeding anyway');
            observer.next(true);
            observer.complete();
          }
        });
        
        setTimeout(() => {
          authSub.unsubscribe();
          observer.next(true);
          observer.complete();
        }, 1000);
        
      } else {
        console.log('🔄 Socket not connected, waiting for connection...');
        
        const connectionSub = this.socketService.getConnectionStatus().pipe(
          filter(connected => connected === true),
          timeout(10000),
          take(1)
        ).subscribe({
          next: (connected) => {
            if (connected) {
              console.log('✅ Socket connected, now checking authentication...');
              setTimeout(() => {
                observer.next(true);
                observer.complete();
              }, 500);
            }
          },
          error: (error) => {
            observer.error(new Error('Failed to establish WebSocket connection'));
          }
        });
      }
    });
  }
  
  private requestSoloQuestions(count: number, observer: any): void {
    console.log(`🎯 Requesting ${count} solo questions`);
    
    // Use the correct method for solo questions
    this.socketService.emitGetSoloQuestions(count);
    
    // Set up question subscription with timeout
    const questionsSub = this.socketService.onSoloQuestionsLoaded()
      .pipe(
        timeout(15000),
        catchError((error: any) => {
          console.error('❌ Timeout waiting for solo questions:', error);
          return throwError(() => new Error('Questions request timed out. Please try again.'));
        })
      )
      .subscribe({
        next: (data: any) => {
          console.log('✅ Received soloQuestionsLoaded event:', data);
          if (data?.questions?.length > 0) {
            this.currentQuiz = data.questions;
            this.currentAnswers = new Array(data.questions.length).fill(-1);
            observer.next(data.questions);
            observer.complete();
          } else {
            console.warn('❌ No questions received in the response');
            observer.error(new Error('No questions received from server'));
          }
        },
        error: (error: any) => {
          console.error('❌ Error in soloQuestionsLoaded subscription:', error);
          observer.error(error);
        }
      });
  
    const errorSub = this.socketService.onSoloQuestionsError()
      .subscribe((error: any) => {
        console.error('❌ Received soloQuestionsError event:', error);
        observer.error(new Error(error?.message || 'Failed to load questions'));
      });
  
    this.socketSubscriptions.add(questionsSub);
    this.socketSubscriptions.add(errorSub);
  }

  // WebSocket method for online questions
  getOnlineQuestions(count = 10): Observable<Question[]> {
    return new Observable((observer) => {
      if (!this.socketService.isConnected()) {
        observer.error(new Error('WebSocket not connected'));
        return;
      }

      const questionsSub = this.socketService.onQuestionsLoaded()
        .pipe(timeout(10000))
        .subscribe({
          next: (data: any) => {
            if (data.questions && Array.isArray(data.questions)) {
              this.currentQuiz = data.questions;
              this.currentAnswers = new Array(data.questions.length).fill(-1);
              observer.next(data.questions);
              observer.complete();
            } else {
              observer.error(new Error('Invalid online questions data received'));
            }
          },
          error: (error) => {
            observer.error(error);
          }
        });

      this.socketSubscriptions.add(questionsSub);

      // Emit the request
      this.socketService.emitRequestQuestions({
        quizId: 'online-quiz-' + Date.now(),
        count: count
      });

      return () => {
        this.socketSubscriptions.remove(questionsSub);
      };
    });
  }

  // Synchronized Quiz Methods
  createSynchronizedQuiz(quizId: string, questionCount: number): void {
    this.socketService.emitCreateSynchronizedQuiz(quizId, questionCount);
  }

  joinSynchronizedQuiz(quizId: string, userId: string): void {
    this.socketService.emitJoinSynchronizedQuiz(quizId, userId);
  }

  onSynchronizedQuizCreated(): Observable<any> {
    return this.socketService.onSynchronizedQuizCreated();
  }

  onSynchronizedQuizJoined(): Observable<any> {
    return this.socketService.onSynchronizedQuizJoined();
  }

  onPlayerJoined(): Observable<any> {
    return this.socketService.onPlayerJoined();
  }

  // Answer submission for synchronized quizzes
  submitSynchronizedAnswer(quizId: string, questionIndex: number, answerIndex: number): void {
    this.socketService.emitSubmitSynchronizedAnswer(quizId, questionIndex, answerIndex);
  }

  onSynchronizedAnswerResult(): Observable<any> {
    return this.socketService.onSynchronizedAnswerResult();
  }

  onPlayerAnsweredSynchronized(): Observable<any> {
    return this.socketService.onPlayerAnsweredSynchronized();
  }

  // Regular answer submission
  submitAnswer(data: { 
    questionId: string; 
    answerIndex: number;
    timeSpent: number;
    mode: 'solo' | 'online';
    quizId?: string;
    questionIndex?: number;
  }): void {
    this.socketService.emitSubmitAnswer(
      data.questionId,
      data.answerIndex,
      data.timeSpent,
      data.mode,
      data.quizId,
      data.questionIndex
    );
  }

  onAnswerResult(): Observable<any> {
    return this.socketService.onAnswerResult();
  }

  disconnectSocket(): void {
    this.socketService.disconnect();
  }

  private ensureSocketConnection(): Observable<boolean> {
    return new Observable((observer) => {
      if (this.socketService.isConnected()) {
        observer.next(true);
        observer.complete();
        return;
      }
  
      this.socketService.connect();
      
      const connectionSub = this.socketService.getConnectionStatus().pipe(
        timeout(10000)
      ).subscribe({
        next: (connected) => {
          if (connected) {
            observer.next(true);
            observer.complete();
          }
        },
        error: (error) => {
          observer.error(new Error('Failed to establish WebSocket connection'));
        }
      });
  
      return () => connectionSub.unsubscribe();
    });
  }

  // Socket connection methods
  connectSocket(): void {
    this.socketService.connect();
  }

  isSocketConnected(): boolean {
    return this.socketService.isConnected();
  }

  getSocketConnectionStatus(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }

  requestOnlineUsers(): void {
    this.socketService.requestOnlineUsers();
  }

  getOnlineUsers(): Observable<OnlineUser[]> {
    return this.onlineUsers$.asObservable();
  }

  // Authentication events
  onAuthenticationSuccess(): Observable<any> {
    return this.socketService.onAuthenticationSuccess();
  }

  onAuthenticationError(): Observable<any> {
    return this.socketService.onAuthenticationError();
  }

  onAuthenticationRequired(): Observable<any> {
    return this.socketService.onAuthenticationRequired();
  }

  // Game event listeners
  onNewQuestion(): Observable<any> {
    return this.socketService.onNewQuestion();
  }

  onWinnerDetermined(): Observable<any> {
    return this.socketService.onWinnerDetermined();
  }

  onPlayerEliminated(): Observable<any> {
    return this.socketService.onPlayerEliminated();
  }

  onPlayerAnswered(): Observable<any> {
    return this.socketService.onPlayerAnswered();
  }

  onPlayerWin(): Observable<any> {
    return this.socketService.onPlayerWin();
  }

  onGameOver(): Observable<any> {
    return this.socketService.onGameOver();
  }

  onPlayerReady(): Observable<any> {
    return this.socketService.onPlayerReady();
  }

  onConnectionDebug(): Observable<any> {
    return this.socketService.onConnectionDebug();
  }

  // Game event emitters
  emitPlayerAnswered(data: { userId: string; questionIndex: number; isCorrect: boolean }): void {
    this.socketService.emitPlayerAnswered(data);
  }

  emitDetermineWinner(data: { quizId: string; questionIndex: number }): void {
    this.socketService.emitDetermineWinner(data);
  }

  emitPlayerEliminated(data: { userId: string; questionIndex: number; reason: string }): void {
    this.socketService.emitPlayerEliminated(data);
  }

  emitPlayerWin(data: { userId: string; username: string; questionIndex: number }): void {
    this.socketService.emitPlayerWin(data);
  }

  emitGameOver(data: { winner: GameWinner }): void {
    this.socketService.emitGameOver(data);
  }

  emitReadyForNextQuestion(data: { quizId: string; userId: string; questionIndex: number }): void {
    this.socketService.emitReadyForNextQuestion(data);
  }

  emitRequestQuestion(data: { quizId: string; questionIndex: number }): void {
    this.socketService.emitRequestQuestion(data);
  }

  emitDebugConnection(): void {
    this.socketService.emitDebugConnection();
  }

  manualReconnect(): void {
    this.socketService.manualReconnect();
  }

  answerQuestion(index: number, selectedOption: number): void {
    if (index < 0 || index >= this.currentQuiz.length) return;
    this.currentAnswers[index] = selectedOption;
  }

  getAnswers(): (number | -1)[] {
    return [...this.currentAnswers];
  }

  getQuestion(index: number): Question | null {
    return this.currentQuiz[index] || null;
  }

  calculateScore(timeSpentSeconds: number): QuizResult {
    const total = this.currentQuiz.length || 0;
    const correct = this.currentQuiz.reduce((acc, q, i) => {
      const sel = this.currentAnswers[i];
      return acc + (sel !== null && sel !== -1 && q.options?.[sel]?.isCorrect ? 1 : 0);
    }, 0);

    const score = total ? Math.round((correct / total) * 100) : 0;

    const result: QuizResult = {
      userId: 'anonymous',
      score,
      correctAnswers: correct,
      totalQuestions: total,
      timeSpent: timeSpentSeconds
    };

    this.quizResult$.next(result);
    return result;
  }

  getQuizResult$(): Observable<QuizResult | null> {
    return this.quizResult$.asObservable();
  }

  reset(): void {
    this.currentQuiz = [];
    this.currentAnswers = [];
    this.quizStartTime = 0;
    this.quizMode = 'practice';
    this.quizResult$.next(null);
    this.socketSubscriptions.unsubscribe();
    this.socketSubscriptions = new Subscription();
    this.setupSocketListeners();
  }
}