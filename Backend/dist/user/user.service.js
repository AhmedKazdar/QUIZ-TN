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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const jwt_1 = require("@nestjs/jwt");
const user_schema_1 = require("./user.schema");
const bcrypt = require("bcryptjs");
const infobip_otp_service_1 = require("../infobip-otp/infobip-otp.service");
let UserService = class UserService {
    userModel;
    jwtService;
    infobipOtpService;
    constructor(userModel, jwtService, infobipOtpService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
        this.infobipOtpService = infobipOtpService;
    }
    async findByPhoneNumber(phoneNumber) {
        return this.userModel.findOne({ phoneNumber }).exec();
    }
    async checkIfUserExists(createUserDto) {
        const { username, email, phoneNumber } = createUserDto;
        const existingUser = await this.userModel
            .findOne({
            $or: [
                { username: username || { $exists: false } },
                { email: email || { $exists: false } },
                { phoneNumber },
            ],
        })
            .exec();
        if (existingUser) {
            if (existingUser.username === username) {
                throw new common_1.ConflictException('Username already exists');
            }
            if (existingUser.email === email) {
                throw new common_1.ConflictException('Email already exists');
            }
            if (existingUser.phoneNumber === phoneNumber) {
                throw new common_1.ConflictException('Phone number already registered');
            }
        }
    }
    async create(createUserDto) {
        console.log('[UserService] Creating new user:', createUserDto.username);
        const existingUser = await this.userModel.findOne({
            username: createUserDto.username
        }).exec();
        if (existingUser) {
            console.log(`[UserService] Username already exists: ${createUserDto.username}`);
            throw new common_1.ConflictException('Username already exists');
        }
        if (createUserDto.email) {
            const emailUser = await this.userModel.findOne({
                email: createUserDto.email
            }).exec();
            if (emailUser) {
                console.log(`[UserService] Email already exists: ${createUserDto.email}`);
                throw new common_1.ConflictException('Email already exists');
            }
        }
        if (createUserDto.phoneNumber) {
            const phoneUser = await this.userModel.findOne({
                phoneNumber: createUserDto.phoneNumber
            }).exec();
            if (phoneUser) {
                console.log(`[UserService] Phone number already exists: ${createUserDto.phoneNumber}`);
                throw new common_1.ConflictException('Phone number already exists');
            }
        }
        if (!createUserDto.password) {
            console.log('[UserService] Password is required');
            throw new common_1.BadRequestException('Password is required');
        }
        if (createUserDto.password.length < 6) {
            console.log('[UserService] Password is too short');
            throw new common_1.BadRequestException('Password must be at least 6 characters long');
        }
        console.log('[UserService] Hashing password...');
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);
        console.log('[UserService] Password hashed successfully');
        const userData = {
            phoneNumber: createUserDto.phoneNumber,
            username: createUserDto.username,
            role: createUserDto.role || 'user',
            email: createUserDto.email,
            password: hashedPassword,
            lastActive: new Date(),
        };
        console.log('[UserService] Creating user with data:', {
            ...userData,
            password: '***'
        });
        const user = new this.userModel(userData);
        try {
            const savedUser = await user.save();
            console.log('[UserService] User created successfully:', savedUser._id);
            const payload = {
                sub: savedUser._id.toString(),
                username: savedUser.username,
                role: savedUser.role || 'user'
            };
            console.log('[UserService] Generating JWT token with payload:', payload);
            const token = this.jwtService.sign(payload);
            return {
                user: savedUser,
                token,
                userId: savedUser._id.toString(),
                username: savedUser.username,
                role: savedUser.role || 'user',
                email: savedUser.email || '',
                phoneNumber: savedUser.phoneNumber || ''
            };
        }
        catch (error) {
            console.error('[UserService] Error saving user:', error);
            throw new common_1.BadRequestException('Failed to create user');
        }
    }
    async initiateRegistration(createUserDto) {
        console.log('Initiate registration with:', createUserDto);
        const existingUser = await this.userModel
            .findOne({ phoneNumber: createUserDto.phoneNumber })
            .exec();
        if (existingUser) {
            throw new common_1.HttpException('Phone number already registered', common_1.HttpStatus.BAD_REQUEST);
        }
        console.log('Storing user data for OTP verification:', createUserDto);
    }
    async completeRegistration(createUserDto, otp) {
        console.log('completeRegistration called with:', { createUserDto, otp });
        const existingUser = await this.userModel
            .findOne({ phoneNumber: createUserDto.phoneNumber })
            .exec();
        if (existingUser) {
            throw new common_1.HttpException('Phone number already registered', common_1.HttpStatus.BAD_REQUEST);
        }
        if (!createUserDto.phoneNumber) {
            throw new common_1.BadRequestException('Phone number is required for OTP verification');
        }
        const isValid = await this.infobipOtpService.verifyOtp(createUserDto.phoneNumber, otp);
        console.log('OTP verification result:', {
            isValid,
            phone: createUserDto.phoneNumber,
            otp,
        });
        if (!isValid) {
            throw new common_1.HttpException('Invalid or expired OTP', common_1.HttpStatus.BAD_REQUEST);
        }
        const hashedPassword = createUserDto.password
            ? await bcrypt.hash(createUserDto.password, 10)
            : undefined;
        const user = new this.userModel({
            phoneNumber: createUserDto.phoneNumber,
            username: createUserDto.username || 'temp',
            role: createUserDto.role || 'user',
            email: createUserDto.email,
            password: hashedPassword,
            lastActive: new Date(),
        });
        console.log('Saving user to MongoDB:', user);
        try {
            const savedUser = await user.save();
            console.log('User saved successfully:', savedUser);
            return savedUser;
        }
        catch (error) {
            console.error('Error saving user:', error);
            throw new common_1.HttpException('Failed to save user', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async findByUsername(username) {
        return this.userModel.findOne({ username }).exec();
    }
    async findByEmail(email) {
        return this.userModel.findOne({ email }).exec();
    }
    async findById(id) {
        return this.userModel.findById(id).exec();
    }
    async getAllUsers() {
        return this.userModel.find().exec();
    }
    async updateLastActive(userId) {
        await this.userModel
            .findByIdAndUpdate(userId, { lastActive: new Date() }, { new: true })
            .exec();
    }
    async changePassword(userId, changePasswordDto) {
        const { oldPassword, newPassword } = changePasswordDto;
        console.log('Service - changePassword - userId:', userId, 'DTO:', changePasswordDto);
        const user = await this.userModel.findById(userId).exec();
        console.log('Service - User found:', user);
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        if (!user.password) {
            throw new common_1.BadRequestException('User has no password set');
        }
        const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
        console.log('Service - Old password valid:', isPasswordValid);
        if (!isPasswordValid) {
            throw new common_1.BadRequestException('Incorrect old password');
        }
        if (oldPassword === newPassword) {
            throw new common_1.BadRequestException('New password must be different from old password');
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        user.lastActive = new Date();
        await user.save();
        console.log('Service - Updated user password hash:', user.password);
        console.log('Service - Password updated for user:', userId);
        return { message: 'Password updated successfully' };
    }
    async updateUser(id, updateUserDto) {
        const hashedPassword = updateUserDto.password
            ? await bcrypt.hash(updateUserDto.password, 10)
            : undefined;
        const updatedUser = await this.userModel
            .findByIdAndUpdate(id, {
            phoneNumber: updateUserDto.phoneNumber,
            username: updateUserDto.username,
            role: updateUserDto.role,
            email: updateUserDto.email,
            password: hashedPassword,
            lastActive: new Date(),
        }, { new: true })
            .exec();
        if (!updatedUser) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return updatedUser;
    }
    async deleteUser(id) {
        const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
        if (!deletedUser) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return { message: 'User deleted successfully' };
    }
    async findAll() {
        return this.userModel.find().select('-password -refreshToken').exec();
    }
    async login(loginDto) {
        const { username, password } = loginDto;
        console.log(`Login attempt for username: ${username}`);
        const user = await this.userModel.findOne({
            username: { $regex: new RegExp(`^${username}$`, 'i') }
        }).exec();
        const allUsers = await this.userModel.find({}).select('username').lean();
        console.log('All users in database:', allUsers.map(u => u.username));
        if (!user) {
            console.log(`User not found: ${username}`);
            throw new common_1.UnauthorizedException('Invalid username or password');
        }
        console.log(`User found:`, {
            id: user._id,
            username: user.username,
            hasPassword: !!user.password
        });
        if (!user.password) {
            throw new common_1.UnauthorizedException('No password set for this account. Please use password reset.');
        }
        console.log('Verifying password...');
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log(`Password validation result: ${isPasswordValid}`);
        if (!isPasswordValid) {
            console.log('Password validation failed');
            throw new common_1.UnauthorizedException('Invalid username or password');
        }
        await this.updateLastActive(user._id.toString());
        const payload = {
            username: user.username,
            sub: user._id.toString(),
            role: user.role,
            email: user.email || '',
            phoneNumber: user.phoneNumber || '',
        };
        return this.jwtService.sign(payload);
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService,
        infobip_otp_service_1.InfobipOtpService])
], UserService);
//# sourceMappingURL=user.service.js.map