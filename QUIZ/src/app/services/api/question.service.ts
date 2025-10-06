import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AnswerOption {
  text: string;
  isCorrect?: boolean; // optional when coming from some APIs
}

export interface Question {
  _id: string;
  question: string;
  options: AnswerOption[];
  createdBy?: string;
  responses?: string[];
  timesAnswered?: number;
  timesAnsweredCorrectly?: number;
  averageTimeSpent?: number;
  __v?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class QuestionService {
  private apiUrl = `${environment.apiUrl}/api/quiz`;

  constructor(private http: HttpClient) {}

  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  getAllQuestions(): Observable<Question[]> {
    return this.http.get<ApiResponse<Question[]>>(`${this.apiUrl}/all`).pipe(
      map((resp) => (resp && Array.isArray(resp.data) ? resp.data : [])),
      catchError(err => {
        console.error('[QuestionService] getAllQuestions error', err);
        return of([]);
      })
    );
  }

  getQuestions(limit = 10): Observable<Question[]> {
    return this.getAllQuestions().pipe(
      map((questions) => {
        if (!questions || !questions.length) return [];
        const shuffled = this.shuffleArray(questions);
        return shuffled.slice(0, limit).map(q => ({
          ...q,
          options: this.shuffleArray(q.options || [])
        }));
      }),
      catchError(err => {
        console.error('[QuestionService] getQuestions error', err);
        return of([]);
      })
    );
  }

  getSingleQuestion(): Observable<Question | null> {
    return this.getAllQuestions().pipe(
      map((questions) => {
        if (!questions || !questions.length) return null;
        const q = this.shuffleArray(questions)[0];
        return { ...q, options: this.shuffleArray(q.options || []) };
      }),
      catchError(err => {
        console.error('[QuestionService] getSingleQuestion error', err);
        return of(null);
      })
    );
  }

  getRandomQuestions(count = 1): Observable<Question[]> {
    return this.getAllQuestions().pipe(
      map((questions) => {
        if (!questions || !questions.length) return [];
        const shuffled = this.shuffleArray(questions);
        return shuffled.slice(0, count).map(q => ({
          ...q,
          options: this.shuffleArray(q.options || [])
        }));
      }),
      catchError(err => {
        console.error('[QuestionService] getRandomQuestions error', err);
        return of([]);
      })
    );
  }

  getQuestionById(id: string): Observable<Question | null> {
    if (!id) return of(null);
    return this.http.get<ApiResponse<Question>>(`${this.apiUrl}/${id}`).pipe(
      map(resp => resp?.data || null),
      catchError(err => {
        console.error(`[QuestionService] getQuestionById ${id} error`, err);
        return of(null);
      })
    );
  }
}
