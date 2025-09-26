import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, delay } from 'rxjs/operators';

export interface Question {
  _id: string;
  text: string;
  options: string[];
  correctAnswer: number;
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

export interface SubmitResponseDto {
  userId: string;
  questionId: string;
  answer: number;
  isCorrect: boolean;
  timeSpent: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private apiUrl = environment.apiUrl;
  private currentQuiz: Question[] = [];
  private currentAnswers: number[] = [];
  private quizStartTime: number = 0;
  private quizMode: 'practice' | 'online' = 'practice';
  private quizResult = new BehaviorSubject<QuizResult | null>(null);

  constructor(private http: HttpClient) {}

  // Fetch questions from the backend
  fetchQuestions(limit: number = 10): Observable<Question[]> {
    const params: any = { limit: limit.toString() };

    return this.http.get<Question[]>(`${this.apiUrl}/quiz`, { 
      params,
      withCredentials: true,
      headers: this.getHeaders()
    }).pipe(
      tap(questions => {
        this.currentQuiz = questions;
        this.currentAnswers = new Array(questions.length).fill(-1);
      }),
      catchError(error => {
        console.error('Error fetching questions:', error);
        return throwError(() => new Error('Failed to load questions. Please try again later.'));
      })
    );
  }

  // Submit a response to the backend
  submitResponse(response: SubmitResponseDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/quiz/submit`, response, {
      withCredentials: true,
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get quiz statistics
  getQuizStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/quiz/stats`, {
      withCredentials: true,
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Get a specific question
  getQuestionById(id: string): Observable<Question> {
    return this.http.get<Question>(`${this.apiUrl}/quiz/${id}`, {
      withCredentials: true,
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Submit the final quiz result
  submitQuizResult(result: Omit<QuizResult, '_id' | 'createdAt' | 'updatedAt'>): Observable<QuizResult> {
    return this.http.post<QuizResult>(`${this.apiUrl}/quiz/result`, result, {
      withCredentials: true,
      headers: this.getHeaders()
    }).pipe(
      tap(quizResult => this.quizResult.next(quizResult)),
      catchError(this.handleError)
    );
  }

  // Helper methods
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Get the current answers
  getAnswers(): number[] {
    return [...this.currentAnswers];
  }

  // Get the current question
  getQuestion(index: number): Question | null {
    return this.currentQuiz[index] || null;
  }
  // Get all questions
  getQuestions(): Question[] {
    return [...this.currentQuiz];
  }

  // Check if current time is within quiz time
  checkQuizTime(): Observable<{ canStart: boolean; nextQuizTime?: string; message?: string }> {
    return this.http.get<{canStart: boolean; nextQuizTime?: string; message?: string}>(`${this.apiUrl}/quiz-times/check`, {
      withCredentials: true,
      headers: this.getHeaders()
    }).pipe(
      catchError(error => {
        console.error('Error checking quiz time:', error);
        return of({ 
          canStart: false, 
          message: 'Unable to verify quiz time. Please try again later.' 
        });
      })
    );
  }

  // Calculate score for the current quiz
  calculateScore(timeSpent: number): Observable<QuizResult> {
    const correctAnswers = this.currentQuiz.reduce((count, question, index) => {
      return count + (this.currentAnswers[index] === question.correctAnswer ? 1 : 0);
    }, 0);

    const totalQuestions = this.currentQuiz.length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);

    const result: QuizResult = {
      userId: 'current-user-id', // This should be replaced with actual user ID
      score,
      correctAnswers,
      totalQuestions,
      timeSpent
    };

    if (this.quizMode === 'online') {
      return this.submitQuizResult(result);
    }

    return of(result);
  }

  // Start a new quiz
  startQuiz(mode: 'practice' | 'online'): Observable<Question[]> {
    this.quizMode = mode;
    this.quizStartTime = Date.now();
    this.currentAnswers = [];
    
    // For practice mode, we don't need to check quiz time
    if (mode === 'practice') {
      return this.fetchQuestions();
    }
    
    // For online mode, first check if it's quiz time
    return new Observable(observer => {
      this.checkQuizTime().subscribe({
        next: (result) => {
          if (result.canStart) {
            // If it's quiz time, fetch the questions
            this.fetchQuestions().subscribe({
              next: (questions) => {
                this.currentQuiz = questions;
                this.currentAnswers = new Array(questions.length).fill(-1);
                observer.next(questions);
                observer.complete();
              },
              error: (error) => {
                console.error('Error fetching questions:', error);
                observer.error(new Error('Failed to load quiz questions. Please try again later.'));
              }
            });
          } else {
            // If it's not quiz time, throw an error with the next available time
            const error = new Error(result.message || 'The quiz is not available at this time.');
            if (result.nextQuizTime) {
              error.message += ` Next quiz time: ${result.nextQuizTime}`;
            }
            observer.error(error);
          }
        },
        error: (error) => {
          console.error('Error checking quiz time:', error);
          observer.error(new Error('Unable to verify quiz time. Please try again later.'));
        }
      });
    });
  }

  // Get the quiz result as an observable
  getQuizResult(): Observable<QuizResult | null> {
    return this.quizResult.asObservable();
  }

  // Reset the quiz
  resetQuiz(): void {
    this.currentQuiz = [];
    this.currentAnswers = [];
    this.quizStartTime = 0;
    this.quizMode = 'practice';
    this.quizResult.next(null);
  }
}