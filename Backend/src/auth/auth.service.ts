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
    const user = await this.userService.findByUsername(username);
    if (!user) {
      console.log(`Login attempt with invalid username: ${username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      console.log(`No password set for username: ${username}`);
      throw new UnauthorizedException(
        'User has no password set. Use phone-based login.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`Failed password attempt for username: ${username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      phoneNumber: user.phoneNumber,
      email: user.email || '',
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    };
    console.log('Generating token with payload:', payload);
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      username: user.username,
      role: user.role,
      userId: user._id.toString(),
    };
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
