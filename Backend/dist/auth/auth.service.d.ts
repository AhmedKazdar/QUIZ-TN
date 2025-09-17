import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { InfobipOtpService } from '../infobip-otp/infobip-otp.service';
import { UserDocument } from '../user/user.schema';
import { CreateUserDto } from '../user/dto/create-user.dto';
export declare class AuthService {
    private readonly userService;
    private readonly jwtService;
    private readonly infobipOtpService;
    constructor(userService: UserService, jwtService: JwtService, infobipOtpService: InfobipOtpService);
    login(username: string, password: string): Promise<{
        userId: string;
        username: string;
        email: string;
        phoneNumber: string;
        role: import("../user/user.schema").UserRole;
        access_token: string;
    }>;
    verifyPhoneLogin(phoneNumber: string, otp: string): Promise<{
        access_token: string;
        username: string;
        role: string;
        userId: string;
    }>;
    createAdminUser(createUserDto: CreateUserDto): Promise<{
        user: UserDocument;
        token: string;
        userId: string;
        username: string;
        role: string;
        email: string;
        phoneNumber: string;
    }>;
}
