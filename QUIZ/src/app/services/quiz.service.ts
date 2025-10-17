// quiz.service.ts
import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, Subscription, throwError } from 'rxjs';
import { tap, timeout, catchError } from 'rxjs/operators';
import { SocketService, OnlineUser } from './socket.service';
import { filter, take } from 'rxjs/operators';

export interface AnswerOption {
  id: string;
  text: string;
  isCorrect?: boolean; // Optional for online mode
}

export interface Question {
  _id?: string;
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
   timeSpent: number;
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

  // Sequential quiz state
  private sequentialQuizState = new BehaviorSubject<{
    quizId: string;
    currentQuestion: Question | null;
    questionIndex: number;
    totalQuestions: number;
    players: OnlineUser[];
    isHost: boolean;
  } | null>(null);

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

    // Sequential Quiz Listeners
    const sequentialQuizStartedSub = this.socketService.onSequentialQuizStarted().subscribe((data: any) => {
      this.sequentialQuizState.next({
        quizId: data.quizId,
        currentQuestion: null,
        questionIndex: -1,
        totalQuestions: data.totalQuestions,
        players: [data.host],
        isHost: true,
      });
    });

    const sequentialQuizJoinedSub = this.socketService.onSequentialQuizJoined().subscribe((data: any) => {
      this.sequentialQuizState.next({
        quizId: data.quizId,
        currentQuestion: null,
        questionIndex: data.currentQuestionIndex,
        totalQuestions: data.totalQuestions,
        players: data.players,
        isHost: false,
      });
    });

    const nextQuestionSub = this.socketService.onNextQuestion().subscribe((data: any) => {
      const currentState = this.sequentialQuizState.value;
      if (currentState && currentState.quizId === data.quizId) {
        this.sequentialQuizState.next({
          ...currentState,
          currentQuestion: data.question,
          questionIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
        });
      }
    });
    

    const playerJoinedSequentialSub = this.socketService.onPlayerJoinedSequential().subscribe((data: any) => {
      const currentState = this.sequentialQuizState.value;
      if (currentState) {
        this.sequentialQuizState.next({
          ...currentState,
          players: data.players,
        });
      }
    });

    // Fastest Winner Listener
    const fastestWinnerSub = this.socketService.onFastestWinnerDeclared().subscribe((data: any) => {
      console.log(' Fastest winner event received in QuizService:', data);
    });

    // Sequential Answer Result Listener
    const sequentialAnswerResultSub = this.socketService.onSequentialAnswerResult().subscribe((data: any) => {
      console.log(' Sequential answer result received:', data);
    });

    // Solo Answer Validation Result Listener - REMOVED component logic
    const soloAnswerValidationSub = this.socketService.onSoloAnswerValidation().subscribe((data: any) => {
      console.log(' Solo answer validation result received in QuizService:', data);
      // Just log the result - component will handle the actual logic
    });

    this.socketSubscriptions.add(connectionSub);
    this.socketSubscriptions.add(usersSub);
    this.socketSubscriptions.add(sequentialQuizStartedSub);
    this.socketSubscriptions.add(sequentialQuizJoinedSub);
    this.socketSubscriptions.add(nextQuestionSub);
    this.socketSubscriptions.add(playerJoinedSequentialSub);
    this.socketSubscriptions.add(fastestWinnerSub);
    this.socketSubscriptions.add(sequentialAnswerResultSub);
    this.socketSubscriptions.add(soloAnswerValidationSub);
  }

  // ========== SOLO ANSWER VALIDATION METHODS ==========

  /**
   * Submit solo answers to server for validation (for cheat prevention)
   */
  validateSoloAnswers(data: SoloAnswerValidationRequest): Observable<QuizResult> {
    return new Observable((observer) => {
      console.log(' Submitting solo answers for validation:', data);

      // Emit the validation request to the server
      this.socketService.emitValidateSoloAnswers(data);

      // Listen for the validation result
      const validationSub = this.socketService.onSoloAnswerValidation()
        .pipe(
          timeout(10000),
          catchError((error: any) => {
            console.error(' Timeout waiting for solo answer validation:', error);
            return throwError(() => new Error('Answer validation timed out'));
          })
        )
        .subscribe({
          next: (validationData: any) => {
            console.log(' Received solo answer validation result:', validationData);
            
            if (validationData && validationData.validated) {
              const result: QuizResult = {
                _id: validationData._id || `solo-result-${Date.now()}`,
                userId: data.userId,
                score: validationData.score || 0,
                correctAnswers: validationData.correctAnswers || 0,
                totalQuestions: validationData.totalQuestions || data.answers.length,
                timeSpent: data.timeSpent,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              observer.next(result);
              observer.complete();
            } else {
              observer.error(new Error('Invalid validation response from server'));
            }
          },
          error: (error: any) => {
            console.error(' Error in solo answer validation:', error);
            observer.error(error);
          }
        });

      this.socketSubscriptions.add(validationSub);
    });
  }

leaveQuizSession(quizId: string): Observable<any> {
  return new Observable(observer => {
    if (!this.socketService.isConnected()) {
      console.warn(' Socket not connected for leaveQuizSession');
      observer.next({ success: false, message: 'Socket not connected' });
      observer.complete();
      return;
    }

    console.log(` Leaving quiz session: ${quizId}`);
    
    // Emit the leave event to the backend
    this.socketService.emitLeaveQuizSession(quizId);
    
    // Clean up frontend state
    this.sequentialQuizState.next(null);
    
    // Return success immediately since we don't need to wait for backend response
    observer.next({ 
      success: true, 
      message: 'Successfully left quiz session',
      quizId: quizId
    });
    observer.complete();
  });
}

 onFastestWinnerDeclared(): Observable<any> {
  return this.socketService.onFastestWinnerDeclared();
}
  // ========== SEQUENTIAL QUIZ METHODS ==========

  // Add similar checks to all your WebSocket methods
  startSequentialQuiz(quizId: string, questionCount: number): void {
    if (!this.socketService.isConnected()) {
      console.error(' Cannot start sequential quiz - WebSocket not connected');
      return;
    }
    this.socketService.emitStartSequentialQuiz(quizId, questionCount);
  }


  joinSequentialQuiz(quizId: string): void {
    this.socketService.emitJoinSequentialQuiz(quizId);
  }

  requestNextQuestion(quizId: string): void {
    this.socketService.emitRequestNextQuestion(quizId);
  }

  submitSequentialAnswer(quizId: string, questionIndex: number, answerIndex: number, timeSpent: number): void {
    this.socketService.emitSubmitSequentialAnswer(quizId, questionIndex, answerIndex, timeSpent);
  }

  getSequentialQuizState(): Observable<any> {
    return this.sequentialQuizState.asObservable();
  }

  // ========== SEQUENTIAL QUIZ OBSERVABLES ==========

  onSequentialQuizStarted(): Observable<any> {
    return this.socketService.onSequentialQuizStarted();
  }

  onSoloQuestionsLoaded(): Observable<any> {
  return this.socketService.onSoloQuestionsLoaded();
}

onSoloQuestionsError(): Observable<any> {
  return this.socketService.onSoloQuestionsError();
}

onSoloAnswerValidation(): Observable<any> {
  return this.socketService.onSoloAnswerValidation();
}

  onSequentialQuizJoined(): Observable<any> {
    return this.socketService.onSequentialQuizJoined();
  }

  onNextQuestion(): Observable<any> {
    return this.socketService.onNextQuestion();
  }

  onSequentialAnswerResult(): Observable<any> {
    return this.socketService.onSequentialAnswerResult();
  }

  onPlayerJoinedSequential(): Observable<any> {
    return this.socketService.onPlayerJoinedSequential();
  }

  onPlayerAnsweredSequential(): Observable<any> {
    return this.socketService.onPlayerAnsweredSequential();
  }

  onSequentialQuizFinished(): Observable<any> {
    return this.socketService.onSequentialQuizFinished();
  }

  // ========== EXISTING METHODS (Keep for backward compatibility) ==========

  getMockQuestions(count = 10): Observable<Question[]> {
    console.log(' Using mock questions as fallback');
    
    const mockQuestions: Question[] = [
      {
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
      }
    ];
  
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

  private requestSoloQuestionsViaSocket(count: number, observer: any): void {
  console.log(` [Solo] Emitting getSoloQuestions for ${count} questions`);
  
  this.socketService.emitGetSoloQuestions(count);
  
  const questionsSub = this.socketService.onSoloQuestionsLoaded()
    .pipe(
      timeout(15000),
      catchError((error: any) => {
        console.error(' Timeout waiting for solo questions:', error);
        return throwError(() => new Error('Solo questions request timed out'));
      })
    )
    .subscribe({
      next: (data: any) => {
        console.log('Received soloQuestionsLoaded event:', data);
        if (data?.questions?.length > 0) {
          // Questions are already sanitized (no isCorrect) from backend
          this.currentQuiz = data.questions;
          this.currentAnswers = new Array(data.questions.length).fill(-1);
          observer.next(data.questions);
          observer.complete();
        } else {
          console.warn(' No questions received in solo response');
          observer.error(new Error('No questions received from server for solo mode'));
        }
      },
      error: (error: any) => {
        console.error(' Error in soloQuestionsLoaded subscription:', error);
        observer.error(error);
      }
    });

  const errorSub = this.socketService.onSoloQuestionsError()
    .subscribe((error: any) => {
      console.error('Received soloQuestionsError event:', error);
      observer.error(new Error(error?.message || 'Failed to load solo questions via WebSocket'));
    });

  this.socketSubscriptions.add(questionsSub);
  this.socketSubscriptions.add(errorSub);
}

submitSoloAnswer(quizId: string, questionIndex: number, answerIndex: number, timeSpent: number): void {
  console.log(` [Solo] Submitting answer via WebSocket:`, {
    quizId,
    questionIndex,
    answerIndex,
    timeSpent
  });
  
  this.socketService.emitSubmitSoloAnswer(quizId, questionIndex, answerIndex, timeSpent);
}

  getSoloQuestions(count: number): Observable<Question[]> {
    return new Observable(observer => {
      // Check connection first
      if (!this.socketService.isConnected()) {
        observer.error('WebSocket not connected');
        return;
      }

      const subscription = this.socketService.onSoloQuestionsLoaded().subscribe((data: any) => {
        if (data?.questions) {
          observer.next(data.questions);
          observer.complete();
          subscription.unsubscribe();
        }
      });

      this.socketService.emitGetSoloQuestions(count);
    });
  }



  private waitForSocketReady(): Observable<boolean> {
    return new Observable((observer) => {
      if (this.socketService.isConnected()) {
        console.log(' Socket already connected, checking authentication...');
        
        const authSub = this.socketService.onAuthenticationSuccess().pipe(
          timeout(5000),
          catchError(() => of(null))
        ).subscribe({
          next: (authData) => {
            console.log(' Authentication confirmed, socket is ready');
            observer.next(true);
            observer.complete();
          },
          error: (error) => {
            console.warn(' Auth check timeout, proceeding anyway');
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
        console.log(' Socket not connected, waiting for connection...');
        
        const connectionSub = this.socketService.getConnectionStatus().pipe(
          filter(connected => connected === true),
          timeout(10000),
          take(1)
        ).subscribe({
          next: (connected) => {
            if (connected) {
              console.log(' Socket connected, now checking authentication...');
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
    console.log(` Requesting ${count} solo questions`);
    
    this.socketService.emitGetSoloQuestions(count);
    
    const questionsSub = this.socketService.onSoloQuestionsLoaded()
      .pipe(
        timeout(15000),
        catchError((error: any) => {
          console.error('Timeout waiting for solo questions:', error);
          return throwError(() => new Error('Questions request timed out. Please try again.'));
        })
      )
      .subscribe({
        next: (data: any) => {
          console.log('Received soloQuestionsLoaded event:', data);
          if (data?.questions?.length > 0) {
            this.currentQuiz = data.questions;
            this.currentAnswers = new Array(data.questions.length).fill(-1);
            observer.next(data.questions);
            observer.complete();
          } else {
            console.warn(' No questions received in the response');
            observer.error(new Error('No questions received from server'));
          }
        },
        error: (error: any) => {
          console.error(' Error in soloQuestionsLoaded subscription:', error);
          observer.error(error);
        }
      });
  
    const errorSub = this.socketService.onSoloQuestionsError()
      .subscribe((error: any) => {
        console.error(' Received soloQuestionsError event:', error);
        observer.error(new Error(error?.message || 'Failed to load questions'));
      });
  
    this.socketSubscriptions.add(questionsSub);
    this.socketSubscriptions.add(errorSub);
  }

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
    this.sequentialQuizState.next(null);
    this.socketSubscriptions.unsubscribe();
    this.socketSubscriptions = new Subscription();
    this.setupSocketListeners();
  }
}