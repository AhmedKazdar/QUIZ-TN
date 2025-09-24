import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SubmitResponseDto {
  userId: string;
  questionId: string;
  answer: number;
  isCorrect: boolean;
  timeSpent: number;
}

export interface UserResponse {
  _id: string;
  userId: string;
  questionId: string;
  answer: number;
  isCorrect: boolean;
  timeSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseStats {
  totalResponses: number;
  correctResponses: number;
  accuracy: number;
  averageTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResponseService {
  private apiUrl = `${environment.apiUrl}/response`;

  constructor(private http: HttpClient) {}

  submitResponse(response: SubmitResponseDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/submit`, response);
  }

  submitResponses(responses: SubmitResponseDto[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/submit-multiple`, { responses });
  }

  getUserResponses(userId: string): Observable<UserResponse[]> {
    return this.http.get<UserResponse[]>(`${this.apiUrl}/user/${userId}`);
  }

  getUserResponseStats(userId: string): Observable<ResponseStats> {
    return this.http.get<ResponseStats>(`${this.apiUrl}/stats/${userId}`);
  }
}
