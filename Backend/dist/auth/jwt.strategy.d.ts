import { Strategy } from 'passport-jwt';
import { UserService } from '../user/user.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly userService;
    private readonly logger;
    constructor(userService: UserService);
    validate(payload: any): Promise<{
        userId: any;
        username: any;
        phoneNumber: any;
        role: any;
        isValid: boolean;
        isDeleted: boolean;
        sub: any;
        email?: undefined;
        error?: undefined;
    } | {
        userId: string;
        username: string;
        email: string;
        phoneNumber: string;
        role: import("../user/user.schema").UserRole;
        isValid: boolean;
        isDeleted: boolean;
        sub: string;
        error?: undefined;
    } | {
        userId: any;
        username: any;
        phoneNumber: any;
        role: any;
        isValid: boolean;
        error: any;
        sub: any;
        isDeleted?: undefined;
        email?: undefined;
    }>;
}
export {};
