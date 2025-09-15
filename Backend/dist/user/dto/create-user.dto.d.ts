import { UserRole } from '../entities/user.entity';
export declare class CreateUserDto {
    username: string;
    email: string;
    phoneNumber: string;
    password: string;
    role?: UserRole;
}
