import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface QuizTime {
  _id: string;
  time: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class QuizTimeService {
  private apiUrl = `${environment.apiUrl}/api/quiz-times`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders | null {
    // First validate the token
    const token = this.authService.getToken();
    if (!token || this.authService.isTokenExpired()) {
      console.warn('[QuizTimeService] No valid token available');
      return null;
    }

    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getActiveQuizTimes(): Observable<QuizTime[]> {
    const headers = this.getAuthHeaders();
    
    if (!headers) {
      console.warn('[QuizTimeService] Using mock data due to authentication issues');
      return this.getMockQuizTimes();
    }

    return this.http.get<QuizTime[]>(`${this.apiUrl}?activeOnly=true`, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('[QuizTimeService] Error fetching quiz times:', error);
        
        if (error.status === 401) {
          console.warn('[QuizTimeService] Authentication failed, using mock data');
          // Token might be invalid, try to refresh or use mock data
          return this.getMockQuizTimes();
        }
        
        return this.getMockQuizTimes();
      })
    );
  }

  // Mock data for development when API is not available
  private getMockQuizTimes(): Observable<QuizTime[]> {
    console.log('[QuizTimeService] Using mock quiz times');
    
    // Generate some reasonable quiz times for today
    const currentHour = new Date().getHours();
    const mockTimes: QuizTime[] = [];
    
    // Create quiz times around current time for demo
    for (let i = -1; i <= 3; i++) {
      const hour = (currentHour + i + 24) % 24;
      const time = `${hour.toString().padStart(2, '0')}:00`;
      mockTimes.push({
        _id: `mock-${i}`,
        time: time,
        isActive: true
      });
    }
    
    return of(mockTimes.sort((a, b) => a.time.localeCompare(b.time)));
  }

  // ... rest of your QuizTimeService methods remain the same
  isOnlineModeAvailable(): Observable<{ available: boolean; message: string; nextQuizTime?: string; timeUntilNext?: number }> {
    return new Observable(observer => {
      this.getActiveQuizTimes().subscribe({
        next: (quizTimes) => {
          console.log('[QuizTimeService] Quiz times received:', quizTimes);
          const result = this.calculateAvailability(quizTimes);
          observer.next(result);
          observer.complete();
        },
        error: (error) => {
          console.error('[QuizTimeService] Error checking availability:', error);
          // Use mock data if API fails
          this.getMockQuizTimes().subscribe(mockTimes => {
            const result = this.calculateAvailability(mockTimes);
            observer.next(result);
            observer.complete();
          });
        }
      });
    });
  }

  private calculateAvailability(quizTimes: QuizTime[]): { available: boolean; message: string; nextQuizTime?: string; timeUntilNext?: number } {
    const currentTime = new Date();
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeString = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;

    console.log('[QuizTimeService] Current time:', currentTimeString);

    // Find if current time matches any quiz time
    const matchingQuizTime = quizTimes.find(quizTime => {
      return quizTime.time === currentTimeString;
    });

    if (matchingQuizTime) {
      return { 
        available: true, 
        message: 'Online mode is available now!' 
      };
    } else {
      // Find the next available quiz time
      const nextQuizInfo = this.findNextQuizTime(quizTimes, currentTime);
      const message = nextQuizInfo.time 
        ? `Next online quiz at ${nextQuizInfo.time}`
        : 'No more quizzes scheduled for today';
      
      return { 
        available: false, 
        message,
        nextQuizTime: nextQuizInfo.time || undefined,
        timeUntilNext: nextQuizInfo.timeUntilNext || undefined
      };
    }
  }

  private findNextQuizTime(quizTimes: QuizTime[], currentTime: Date): { time: string | null; timeUntilNext: number | null } {
    const currentTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    const upcomingTimes = quizTimes
      .map(quizTime => {
        const [hours, minutes] = quizTime.time.split(':').map(Number);
        return {
          time: quizTime.time,
          totalMinutes: hours * 60 + minutes
        };
      })
      .filter(time => time.totalMinutes > currentTotalMinutes)
      .sort((a, b) => a.totalMinutes - b.totalMinutes);

    if (upcomingTimes.length > 0) {
      const nextTime = upcomingTimes[0];
      const timeUntilNext = nextTime.totalMinutes - currentTotalMinutes;
      console.log(`[QuizTimeService] Next quiz at ${nextTime.time}, in ${timeUntilNext} minutes`);
      return { time: nextTime.time, timeUntilNext };
    }
    
    console.log('[QuizTimeService] No upcoming quizzes found');
    return { time: null, timeUntilNext: null };
  }

  getTodaysSchedule(): Observable<{ times: string[]; nextTime: string | null; timeUntilNext: number | null }> {
    return new Observable(observer => {
      this.getActiveQuizTimes().subscribe({
        next: (quizTimes) => {
          const currentTime = new Date();
          const times = quizTimes.map(qt => qt.time).sort();
          const nextQuizInfo = this.findNextQuizTime(quizTimes, currentTime);

          observer.next({ 
            times, 
            nextTime: nextQuizInfo.time,
            timeUntilNext: nextQuizInfo.timeUntilNext
          });
          observer.complete();
        },
        error: (error) => {
          console.error('[QuizTimeService] Error getting schedule:', error);
          // Use mock data if API fails
          this.getMockQuizTimes().subscribe(mockTimes => {
            const currentTime = new Date();
            const times = mockTimes.map(qt => qt.time).sort();
            const nextQuizInfo = this.findNextQuizTime(mockTimes, currentTime);
            
            observer.next({ 
              times, 
              nextTime: nextQuizInfo.time,
              timeUntilNext: nextQuizInfo.timeUntilNext
            });
            observer.complete();
          });
        }
      });
    });
  }
}