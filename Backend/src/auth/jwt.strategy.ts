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
    const user: UserDocument | null = await this.userService.findById(
      payload.sub,
    );
    if (!user) {
      console.log('JwtStrategy - User not found for ID:', payload.sub);
      throw new UnauthorizedException('User not found');
    }
    console.log('JwtStrategy - User found:', user);
    return {
      userId: user._id.toString(), // Convert ObjectId to string
      username: user.username,
      email: user.email,
      role: user.role,
      sub: user._id.toString(), // Convert ObjectId to string
    };
  }
}
