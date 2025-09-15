import { UserService } from './user.service';
import { AuthService } from '../auth/auth.service';
import { InfobipOtpService } from '../infobip-otp/infobip-otp.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { OnlineGateway } from 'src/gateways/online.gateway';
export declare class UserController {
    private readonly userService;
    private readonly authService;
    private readonly infobipOtpService;
    private readonly jwtService;
    private readonly onlineGateway;
    constructor(userService: UserService, authService: AuthService, infobipOtpService: InfobipOtpService, jwtService: JwtService, onlineGateway: OnlineGateway);
    checkUsername(username: string): Promise<{
        exists: boolean;
    }>;
    checkEmail(email: string): Promise<{
        exists: boolean;
    }>;
    checkPhoneNumber(phoneNumber: string): Promise<{
        exists: boolean;
    }>;
    register(createUserDto: CreateUserDto): Promise<{
        message: string;
        user: {
            id: import("mongoose").Types.ObjectId;
            username: string;
            email: string | null | undefined;
            phoneNumber: string | undefined;
            role: string;
        };
        token: string;
    }>;
    completeRegistration(): Promise<{
        message: string;
    }>;
    initiatePhoneLogin(phoneNumberStr: string): Promise<{
        message: string;
    }>;
    verifyPhoneLogin(phoneNumber: string, otp: string): Promise<{
        access_token: string;
        username: string;
        role: string;
        userId: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        username: string;
        role: string;
        userId: string;
    }>;
    getCurrentUser(req: any): Promise<any>;
    updateUser(id: string, updateUserDto: CreateUserDto): Promise<{
        message: string;
        user: any;
    }>;
    getAllUsersLegacy(): Promise<{
        users: any[];
    }>;
    getOnlineUsers(): Promise<{
        message: string;
        onlineUsers: {
            username: string;
        }[];
    }>;
    getAllUsers(): Promise<{
        id: import("mongoose").Types.ObjectId;
        username: string;
        email: string | null | undefined;
        phoneNumber: string | undefined;
        role: string;
        isActive: boolean;
        lastActive: Date;
        createdAt: Date;
    }[]>;
    remove(id: string): Promise<{
        message: string;
    }>;
    resetPassword(resetPasswordDto: {
        username: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
}
