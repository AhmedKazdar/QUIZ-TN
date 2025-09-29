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
   * @param array The array to shuffle
   * @returns A new shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  getQuestions(limit: number = 10): Observable<Question[]> {
    return this.http.get<ApiResponse<Question[]>>(this.apiUrl, {
      params: { limit: limit.toString() }
    }).pipe(
      map((response: ApiResponse<Question[]>) => {
        if (!response.data || !Array.isArray(response.data)) {
          console.error('Invalid response format:', response);
          return [];
        }

        // Shuffle the array of questions
        const shuffledQuestions = this.shuffleArray(response.data);

        // For each question, shuffle its options
        return shuffledQuestions.map(question => ({
          ...question,
          options: this.shuffleArray(question.options || [])
        }));
      }),
      catchError(error => {
        console.error('Error fetching questions:', error);
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
