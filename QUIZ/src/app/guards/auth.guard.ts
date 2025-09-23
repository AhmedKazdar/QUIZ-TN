import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService, User } from '../services/auth.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> | boolean {
      
    const currentUser = this.authService.currentUserValue;
    
    if (currentUser?.token) {
      // User is logged in and has a valid token
      return true;
    }
    
    // Not logged in or token is missing
    this.router.navigate(['/register'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }
}
