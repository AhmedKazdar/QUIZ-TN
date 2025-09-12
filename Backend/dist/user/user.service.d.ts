import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { InfobipOtpService } from '../infobip-otp/infobip-otp.service';
import { ChangePasswordDto } from './dto/change-password.dto';
export declare class UserService {
    private userModel;
    private jwtService;
    private infobipOtpService;
    constructor(userModel: Model<UserDocument>, jwtService: JwtService, infobipOtpService: InfobipOtpService);
    findByPhoneNumber(phoneNumber: string): Promise<UserDocument | null>;
    private checkIfUserExists;
    create(createUserDto: CreateUserDto): Promise<{
        user: UserDocument;
        token: string;
        userId: string;
        username: string;
        role: string;
        email: string;
        phoneNumber: string;
    }>;
    initiateRegistration(createUserDto: CreateUserDto): Promise<void>;
    completeRegistration(createUserDto: CreateUserDto, otp: string): Promise<User>;
    findByUsername(username: string): Promise<UserDocument | null>;
    findByEmail(email: string): Promise<UserDocument | null>;
    findById(id: string): Promise<UserDocument | null>;
    getAllUsers(): Promise<UserDocument[]>;
    updateLastActive(userId: string): Promise<void>;
    changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    updateUser(id: string, updateUserDto: CreateUserDto): Promise<UserDocument>;
    deleteUser(id: string): Promise<{
        message: string;
    }>;
    findAll(): Promise<UserDocument[]>;
    login(loginDto: LoginDto): Promise<string>;
}
