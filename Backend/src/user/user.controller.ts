import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Put,
  Delete,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  Request,
  Req,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { InfobipOtpService } from '../infobip-otp/infobip-otp.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request as ExpressRequest } from 'express';
import * as bcrypt from 'bcrypt';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { OnlineGateway } from 'src/gateways/online.gateway';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly infobipOtpService: InfobipOtpService,
    private readonly jwtService: JwtService,
    private readonly onlineGateway: OnlineGateway,
  ) {}

  @Get('check-username')
  @ApiOperation({ summary: 'Check if username exists' })
  @ApiQuery({ name: 'username', required: true, type: String })
  @ApiOkResponse({ description: 'Returns if username exists' })
  async checkUsername(@Query('username') username: string) {
    if (!username) {
      throw new HttpException('Username is required', HttpStatus.BAD_REQUEST);
    }
    return this.userService.checkUsernameExists(username);
  }

  @Get('check-email')
  @ApiOperation({ summary: 'Check if email exists' })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiOkResponse({ description: 'Returns if email exists' })
  async checkEmail(@Query('email') email: string) {
    if (!email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }
    return this.userService.checkEmailExists(email);
  }

  @Get('check-phone')
  @ApiOperation({ summary: 'Check if phone number exists' })
  @ApiQuery({ name: 'phoneNumber', required: true, type: String })
  @ApiOkResponse({ description: 'Returns if phone number exists' })
  async checkPhoneNumber(@Query('phoneNumber') phoneNumber: string) {
    if (!phoneNumber) {
      throw new HttpException('Phone number is required', HttpStatus.BAD_REQUEST);
    }
    return this.userService.checkPhoneNumberExists(phoneNumber);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User registered successfully' })
  @ApiBadRequestResponse({ description: 'Invalid data provided' })
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      // Format phone number if provided
      if (createUserDto.phoneNumber) {
        try {
          const phoneNumber = parsePhoneNumberWithError(
            createUserDto.phoneNumber,
            'US',
          );
          createUserDto.phoneNumber = phoneNumber.format('E.164');
        } catch (error) {
          throw new HttpException(
            'Invalid phone number format',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // Create the user
      const { user, token } = await this.userService.create(createUserDto);
      
      return {
        message: 'User registered successfully',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
        token,
      };
    } catch (error) {
      console.error('Error in user registration:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Registration failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('register/verify')
  @ApiOperation({ summary: 'Legacy OTP verification endpoint (deprecated)' })
  @ApiCreatedResponse({ description: 'This endpoint is deprecated. Use /register instead.' })
  @ApiBadRequestResponse({ description: 'This endpoint is no longer supported' })
  async completeRegistration(): Promise<{ message: string }> {
    throw new HttpException(
      'This endpoint is no longer supported. Please use /register without OTP verification.',
      HttpStatus.GONE,
    );
  }

  @Post('login/phone')
  @ApiOperation({ summary: 'Initiate phone-based login by sending OTP' })
  @ApiCreatedResponse({ description: 'OTP sent successfully' })
  @ApiBadRequestResponse({ description: 'Invalid phone number' })
  async initiatePhoneLogin(
    @Body('phoneNumber') phoneNumberStr: string
  ): Promise<{ message: string }> {
    try {
      let formattedPhone: string;
      try {
        const phoneNumber = parsePhoneNumberWithError(phoneNumberStr, 'TN');
        if (!phoneNumber.isValid()) {
          throw new HttpException(
            'Invalid phone number. Use +216 followed by 8 digits.',
            HttpStatus.BAD_REQUEST,
          );
        }
        formattedPhone = phoneNumber.format('E.164');
      } catch (error) {
        throw new HttpException(
          'Invalid phone number. Use +216 followed by 8 digits.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const user = await this.userService.findByPhoneNumber(formattedPhone);
      if (!user) {
        throw new HttpException(
          'Phone number not registered',
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.infobipOtpService.sendOtp(formattedPhone);
      return { message: 'OTP sent successfully' };
    } catch (error) {
      console.error('Phone login initiation error:', error);
      throw new HttpException(
        error.message || 'Failed to initiate login',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('login/phone/verify')
  @ApiOperation({ summary: 'Verify OTP for phone-based login' })
  @ApiCreatedResponse({ description: 'Login successful' })
  @ApiBadRequestResponse({ description: 'Invalid OTP' })
  async verifyPhoneLogin(
    @Body('phoneNumber') phoneNumber: string,
    @Body('otp') otp: string
  ): Promise<{ access_token: string; username: string; role: string; userId: string }> {
    try {
      return await this.authService.verifyPhoneLogin(
        phoneNumber,
        otp
      );
    } catch (error) {
      console.error('Phone login verification error:', error);
      throw new HttpException(
        error.message || 'Failed to verify login',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Email/password login for web app' })
  @ApiCreatedResponse({ description: 'Login successful' })
  @ApiBadRequestResponse({ description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto
  ): Promise<{ access_token: string; username: string; role: string; userId: string }> {
    try {
      const token = await this.userService.login(loginDto);
      const user = await this.userService.findByUsername(loginDto.username);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
      }
      await this.userService.updateLastActive(user._id.toString());
      return {
        access_token: token,
        username: user.username,
        role: user.role,
        userId: user._id.toString(),
      };
    } catch (error) {
      console.error('Email login error:', error);
      throw new HttpException(
        error.message || 'Failed to login',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Returns the current user profile' })
  @ApiBadRequestResponse({ description: 'User not found' })
  async getCurrentUser(@Request() req) {
    try {
      const userId = req.user.userId;
      const user = await this.userService.findById(userId);
      
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      
      // Return only necessary user data (exclude sensitive info like password)
      const { password, ...result } = user.toObject();
      return result;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new HttpException(
        error.message || 'Failed to fetch user profile',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update user information' })
  @ApiOkResponse({ description: 'User updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid data provided' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<{ message: string; user: any }> {
    try {
      if (updateUserDto.phoneNumber) {
        const phoneNumber = parsePhoneNumberWithError(
          updateUserDto.phoneNumber,
          'TN',
        );
        if (!phoneNumber.isValid()) {
          throw new HttpException(
            'Invalid phone number. Use +216 followed by 8 digits.',
            HttpStatus.BAD_REQUEST,
          );
        }
        updateUserDto.phoneNumber = phoneNumber.format('E.164');
      }
      const updatedUser = await this.userService.updateUser(id, updateUserDto);
      await this.userService.updateLastActive(id);
      return { message: 'User updated successfully', user: updatedUser };
    } catch (error) {
      console.error('Update user error:', error);
      throw new HttpException(
        error.message || 'Failed to update user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // This endpoint is kept for backward compatibility but marked as deprecated
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users (deprecated, use /users/all instead)' })
  @ApiOkResponse({ description: 'List of users' })
  async getAllUsersLegacy(): Promise<{ users: any[] }> {
    try {
      const users = await this.userService.getAllUsers();
      return { users };
    } catch (error) {
      console.error('Get all users error:', error);
      throw new HttpException(
        error.message || 'Failed to retrieve users',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('online')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get list of online users' })
  @ApiOkResponse({ description: 'Online users retrieved successfully' })
  @ApiBadRequestResponse({ description: 'Failed to retrieve online users' })
  async getOnlineUsers() {
    try {
      const onlineUsers = this.onlineGateway
        .getOnlineUsers()
        .map((user) => ({
          username: user.username,
        }));
      console.log(
        'API /users/online response:',
        onlineUsers.map((u) => u.username),
      );
      return { message: 'Online users retrieved successfully', onlineUsers };
    } catch (error) {
      console.error('Get online users error:', error);
      throw new HttpException(
        error.message || 'Failed to retrieve online users',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('all')
  async getAllUsers() {
    console.log('GET /users/all endpoint hit');
    try {
      const users = await this.userService.findAll();
      console.log('Found users:', users.length);
      return users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.lastActive ? new Date().getTime() - new Date(user.lastActive).getTime() < 5 * 60 * 1000 : false,
        lastActive: user.lastActive,
        createdAt: user.createdAt
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new HttpException('Failed to fetch users', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiOkResponse({ description: 'User deleted successfully' })
  @ApiBadRequestResponse({ description: 'Invalid user ID' })
  async remove(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiOkResponse({ description: 'Password reset successfully' })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  async resetPassword(
    @Body() resetPasswordDto: { username: string; newPassword: string },
  ) {
    const user = await this.userService.findByUsername(resetPasswordDto.username);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Update the user's password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return { message: 'Password reset successfully' };
  }
}
