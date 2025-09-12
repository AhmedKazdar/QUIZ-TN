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
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const user_service_1 = require("../user/user.service");
const common_2 = require("@nestjs/common");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    userService;
    constructor(userService) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || '123456',
        });
        this.userService = userService;
    }
    async validate(payload) {
        console.log('JwtStrategy - Validating payload:', payload);
        if (!payload || !payload.sub) {
            console.error('JwtStrategy - Invalid payload: missing sub field');
            throw new common_2.UnauthorizedException('Invalid token');
        }
        try {
            const user = await this.userService.findById(payload.sub);
            if (!user) {
                console.log('JwtStrategy - User not found for ID:', payload.sub);
                throw new common_2.UnauthorizedException('User not found');
            }
            console.log('JwtStrategy - User validated successfully:', {
                userId: user._id,
                username: user.username,
                role: user.role
            });
            return {
                userId: user._id.toString(),
                username: user.username,
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                role: user.role || 'user',
                sub: user._id.toString()
            };
        }
        catch (error) {
            console.error('JwtStrategy - Validation error:', error);
            throw new common_2.UnauthorizedException('User validation failed');
        }
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map