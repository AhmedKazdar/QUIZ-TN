"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const user_service_1 = require("../user/user.service");
const infobip_otp_service_1 = require("../infobip-otp/infobip-otp.service");
const bcrypt = require("bcrypt");
const libphonenumber_js_1 = require("libphonenumber-js");
let AuthService = class AuthService {
    userService;
    jwtService;
    infobipOtpService;
    constructor(userService, jwtService, infobipOtpService) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.infobipOtpService = infobipOtpService;
    }
    async login(username, password) {
        console.log(`[AuthService] Login attempt for username: ${username}`);
        try {
            if (!username || !password) {
                console.log('[AuthService] Missing username or password');
                throw new common_1.UnauthorizedException('Username and password are required');
            }
            console.log(`[AuthService] Looking up user by username: ${username}`);
            let user = await this.userService.findByUsername(username);
            if (!user && username.includes('@')) {
                console.log(`[AuthService] User not found by username, trying email: ${username}`);
                user = await this.userService.findByEmail(username);
            }
            if (!user) {
                console.log(`[AuthService] User not found: ${username}`);
                throw new common_1.UnauthorizedException('Invalid username or password');
            }
            console.log(`[AuthService] Found user: ${user._id} (${user.username})`);
            if (!user.password) {
                console.log(`[AuthService] No password set for user: ${user._id}`);
                throw new common_1.UnauthorizedException('No password set for this account. Please use password reset.');
            }
            console.log('[AuthService] Verifying password...');
            const isPasswordValid = await bcrypt.compare(password, user.password);
            console.log(`[AuthService] Password validation result: ${isPasswordValid}`);
            if (!isPasswordValid) {
                console.log(`[AuthService] Failed password attempt for user: ${user._id}`);
                throw new common_1.UnauthorizedException('Invalid username or password');
            }
            const userData = {
                userId: user._id.toString(),
                username: user.username,
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                role: user.role || 'user'
            };
            const payload = {
                sub: user._id.toString(),
                username: user.username,
                role: user.role || 'user'
            };
            console.log('Generating token with payload:', payload);
            const token = this.jwtService.sign(payload);
            return {
                access_token: token,
                ...userData
            };
        }
        catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
    async verifyPhoneLogin(phoneNumber, otp) {
        let formattedPhone;
        try {
            const phone = (0, libphonenumber_js_1.parsePhoneNumberWithError)(phoneNumber, 'TN');
            if (!phone.isValid()) {
                throw new Error('Invalid phone number');
            }
            formattedPhone = phone.format('E.164');
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid phone number. Use +216 followed by 8 digits.');
        }
        const isValid = await this.infobipOtpService.verifyOtp(formattedPhone, otp);
        if (!isValid) {
            throw new common_1.UnauthorizedException('Invalid or expired OTP');
        }
        const user = await this.userService.findByPhoneNumber(formattedPhone);
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        const payload = {
            phoneNumber: user.phoneNumber,
            email: user.email || '',
            sub: user._id.toString(),
            username: user.username,
            role: user.role,
        };
        const token = this.jwtService.sign(payload);
        return {
            access_token: token,
            username: user.username,
            role: user.role,
            userId: user._id.toString(),
        };
    }
    async createAdminUser(createUserDto) {
        if (createUserDto.role === 'admin' && !createUserDto.password) {
            throw new common_1.UnauthorizedException('Admin users must have a password');
        }
        if (createUserDto.password) {
            createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
        }
        return this.userService.create(createUserDto);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService,
        jwt_1.JwtService,
        infobip_otp_service_1.InfobipOtpService])
], AuthService);
//# sourceMappingURL=auth.service.js.map