import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

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

  // NEW METHODS FOR TOKEN VALIDATION

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      // JWT tokens are in format: header.payload.signature
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= exp;
    } catch (error) {
      console.error('[AuthService] Error parsing token:', error);
      return true;
    }
  }

  forceLogoutWithMessage(message: string): void {
    console.warn('[AuthService] Force logout:', message);
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    
    // Show message to user
    alert(message);
    
    // Redirect to home
    this.router.navigate(['/home']);
  }

  validateToken(): Observable<boolean> {
    const token = this.getToken();
    
    if (!token) {
      console.warn('[AuthService] No token found');
      return of(false);
    }
  
    if (this.isTokenExpired()) {
      console.warn('[AuthService] Token is expired');
      this.forceLogoutWithMessage('Your session has expired. Please login again.');
      return of(false);
    }
  
    // For now, use local validation
    // You can call validateTokenWithServer() for server-side validation
    console.log('[AuthService] Token appears valid locally');
    return of(true);
  }

  // Refresh token if needed (you can implement this if your backend supports token refresh)
  refreshToken(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('No token available'));
    }

    return this.http.post(`${this.apiUrl}/api/player/refresh-token`, { token }).pipe(
      tap((response: any) => {
        if (response.token) {
          const currentUser = this.currentUserValue;
          if (currentUser) {
            const updatedUser: User = {
              ...currentUser,
              token: response.token
            };
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            this.currentUserSubject.next(updatedUser);
          }
        }
      }),
      catchError((error) => {
        console.error('[AuthService] Token refresh failed:', error);
        this.logout();
        return throwError(() => error);
      })
    );
  }

  // Get token expiration time
  getTokenExpiration(): Date | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Date(payload.exp * 1000);
    } catch (error) {
      console.error('[AuthService] Error getting token expiration:', error);
      return null;
    }
  }

  // Check if token will expire soon (within 5 minutes)
  isTokenExpiringSoon(minutes = 5): boolean {
    const expiration = this.getTokenExpiration();
    if (!expiration) return true;

    const now = new Date();
    const timeUntilExpiration = expiration.getTime() - now.getTime();
    return timeUntilExpiration <= (minutes * 60 * 1000);
  }
}