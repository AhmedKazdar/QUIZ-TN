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
var JwtStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const user_service_1 = require("../user/user.service");
let JwtStrategy = JwtStrategy_1 = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    userService;
    logger = new common_1.Logger(JwtStrategy_1.name);
    constructor(userService) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || '123456',
        });
        this.userService = userService;
    }
    async validate(payload) {
        this.logger.log(`JwtStrategy - Validating payload for user: ${payload.sub}`);
        if (!payload || !payload.sub) {
            this.logger.error('JwtStrategy - Invalid payload: missing sub field');
            throw new common_1.UnauthorizedException('Invalid token');
        }
        try {
            const user = await this.userService.findById(payload.sub);
            if (!user) {
                this.logger.warn(`JwtStrategy - User not found for ID: ${payload.sub}`);
                this.logger.warn('User was likely deleted from database but token still exists');
                return {
                    userId: payload.sub,
                    username: payload.username || 'deleted_user',
                    phoneNumber: payload.phoneNumber || '',
                    role: payload.role || 'user',
                    isValid: false,
                    isDeleted: true,
                    sub: payload.sub
                };
            }
            this.logger.log(`JwtStrategy - User validated successfully: ${user.username} (${user._id})`);
            return {
                userId: user._id.toString(),
                username: user.username,
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                role: user.role || 'user',
                isValid: true,
                isDeleted: false,
                sub: user._id.toString()
            };
        }
        catch (error) {
            this.logger.error(`JwtStrategy - Validation error: ${error.message}`, error.stack);
            return {
                userId: payload.sub,
                username: payload.username || 'unknown',
                phoneNumber: payload.phoneNumber || '',
                role: payload.role || 'user',
                isValid: false,
                error: error.message,
                sub: payload.sub
            };
        }
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = JwtStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map