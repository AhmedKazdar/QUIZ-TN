import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';  // Fixed import path

export interface User {
  _id: string;
  username: string;
  phoneNumber: string;
  token?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl || 'http://localhost:3001';
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.currentUserSubject = new BehaviorSubject<User | null>(
      JSON.parse(localStorage.getItem('currentUser') || 'null')
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public isAuthenticated(): boolean {
    const user = this.currentUserValue;
    return !!(user && user.token);
  }

  register(phoneNumber: string, username?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/player/register`, { 
      phoneNumber, 
      username 
    }).pipe(
      catchError((error: any) => {
        console.error('[AuthService] Registration failed:', error);
        return throwError(() => error.error?.message || error.message || 'Registration failed');
      })
    );
  }

  // Verify OTP and complete registration
  verifyOtp(phoneNumber: string, otp: string, username?: string): Observable<any> {
    const payload: { phoneNumber: string; otp: string; username?: string } = { 
      phoneNumber, 
      otp,
      username
    };
    
    console.log('[AuthService] Sending verify-otp request with payload:', payload);
    
    return this.http.post(`${this.apiUrl}/api/player/verify-otp`, payload).pipe(
      tap((response: any) => {
        console.log('[AuthService] verify-otp response:', response);
        
        if (!response) {
          console.error('[AuthService] Empty response from server');
          throw new Error('Invalid server response');
        }
        
        if (response.success === false) {
          console.error('[AuthService] Server returned error:', response.message);
          throw new Error(response.message || 'Verification failed');
        }
        
        // Handle both 'user' and 'player' response formats
        const userData = response.user || response.player;
        if (userData && response.token) {
          const resolvedUsername = userData.username || username || '';
          const user: User = {
            _id: userData._id,
            username: resolvedUsername,
            phoneNumber: userData.phoneNumber || phoneNumber,
            token: response.token
          };
          
          console.log('[AuthService] Setting user in local storage:', user);
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
          console.log('[AuthService] User set in auth service');
        } else {
          console.error('[AuthService] Invalid response format - missing user/player or token:', response);
          throw new Error('Invalid response format from server');
        }
      }),
      catchError((error: any) => {
        console.error('[AuthService] OTP verification failed:', error);
        if (error.status === 0) {
          // Network error
          return throwError(() => new Error('Unable to connect to the server. Please check your internet connection.'));
        }
        return throwError(() => error.error?.message || error.message || 'OTP verification failed');
      })
    );
  }

  // Alias for verifyOtp
  login(phoneNumber: string, otp: string): Observable<any> {
    return this.verifyOtp(phoneNumber, otp);
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/home']);
  }

  getToken(): string | null {
    const user = this.currentUserValue;
    return user?.token || null;
  }
}