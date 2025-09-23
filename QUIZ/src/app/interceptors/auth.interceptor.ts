import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private toastr: ToastrService
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Get the auth token from local storage
    const token = localStorage.getItem('token');
    
    // Clone the request and add the authorization header if token exists
    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    // Handle the request and catch any errors
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized errors
        if (error.status === 401) {
          // Clear local storage and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          this.router.navigate(['/login']);
          this.toastr.error('Your session has expired. Please log in again.');
        }
        
        // Handle other error statuses
        let errorMessage = 'An error occurred';
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.statusText) {
          errorMessage = error.statusText;
        }
        
        this.toastr.error(errorMessage);
        return throwError(() => error);
      })
    );
  }
}
