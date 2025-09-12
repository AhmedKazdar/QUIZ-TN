import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { InfobipOtpService } from '../infobip-otp/infobip-otp.service';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../user/user.schema';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { CreateUserDto } from '../user/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly infobipOtpService: InfobipOtpService,
  ) {}

  // Web App: Email/Password Login
  async login(username: string, password: string) {
    console.log(`[AuthService] Login attempt for username: ${username}`);
    
    try {
      if (!username || !password) {
        console.log('[AuthService] Missing username or password');
        throw new UnauthorizedException('Username and password are required');
      }

      // First try to find by username
      console.log(`[AuthService] Looking up user by username: ${username}`);
      let user = await this.userService.findByUsername(username);
      
      // If not found by username, try by email
      if (!user && username.includes('@')) {
        console.log(`[AuthService] User not found by username, trying email: ${username}`);
        user = await this.userService.findByEmail(username);
      }
      
      if (!user) {
        console.log(`[AuthService] User not found: ${username}`);
        throw new UnauthorizedException('Invalid username or password');
      }

      console.log(`[AuthService] Found user: ${user._id} (${user.username})`);

      if (!user.password) {
        console.log(`[AuthService] No password set for user: ${user._id}`);
        throw new UnauthorizedException(
          'No password set for this account. Please use password reset.',
        );
      }

      console.log('[AuthService] Verifying password...');
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log(`[AuthService] Password validation result: ${isPasswordValid}`);
      
      if (!isPasswordValid) {
        console.log(`[AuthService] Failed password attempt for user: ${user._id}`);
        throw new UnauthorizedException('Invalid username or password');
      }

      // Create consistent user data structure
      const userData = {
        userId: user._id.toString(),
        username: user.username,
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        role: user.role || 'user'
      };

      // Create JWT payload with only necessary claims
      const payload = {
        sub: user._id.toString(),
        username: user.username,
        role: user.role || 'user'
      };

      console.log('Generating token with payload:', payload);
      const token = this.jwtService.sign(payload);

      // Return both token and user data
      return {
        access_token: token,
        ...userData
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error; // Re-throw to be handled by the controller
    }
  }

  // Mobile App: Phone/OTP Login
  async verifyPhoneLogin(
    phoneNumber: string,
    otp: string,
  ): Promise<{
    access_token: string;
    username: string;
    role: string;
    userId: string;
  }> {
    let formattedPhone: string;
    try {
      const phone = parsePhoneNumberWithError(phoneNumber, 'TN');
      if (!phone.isValid()) {
        throw new Error('Invalid phone number');
      }
      formattedPhone = phone.format('E.164');
    } catch (error) {
      throw new UnauthorizedException(
        'Invalid phone number. Use +216 followed by 8 digits.',
      );
    }

    const isValid = await this.infobipOtpService.verifyOtp(formattedPhone, otp);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const user = await this.userService.findByPhoneNumber(formattedPhone);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = {
      phoneNumber: user.phoneNumber,
      email: user.email || '',
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      username: user.username,
      role: user.role,
      userId: user._id.toString(),
    };
  }

  // Admin User Creation (Web App)
  async createAdminUser(createUserDto: CreateUserDto) {
    if (createUserDto.role === 'admin' && !createUserDto.password) {
      throw new UnauthorizedException('Admin users must have a password');
    }
    // Hash password if provided (for web app)
    if (createUserDto.password) {
      createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
    }
    return this.userService.create(createUserDto);
  }
}
