import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class RolesGuard {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the user from the request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log('User from request:', user); // Log the user object

    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    ); // Get roles metadata

    if (!requiredRoles) {
      return true; // If no roles are required, allow access
    }

    // Check if the user has the required roles
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Forbidden resource');
    }

    return true; // User has the required role
  }
}
