// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';
import { UnauthorizedException } from '@nestjs/common';
import { UserDocument } from '../user/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || '123456',
    });
  }

  async validate(payload: any) {
    console.log('JwtStrategy - Validating payload:', payload);
    
    if (!payload || !payload.sub) {
      console.error('JwtStrategy - Invalid payload: missing sub field');
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const user = await this.userService.findById(payload.sub);
      
      if (!user) {
        console.log('JwtStrategy - User not found for ID:', payload.sub);
        throw new UnauthorizedException('User not found');
      }

      // Log successful validation
      console.log('JwtStrategy - User validated successfully:', {
        userId: user._id,
        username: user.username,
        role: user.role
      });

      // Return consistent user object structure
      return {
        userId: user._id.toString(),
        username: user.username,
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        role: user.role || 'user',
        sub: user._id.toString()
      };
    } catch (error) {
      console.error('JwtStrategy - Validation error:', error);
      throw new UnauthorizedException('User validation failed');
    }
  }
}
