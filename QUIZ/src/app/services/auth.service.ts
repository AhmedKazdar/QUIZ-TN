import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  id?: string;
  username?: string;
  phoneNumber: string;
  token?: string;
  // Add other user properties as needed
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
    this.currentUserSubject = new BehaviorSubject<any>(JSON.parse(localStorage.getItem('currentUser') || 'null'));
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue() {
    return this.currentUserSubject.value;
  }

  register(phoneNumber: string, username?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/player/register`, { phoneNumber, username });
  }

  verifyOtp(phoneNumber: string, otp: string, username?: string): Observable<User> {
    const payload: { phoneNumber: string; otp: string; username?: string } = { phoneNumber, otp };
    
    if (username) {
      payload.username = username;
    }
    
    return this.http.post<User>(`${this.apiUrl}/player/verify-otp`, payload)
      .pipe(
        tap((user: User) => {
          if (user?.token) {
            // Store user details and jwt token in local storage
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.currentUserSubject.next(user);
            
            // Navigate to home page after successful verification
            this.router.navigate(['/home']);
          }
        }),
        catchError((error: any) => {
          console.error('OTP verification failed:', error);
          return throwError(() => error);
        })
      );
  }

  logout() {
    // Remove user from local storage and set current user to null
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }
}
