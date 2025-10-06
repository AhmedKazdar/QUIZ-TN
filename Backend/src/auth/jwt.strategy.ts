// src/auth/jwt.strategy.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || '123456',
    });
  }

  async validate(payload: any) {
    this.logger.log(`JwtStrategy - Validating payload for user: ${payload.sub}`);
    
    if (!payload || !payload.sub) {
      this.logger.error('JwtStrategy - Invalid payload: missing sub field');
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const user = await this.userService.findById(payload.sub);
      
      if (!user) {
        this.logger.warn(`JwtStrategy - User not found for ID: ${payload.sub}`);
        this.logger.warn('User was likely deleted from database but token still exists');
        
        // Instead of throwing an error, return a minimal user object
        // This allows the request to proceed but marks the user as invalid
        return {
          userId: payload.sub,
          username: payload.username || 'deleted_user',
          phoneNumber: payload.phoneNumber || '',
          role: payload.role || 'user',
          isValid: false,
          isDeleted: true,
          sub: payload.sub
        };
      }

      this.logger.log(`JwtStrategy - User validated successfully: ${user.username} (${user._id})`);

      // Return complete user object for valid users
      return {
        userId: user._id.toString(),
        username: user.username,
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        role: user.role || 'user',
        isValid: true,
        isDeleted: false,
        sub: user._id.toString()
      };
    } catch (error) {
      this.logger.error(`JwtStrategy - Validation error: ${error.message}`, error.stack);
      
      // For database errors, return an invalid user instead of throwing
      return {
        userId: payload.sub,
        username: payload.username || 'unknown',
        phoneNumber: payload.phoneNumber || '',
        role: payload.role || 'user',
        isValid: false,
        error: error.message,
        sub: payload.sub
      };
    }
  }
}