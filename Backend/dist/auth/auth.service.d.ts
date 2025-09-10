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
        access_token: string;
        username: string;
        role: string;
        userId: string;
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
    }>;
}
