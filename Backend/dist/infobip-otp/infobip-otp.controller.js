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
exports.InfobipOtpController = void 0;
const common_1 = require("@nestjs/common");
const infobip_otp_service_1 = require("./infobip-otp.service");
let InfobipOtpController = class InfobipOtpController {
    otpService;
    constructor(otpService) {
        this.otpService = otpService;
    }
    async sendOtp(phone) {
        console.log('Controller received phone:', phone);
        if (!phone) {
            throw new common_1.HttpException('Phone number is required', common_1.HttpStatus.BAD_REQUEST);
        }
        try {
            await this.otpService.sendOtp(phone);
            return { message: 'OTP sent successfully' };
        }
        catch (error) {
            console.error('Controller error:', error);
            throw new common_1.HttpException(error.message || 'Failed to send OTP', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    verifyOtp(phone, otp) {
        console.log('Verify OTP called with:', { phone, otp });
        if (!phone || !otp) {
            throw new common_1.HttpException('Phone number and OTP are required', common_1.HttpStatus.BAD_REQUEST);
        }
        const isValid = this.otpService.verifyOtp(phone, otp);
        if (!isValid) {
            throw new common_1.HttpException('Invalid or expired OTP', common_1.HttpStatus.UNAUTHORIZED);
        }
        return { message: 'OTP verified successfully' };
    }
    async handleDeliveryReport(report) {
        console.log('Received delivery report:', JSON.stringify(report, null, 2));
        return { message: 'Delivery report received' };
    }
};
exports.InfobipOtpController = InfobipOtpController;
__decorate([
    (0, common_1.Post)('send'),
    __param(0, (0, common_1.Body)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], InfobipOtpController.prototype, "sendOtp", null);
__decorate([
    (0, common_1.Post)('verify'),
    __param(0, (0, common_1.Body)('phone')),
    __param(1, (0, common_1.Body)('otp')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], InfobipOtpController.prototype, "verifyOtp", null);
__decorate([
    (0, common_1.Post)('webhook/delivery-report'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], InfobipOtpController.prototype, "handleDeliveryReport", null);
exports.InfobipOtpController = InfobipOtpController = __decorate([
    (0, common_1.Controller)('otp'),
    __metadata("design:paramtypes", [infobip_otp_service_1.InfobipOtpService])
], InfobipOtpController);
//# sourceMappingURL=infobip-otp.controller.js.map