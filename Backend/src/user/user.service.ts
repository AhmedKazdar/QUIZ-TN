import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from './user.schema';
import { UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { InfobipOtpService } from '../infobip-otp/infobip-otp.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private infobipOtpService: InfobipOtpService,
  ) {}

  async findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phoneNumber }).exec();
  }

  async checkUsernameExists(username: string): Promise<{ exists: boolean }> {
    const user = await this.userModel.findOne({ username }).select('_id').lean();
    return { exists: !!user };
  }

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    const user = await this.userModel.findOne({ email }).select('_id').lean();
    return { exists: !!user };
  }

  async checkPhoneNumberExists(phoneNumber: string): Promise<{ exists: boolean }> {
    const user = await this.userModel.findOne({ phoneNumber }).select('_id').lean();
    return { exists: !!user };
  }

  private async checkIfUserExists(createUserDto: CreateUserDto): Promise<void> {
    const { username, email, phoneNumber } = createUserDto;

    const existingUser = await this.userModel
      .findOne({
        $or: [
          { username: username || { $exists: false } },
          { email: email || { $exists: false } },
          { phoneNumber },
        ],
      })
      .exec();

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ConflictException('Username already exists');
      }
      if (existingUser.email === email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new ConflictException('Phone number already registered');
      }
    }
  }

  async create(createUserDto: CreateUserDto): Promise<{ 
    user: UserDocument; 
    token: string;
    userId: string;
    username: string;
    role: string;
    email: string;
    phoneNumber: string;
  }> {
    console.log('[UserService] Creating new user:', createUserDto.username);
    
    // Validate required fields
    if (!createUserDto.username) {
      throw new BadRequestException('Username is required');
    }
    
    if (!createUserDto.email) {
      throw new BadRequestException('Email is required');
    }
    
    if (!createUserDto.phoneNumber) {
      throw new BadRequestException('Phone number is required');
    }
    
    // Check if username already exists
    const existingUser = await this.userModel.findOne({ 
      username: createUserDto.username 
    }).exec();
    
    if (existingUser) {
      console.log(`[UserService] Username already exists: ${createUserDto.username}`);
      throw new ConflictException('Username already exists');
    }

    // Check if email already exists
    const emailUser = await this.userModel.findOne({ 
      email: createUserDto.email 
    }).exec();
    
    if (emailUser) {
      console.log(`[UserService] Email already exists: ${createUserDto.email}`);
      throw new ConflictException('Email already exists');
    }

    // Check if phone number already exists
    const phoneUser = await this.userModel.findOne({ 
      phoneNumber: createUserDto.phoneNumber 
    }).exec();
    
    if (phoneUser) {
      console.log(`[UserService] Phone number already exists: ${createUserDto.phoneNumber}`);
      throw new ConflictException('Phone number already exists');
    }

    // Password validation is handled by DTO, but we'll double-check here
    if (!createUserDto.password) {
      console.log('[UserService] Password is required');
      throw new BadRequestException('Password is required');
    }

    console.log('[UserService] Hashing password...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);
    console.log('[UserService] Password hashed successfully');

    const userData = {
      username: createUserDto.username,
      email: createUserDto.email,
      phoneNumber: createUserDto.phoneNumber,
      role: createUserDto.role || UserRole.USER,
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActive: new Date(),
    };

    console.log('[UserService] Creating user with data:', {
      ...userData,
      password: '***' // Don't log the actual password
    });

    const user = new this.userModel(userData);

    try {
      const savedUser = await user.save();
      console.log('[UserService] User created successfully:', savedUser._id);
      
      // Generate JWT token
      const payload = {
        sub: savedUser._id.toString(),
        username: savedUser.username,
        role: savedUser.role || 'user'
      };
      
      console.log('[UserService] Generating JWT token with payload:', payload);
      const token = this.jwtService.sign(payload);
      
      return { 
        user: savedUser, 
        token,
        userId: savedUser._id.toString(),
        username: savedUser.username,
        role: savedUser.role || 'user',
        email: savedUser.email || '',
        phoneNumber: savedUser.phoneNumber || ''
      };
    } catch (error) {
      console.error('[UserService] Error saving user:', error);
      throw new BadRequestException('Failed to create user');
    }
  }

  async initiateRegistration(createUserDto: CreateUserDto): Promise<void> {
    console.log('Initiate registration with:', createUserDto);
    const existingUser = await this.userModel
      .findOne({ phoneNumber: createUserDto.phoneNumber })
      .exec();
    if (existingUser) {
      throw new HttpException(
        'Phone number already registered',
        HttpStatus.BAD_REQUEST,
      );
    }
    console.log('Storing user data for OTP verification:', createUserDto);
  }

  async completeRegistration(
    createUserDto: CreateUserDto,
    otp: string,
  ): Promise<User> {
    console.log('completeRegistration called with:', { createUserDto, otp });

    const existingUser = await this.userModel
      .findOne({ phoneNumber: createUserDto.phoneNumber })
      .exec();
    if (existingUser) {
      throw new HttpException(
        'Phone number already registered',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!createUserDto.phoneNumber) {
      throw new BadRequestException('Phone number is required for OTP verification');
    }
    
    const isValid = await this.infobipOtpService.verifyOtp(
      createUserDto.phoneNumber,
      otp,
    );
    console.log('OTP verification result:', {
      isValid,
      phone: createUserDto.phoneNumber,
      otp,
    });
    if (!isValid) {
      throw new HttpException('Invalid or expired OTP', HttpStatus.BAD_REQUEST);
    }

    const hashedPassword = createUserDto.password
      ? await bcrypt.hash(createUserDto.password, 10)
      : undefined;
    const user = new this.userModel({
      phoneNumber: createUserDto.phoneNumber,
      username: createUserDto.username || 'temp',
      role: createUserDto.role || 'user',
      email: createUserDto.email,
      password: hashedPassword,
      lastActive: new Date(),
    });
    console.log('Saving user to MongoDB:', user);
    try {
      const savedUser = await user.save();
      console.log('User saved successfully:', savedUser);
      return savedUser;
    } catch (error) {
      console.error('Error saving user:', error);
      throw new HttpException(
        'Failed to save user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async getAllUsers(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async updateLastActive(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { lastActive: new Date() }, { new: true })
      .exec();
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword } = changePasswordDto;
    console.log(
      'Service - changePassword - userId:',
      userId,
      'DTO:',
      changePasswordDto,
    );

    const user = await this.userModel.findById(userId).exec();
    console.log('Service - User found:', user);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('User has no password set');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    console.log('Service - Old password valid:', isPasswordValid);
    if (!isPasswordValid) {
      throw new BadRequestException('Incorrect old password');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from old password',
      );
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    user.lastActive = new Date();
    await user.save();

    console.log('Service - Updated user password hash:', user.password);
    console.log('Service - Password updated for user:', userId);
    return { message: 'Password updated successfully' };
  }

  async updateUser(
    id: string,
    updateUserDto: CreateUserDto,
  ): Promise<UserDocument> {
    const hashedPassword = updateUserDto.password
      ? await bcrypt.hash(updateUserDto.password, 10)
      : undefined;
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          phoneNumber: updateUserDto.phoneNumber,
          username: updateUserDto.username,
          role: updateUserDto.role,
          email: updateUserDto.email,
          password: hashedPassword,
          lastActive: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!updatedUser) {
      throw new UnauthorizedException('User not found');
    }

    return updatedUser;
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    const deletedUser = await this.userModel.findByIdAndDelete(id).exec();

    if (!deletedUser) {
      throw new UnauthorizedException('User not found');
    }

    return { message: 'User deleted successfully' };
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().select('-password -refreshToken').exec();
  }

  async login(loginDto: LoginDto): Promise<string> {
    const { username, password } = loginDto;
    
    console.log(`Login attempt for username: ${username}`); // Log the username being searched for
    
    // Find user by username (case-insensitive)
    const user = await this.userModel.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    }).exec();
    
    // Log all users in the database for debugging
    const allUsers = await this.userModel.find({}).select('username').lean();
    console.log('All users in database:', allUsers.map(u => u.username));
    
    if (!user) {
      console.log(`User not found: ${username}`); // Log when user is not found
      throw new UnauthorizedException('Invalid username or password');
    }
    
    console.log(`User found:`, { 
      id: user._id, 
      username: user.username, 
      hasPassword: !!user.password 
    });
    
    // Check if user has a password set
    if (!user.password) {
      throw new UnauthorizedException(
        'No password set for this account. Please use password reset.',
      );
    }
    
    // Verify password
    console.log('Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`Password validation result: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      console.log('Password validation failed');
      throw new UnauthorizedException('Invalid username or password');
    }
    
    // Update last active timestamp
    await this.updateLastActive(user._id.toString());
    
    // Generate JWT token
    const payload = {
      username: user.username,
      sub: user._id.toString(),
      role: user.role,
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
    };
    
    return this.jwtService.sign(payload);
  }
}
