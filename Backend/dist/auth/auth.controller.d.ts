import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginDto: {
        username: string;
        password: string;
    }): Promise<{
        userId: string;
        username: string;
        email: string;
        phoneNumber: string;
        role: string;
        access_token: string;
    }>;
    createAdminUser(createUserDto: CreateUserDto): Promise<{
        user: import("../user/user.schema").UserDocument;
        token: string;
        userId: string;
        username: string;
        role: string;
        email: string;
        phoneNumber: string;
    }>;
}
