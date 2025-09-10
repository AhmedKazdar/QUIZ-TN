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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("./user.service");
const auth_service_1 = require("../auth/auth.service");
const infobip_otp_service_1 = require("../infobip-otp/infobip-otp.service");
const jwt_1 = require("@nestjs/jwt");
const create_user_dto_1 = require("./dto/create-user.dto");
const login_dto_1 = require("./dto/login.dto");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const swagger_1 = require("@nestjs/swagger");
const libphonenumber_js_1 = require("libphonenumber-js");
const online_gateway_1 = require("../gateways/online.gateway");
let UserController = class UserController {
    userService;
    authService;
    infobipOtpService;
    jwtService;
    onlineGateway;
    constructor(userService, authService, infobipOtpService, jwtService, onlineGateway) {
        this.userService = userService;
        this.authService = authService;
        this.infobipOtpService = infobipOtpService;
        this.jwtService = jwtService;
        this.onlineGateway = onlineGateway;
    }
    async register(createUserDto) {
        try {
            if (createUserDto.phoneNumber) {
                try {
                    const phoneNumber = (0, libphonenumber_js_1.parsePhoneNumberWithError)(createUserDto.phoneNumber, 'US');
                    createUserDto.phoneNumber = phoneNumber.format('E.164');
                }
                catch (error) {
                    throw new common_1.HttpException('Invalid phone number format', common_1.HttpStatus.BAD_REQUEST);
                }
            }
            const { user, token } = await this.userService.create(createUserDto);
            return {
                message: 'User registered successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: user.role,
                },
                token,
            };
        }
        catch (error) {
            console.error('Error in user registration:', error);
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException(error.message || 'Registration failed', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async completeRegistration() {
        throw new common_1.HttpException('This endpoint is no longer supported. Please use /register without OTP verification.', common_1.HttpStatus.GONE);
    }
    async initiatePhoneLogin(phoneNumberStr) {
        try {
            let formattedPhone;
            try {
                const phoneNumber = (0, libphonenumber_js_1.parsePhoneNumberWithError)(phoneNumberStr, 'TN');
                if (!phoneNumber.isValid()) {
                    throw new common_1.HttpException('Invalid phone number. Use +216 followed by 8 digits.', common_1.HttpStatus.BAD_REQUEST);
                }
                formattedPhone = phoneNumber.format('E.164');
            }
            catch (error) {
                throw new common_1.HttpException('Invalid phone number. Use +216 followed by 8 digits.', common_1.HttpStatus.BAD_REQUEST);
            }
            const user = await this.userService.findByPhoneNumber(formattedPhone);
            if (!user) {
                throw new common_1.HttpException('Phone number not registered', common_1.HttpStatus.BAD_REQUEST);
            }
            await this.infobipOtpService.sendOtp(formattedPhone);
            return { message: 'OTP sent successfully' };
        }
        catch (error) {
            console.error('Phone login initiation error:', error);
            throw new common_1.HttpException(error.message || 'Failed to initiate login', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async verifyPhoneLogin(phoneNumber, otp) {
        try {
            return await this.authService.verifyPhoneLogin(phoneNumber, otp);
        }
        catch (error) {
            console.error('Phone login verification error:', error);
            throw new common_1.HttpException(error.message || 'Failed to verify login', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async login(loginDto) {
        try {
            const token = await this.userService.login(loginDto);
            const user = await this.userService.findByUsername(loginDto.username);
            if (!user) {
                throw new common_1.HttpException('User not found', common_1.HttpStatus.BAD_REQUEST);
            }
            await this.userService.updateLastActive(user._id.toString());
            return {
                access_token: token,
                username: user.username,
                role: user.role,
                userId: user._id.toString(),
            };
        }
        catch (error) {
            console.error('Email login error:', error);
            throw new common_1.HttpException(error.message || 'Failed to login', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async updateUser(id, updateUserDto) {
        try {
            if (updateUserDto.phoneNumber) {
                const phoneNumber = (0, libphonenumber_js_1.parsePhoneNumberWithError)(updateUserDto.phoneNumber, 'TN');
                if (!phoneNumber.isValid()) {
                    throw new common_1.HttpException('Invalid phone number. Use +216 followed by 8 digits.', common_1.HttpStatus.BAD_REQUEST);
                }
                updateUserDto.phoneNumber = phoneNumber.format('E.164');
            }
            const updatedUser = await this.userService.updateUser(id, updateUserDto);
            await this.userService.updateLastActive(id);
            return { message: 'User updated successfully', user: updatedUser };
        }
        catch (error) {
            console.error('Update user error:', error);
            throw new common_1.HttpException(error.message || 'Failed to update user', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getAllUsers() {
        try {
            const users = await this.userService.getAllUsers();
            return { users };
        }
        catch (error) {
            console.error('Get all users error:', error);
            throw new common_1.HttpException(error.message || 'Failed to retrieve users', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async getOnlineUsers() {
        try {
            const onlineUsers = this.onlineGateway
                .getOnlineUsers()
                .map((username) => ({
                username,
            }));
            console.log('API /users/online response:', onlineUsers.map((u) => u.username));
            return { message: 'Online users retrieved successfully', onlineUsers };
        }
        catch (error) {
            console.error('Get online users error:', error);
            throw new common_1.HttpException(error.message || 'Failed to retrieve online users', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async deleteUser(id) {
        try {
            return await this.userService.deleteUser(id);
        }
        catch (error) {
            console.error('Delete user error:', error);
            throw new common_1.HttpException(error.message || 'Failed to delete user', common_1.HttpStatus.BAD_REQUEST);
        }
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a new user' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'User registered successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid data provided' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('register/verify'),
    (0, swagger_1.ApiOperation)({ summary: 'Legacy OTP verification endpoint (deprecated)' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'This endpoint is deprecated. Use /register instead.' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'This endpoint is no longer supported' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UserController.prototype, "completeRegistration", null);
__decorate([
    (0, common_1.Post)('login/phone'),
    (0, swagger_1.ApiOperation)({ summary: 'Initiate phone-based login by sending OTP' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'OTP sent successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid phone number' }),
    __param(0, (0, common_1.Body)('phoneNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "initiatePhoneLogin", null);
__decorate([
    (0, common_1.Post)('login/phone/verify'),
    (0, swagger_1.ApiOperation)({ summary: 'Verify OTP for phone-based login' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Login successful' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid OTP' }),
    __param(0, (0, common_1.Body)('phoneNumber')),
    __param(1, (0, common_1.Body)('otp')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "verifyPhoneLogin", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiOperation)({ summary: 'Email/password login for web app' }),
    (0, swagger_1.ApiCreatedResponse)({ description: 'Login successful' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid credentials' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "login", null);
__decorate([
    (0, common_1.Put)('update/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Update user information' }),
    (0, swagger_1.ApiOkResponse)({ description: 'User updated successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Invalid data provided' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users' }),
    (0, swagger_1.ApiOkResponse)({ description: 'List of users' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getAllUsers", null);
__decorate([
    (0, common_1.Get)('online'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get list of online users' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Online users retrieved successfully' }),
    (0, swagger_1.ApiBadRequestResponse)({ description: 'Failed to retrieve online users' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getOnlineUsers", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "deleteUser", null);
exports.UserController = UserController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [user_service_1.UserService,
        auth_service_1.AuthService,
        infobip_otp_service_1.InfobipOtpService,
        jwt_1.JwtService,
        online_gateway_1.OnlineGateway])
], UserController);
//# sourceMappingURL=user.controller.js.map