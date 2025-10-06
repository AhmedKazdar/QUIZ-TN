// src/auth/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // If there's an error or no user at all, throw unauthorized
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }

    // Check if user is marked as invalid (deleted user)
    if (user.isValid === false) {
      if (user.isDeleted) {
        throw new UnauthorizedException('Your account no longer exists. Please register again.');
      } else {
        throw new UnauthorizedException('Invalid user account');
      }
    }

    // Valid user, proceed
    return user;
  }
}