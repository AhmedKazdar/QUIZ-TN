import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface QuestionsResponse {
  message: string;
  questions: Question[];
}

export interface Question {
  _id: string;
  textequestion: string;
  type: string;
  options?: string[];
  correctAnswer?: number;
  category?: string;
  difficulty?: string;
  __v?: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuestionService {
  private apiUrl = `${environment.apiUrl}/api/question`;

  constructor(private http: HttpClient) {}

  getQuestions(limit: number = 10, category?: string, difficulty?: string): Observable<Question[]> {
    let params: any = { limit };
    if (category) params.category = category;
    if (difficulty) params.difficulty = difficulty;
    
    return this.http.get<QuestionsResponse>(`${this.apiUrl}/all`, { params })
      .pipe(
        map((response: QuestionsResponse) => {
          // Add mock options to each question
          return (response.questions || []).map(question => ({
            ...question,
            options: this.generateMockOptions(question.textequestion),
            correctAnswer: 0 // First option is always correct in this mock
          }));
        })
      );
  }

  private generateMockOptions(question: string): string[] {
    // This is a simple mock - in a real app, you'd want more sophisticated logic
    if (question.toLowerCase().includes('president')) {
      return [
        'Kais Saied',
        'Beji Caid Essebsi',
        'Moncef Marzouki',
        'Zine El Abidine Ben Ali'
      ];
    } else if (question.toLowerCase().includes('capital')) {
      if (question.includes('France')) {
        return ['Paris', 'London', 'Berlin', 'Madrid'];
      } else if (question.includes('Italy')) {
        return ['Rome', 'Milan', 'Venice', 'Naples'];
      } else if (question.includes('Sweden')) {
        return ['Stockholm', 'Oslo', 'Copenhagen', 'Helsinki'];
      } else if (question.includes('Portugal')) {
        return ['Lisbon', 'Porto', 'Madrid', 'Barcelona'];
      }
    } else if (question.includes('minutes')) {
      return ['10,080', '7,200', '14,400', '5,040'];
    } else if (question.includes('phone company')) {
      return ['Nokia', 'Samsung', 'Apple', 'Sony'];
    }

    // Default mock options
    return [
      'Option 1',
      'Option 2',
      'Option 3',
      'Option 4'
    ];
  }

  getQuestionById(id: string): Observable<Question> {
    return this.http.get<Question>(`${this.apiUrl}/${id}`);
  }
}
