import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

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
  total: number;
  correctAnswers: number;
  incorrectAnswers: number;
  timeSpent: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private apiUrl = environment.apiUrl;
  private currentQuiz: Question[] = [];
  private currentAnswers: (number | null)[] = [];
  private quizStartTime: number = 0;
  private quizMode: 'practice' | 'online' = 'practice';
  private quizResult = new BehaviorSubject<QuizResult | null>(null);

  constructor(private http: HttpClient) {}

  // Start a new quiz
  startQuiz(mode: 'practice' | 'online', category?: string, difficulty?: string): Observable<Question[]> {
    this.quizMode = mode;
    this.quizStartTime = Date.now();
    this.currentAnswers = [];
    
    const params: any = { mode };
    if (category) params.category = category;
    if (difficulty) params.difficulty = difficulty;

    return this.http.get<Question[]>(`${this.apiUrl}/questions/quiz`, { params }).pipe(
      tap(questions => {
        this.currentQuiz = questions;
        this.currentAnswers = new Array(questions.length).fill(null);
        this.quizResult.next(null);
      })
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

  // Get the user's answers
  getAnswers(): (number | null)[] {
    return [...this.currentAnswers];
  }

  // Submit an answer for a question
  submitAnswer(questionIndex: number, answerIndex: number | null): void {
    if (questionIndex >= 0 && questionIndex < this.currentQuiz.length) {
      this.currentAnswers[questionIndex] = answerIndex;
    }
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
    
    const result: QuizResult = {
      score: Math.round((correct / this.currentQuiz.length) * 100),
      total: this.currentQuiz.length,
      correctAnswers: correct,
      incorrectAnswers: this.currentQuiz.length - correct,
      timeSpent: timeSpent
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
          incorrectAnswers: this.currentQuiz.length - Math.round((response.score / 100) * this.currentQuiz.length),
          timeSpent
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
