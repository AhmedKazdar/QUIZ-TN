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
  category?: string;
  difficulty?: string;
}

export interface QuizResult {
  score: number;
  correctAnswers: number;
  total: number;  
  timeSpent: number;
  percentage?: number;
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

  // Get the current answers
  getAnswers(): number[] {
    return [...this.currentAnswers];
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Submit an answer for the current question
  submitAnswer(questionIndex: number, answerIndex: number): void {
    if (questionIndex >= 0 && questionIndex < this.currentQuiz.length) {
      this.currentAnswers[questionIndex] = answerIndex;
    }
  }

  // Fetch questions from the backend
  fetchQuestions(category?: string, difficulty?: string, limit: number = 10): Observable<Question[]> {
    const params: any = { limit: limit.toString() };
    if (category) params.category = category;
    if (difficulty) params.difficulty = difficulty;

    // Use mock data in development if configured
    if (!environment.production && environment.useMockData) {
      console.log('[DEV] Using mock questions');
      return of(this.mockQuestions).pipe(
        delay(300), // Simulate small network delay
        tap(questions => {
          this.currentQuiz = questions;
          this.currentAnswers = new Array(questions.length).fill(-1);
        })
      );
    }
    
    console.log(`Fetching questions from: ${this.apiUrl}/question`, 'with params:', params);
    
    return this.http.get<Question[]>(`${this.apiUrl}/question`, { 
      params,
      withCredentials: true,  // Important for sending cookies with CORS
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }).pipe(
      tap(questions => {
        if (environment.enableDebugLogging) {
          console.log('Received questions:', questions);
        }
        
        // If no questions received, use mock data in development
        if ((!questions || questions.length === 0) && !environment.production) {
          console.warn('No questions received, using mock data');
          questions = this.mockQuestions;
        }
        
        this.currentQuiz = questions;
        this.currentAnswers = new Array(questions.length).fill(-1);
      }),
      catchError(error => {
        console.error('Error fetching questions:', error);
        
        // In production, rethrow the error to be handled by the component
        if (environment.production) {
          return throwError(() => new Error('Failed to load questions. Please try again later.'));
        }
        
        // In development, use mock data as fallback
        console.warn('Using mock data due to error');
        this.currentQuiz = this.mockQuestions;
        this.currentAnswers = new Array(this.mockQuestions.length).fill(-1);
        return of(this.mockQuestions);
      })
    );
  }

  // Submit a response to the backend
  submitResponse(userId: string, questionId: string, answerIndex: number): Observable<any> {
    const url = `${this.apiUrl}/response/submit`;
    const payload = {
      userId,
      questionId,
      selectedOption: answerIndex
    };
    
    return this.http.post(url, payload).pipe(
      catchError(this.handleError)
    );
  }

  // Get the current question
  getQuestion(index: number): Question | null {
    return this.currentQuiz[index] || null;
  }

  // Get all questions
  getQuestions(): Question[] {
    return [...this.currentQuiz];
  }

  // Mock questions for development
  private mockQuestions: Question[] = [
    {
      _id: '1',
      text: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2,
      category: 'Geography',
      difficulty: 'easy'
    },
    {
      _id: '2',
      text: 'Which planet is known as the Red Planet?',
      options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      correctAnswer: 1,
      category: 'Science',
      difficulty: 'easy'
    },
    {
      _id: '3',
      text: 'What is the largest mammal in the world?',
      options: ['African Elephant', 'Blue Whale', 'Giraffe', 'Polar Bear'],
      correctAnswer: 1,
      category: 'Science',
      difficulty: 'medium'
    },
    {
      _id: '4',
      text: 'Which language is Angular written in?',
      options: ['Java', 'C#', 'TypeScript', 'Dart'],
      correctAnswer: 2,
      category: 'Programming',
      difficulty: 'easy'
    },
    {
      _id: '5',
      text: 'What is the result of 2 + 2 * 2?',
      options: ['6', '8', '4', '10'],
      correctAnswer: 0,
      category: 'Math',
      difficulty: 'easy'
    }
  ];

  // Start a new quiz
  startQuiz(mode: 'practice' | 'online', category?: string, difficulty?: string): Observable<Question[]> {
    this.quizMode = mode;
    this.quizStartTime = Date.now();
    this.currentAnswers = [];
    
    // For development, use mock data if API is not available
    if (!environment.production) {
      // Simulate API call with delay
      return of(this.mockQuestions).pipe(
        delay(500), // Simulate network delay
        tap(questions => {
          this.currentQuiz = questions;
          this.currentAnswers = new Array(questions.length).fill(-1);
        })
      );
    }

    // In production, use real API
    const params: any = { mode };
    if (category) params.category = category;
    if (difficulty) params.difficulty = difficulty;

    return this.http.get<Question[]>(`${this.apiUrl}/questions/quiz`, { params }).pipe(
      tap(questions => {
        this.currentQuiz = questions;
        this.currentAnswers = new Array(questions.length).fill(-1);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching questions, using mock data', error);
        // Fallback to mock data if API fails
        this.currentQuiz = this.mockQuestions;
        this.currentAnswers = new Array(this.mockQuestions.length).fill(-1);
        return of(this.mockQuestions);
      })
    );
  }


  // Calculate and return the quiz result
  calculateResult(): Observable<QuizResult> {
    if (this.quizMode === 'practice') {
      return this.calculatePracticeResult();
    } else {
      return this.submitOnlineQuiz();
    }
  }

  // Calculate result for practice mode
  private calculatePracticeResult(): Observable<QuizResult> {
    const timeSpent = Math.floor((Date.now() - this.quizStartTime) / 1000);
    let correct = 0;
    
    for (let i = 0; i < this.currentQuiz.length; i++) {
      if (this.currentAnswers[i] === this.currentQuiz[i].correctAnswer) {
        correct++;
      }
    }
    
    const scorePercent = Math.round((correct / this.currentQuiz.length) * 100);
    const result: QuizResult = {
      score: scorePercent,
      total: this.currentQuiz.length,
      correctAnswers: correct,
      timeSpent: timeSpent,
      percentage: scorePercent
    };
    
    this.quizResult.next(result);
    return of(result);
  }

  // Submit online quiz and get results
  private submitOnlineQuiz(): Observable<QuizResult> {
    const timeSpent = Math.floor((Date.now() - this.quizStartTime) / 1000);
    const payload = {
      responses: this.currentQuiz.map((q, i) => ({
        questionId: q._id,
        answer: this.currentAnswers[i],
        isCorrect: this.currentAnswers[i] === q.correctAnswer
      })),
      timeSpent
    };

    return this.http.post<{ score: number }>(`${this.apiUrl}/response/submit`, payload).pipe(
      map(response => {
        const result: QuizResult = {
          score: response.score,
          total: this.currentQuiz.length,
          correctAnswers: Math.round((response.score / 100) * this.currentQuiz.length),
          timeSpent,
          percentage: response.score
        };
        this.quizResult.next(result);
        return result;
      }),
      catchError(error => {
        console.error('Error submitting quiz:', error);
        // Fallback to practice mode calculation if online submission fails
        return this.calculatePracticeResult();
      })
    );
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
    this.quizResult.next(null);
  }
}
