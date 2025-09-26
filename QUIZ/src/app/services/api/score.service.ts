import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Score {
  _id: string;
  userId: string;
  score: number;
  rank?: number;
  totalUsers?: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
  correctAnswers: number;
  totalQuestions: number;
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root'
})
export class ScoreService {
  private apiUrl = `${environment.apiUrl}/scores`;

  constructor(private http: HttpClient) {}

  calculateScore(userId: string): Observable<Score> {
    return this.http.post<Score>(`${this.apiUrl}/calculate/${userId}`, {});
  }

  getUserRank(userId: string): Observable<{ rank: number; totalUsers: number }> {
    return this.http.get<{ rank: number; totalUsers: number }>(`${this.apiUrl}/rank/${userId}`);
  }

  saveScore(scoreData: {
    userId: string;
    score: number;
    correctAnswers: number;
    totalQuestions: number;
    timeSpent: number;
  }): Observable<Score> {
    return this.http.post<Score>(`${this.apiUrl}`, scoreData);
  }

  getLeaderboard(page: number = 1, limit: number = 10): Observable<LeaderboardResponse> {
    return this.http.get<LeaderboardResponse>(
      `${this.apiUrl}/leaderboard?page=${page}&limit=${limit}`
    );
  }

  getUserScores(userId: string): Observable<Score[]> {
    return this.http.get<Score[]>(`${this.apiUrl}/user/${userId}`);
  }
}
