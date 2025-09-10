import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginDto: {
        username: string;
        password: string;
    }): Promise<{
        access_token: string;
        username: string;
        role: string;
        userId: string;
    }>;
    createAdminUser(createUserDto: CreateUserDto): Promise<{
        user: import("../user/user.schema").UserDocument;
        token: string;
    }>;
}
