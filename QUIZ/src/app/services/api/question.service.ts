import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AnswerOption {
  text: string;
  isCorrect: boolean;
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

@Injectable({
  providedIn: 'root'
})
export class QuestionService {
  private apiUrl = `${environment.apiUrl}/api/quiz`;

  constructor(private http: HttpClient) {}

  /**
   * Shuffles an array using the Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  /**
   * Get all questions from the database
   */
  getAllQuestions(): Observable<Question[]> {
    return this.http.get<ApiResponse<Question[]>>(`${this.apiUrl}/all`).pipe(
      map((response: ApiResponse<Question[]>) => {
        if (!response.data || !Array.isArray(response.data)) {
          console.error('Invalid response format:', response);
          return [];
        }
        return response.data;
      }),
      catchError(error => {
        console.error('Error fetching all questions:', error);
        return of([]);
      })
    );
  }

  /**
   * Get limited number of random questions (for solo mode)
   */
  getQuestions(limit: number = 10): Observable<Question[]> {
    return this.getAllQuestions().pipe(
      map((questions: Question[]) => {
        if (!questions.length) {
          console.warn('No questions available');
          return [];
        }
  
        // ✅ FIX: Shuffle ALL questions first, then take the limit
        const shuffledQuestions = this.shuffleArray([...questions]); // Create a copy first
        const selectedQuestions = shuffledQuestions.slice(0, limit);
  
        return selectedQuestions.map(question => ({
          ...question,
          options: this.shuffleArray(question.options || [])
        }));
      }),
      catchError(error => {
        console.error('Error in getQuestions:', error);
        return of([]);
      })
    );
  }
  /**
   * Get a single random question (for online mode)
   */
  getSingleQuestion(): Observable<Question | null> {
    return this.getAllQuestions().pipe(
      map((questions: Question[]) => {
        if (!questions.length) {
          console.warn('No questions available');
          return null;
        }

        const randomQuestion = this.shuffleArray(questions)[0];
        return {
          ...randomQuestion,
          options: this.shuffleArray(randomQuestion.options || [])
        };
      }),
      catchError(error => {
        console.error('Error fetching single question:', error);
        return of(null);
      })
    );
  }

  /**
   * Get multiple random questions at once (alternative for online mode)
   */
  getRandomQuestions(count: number = 1): Observable<Question[]> {
    return this.getAllQuestions().pipe(
      map((questions: Question[]) => {
        if (!questions.length) {
          console.warn('No questions available');
          return [];
        }

        const shuffledQuestions = this.shuffleArray(questions);
        const selectedQuestions = shuffledQuestions.slice(0, count);

        return selectedQuestions.map(question => ({
          ...question,
          options: this.shuffleArray(question.options || [])
        }));
      }),
      catchError(error => {
        console.error('Error fetching random questions:', error);
        return of([]);
      })
    );
  }

  getQuestionById(id: string): Observable<Question> {
    return this.http.get<Question>(`${this.apiUrl}/${id}`).pipe(
      catchError(error => {
        console.error(`Error fetching question ${id}:`, error);
        throw error;
      })
    );
  }
}