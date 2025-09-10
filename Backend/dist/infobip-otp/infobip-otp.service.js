"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfobipOtpService = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const libphonenumber_js_1 = require("libphonenumber-js");
const axios_1 = require("axios");
let InfobipOtpService = class InfobipOtpService {
    otpStore = new Map();
    WIN_SMS_API_KEY = 'LUJcxP5QOgROqZKt8ktFxan6eqcj0u2750HLM8lHrgEo2f4GjcZih5U3FOdR';
    WIN_SMS_SENDER = 'QUIZTN';
    WIN_SMS_API_URL = 'https://www.winsmspro.com/sms/sms/api';
    generateOtp(phone) {
        const otp = crypto.randomInt(1000, 9999).toString();
        const expires = Date.now() + 5 * 60 * 1000;
        this.otpStore.set(phone, { otp, expires });
        console.log('OTP stored for phone:', phone, {
            otp,
            expires: new Date(expires).toISOString(),
            currentTime: new Date().toISOString()
        });
        console.log('Current OTP store:', Array.from(this.otpStore.entries()));
        return otp;
    }
    async sendOtp(phone) {
        console.log('sendOtp called with phone:', phone);
        let formattedPhone;
        try {
            const phoneNumber = (0, libphonenumber_js_1.parsePhoneNumberWithError)(phone, 'TN');
            if (!phoneNumber.isValid()) {
                throw new Error('Invalid phone number');
            }
            formattedPhone = phoneNumber.nationalNumber.toString();
            console.log('Formatted phone:', formattedPhone);
        }
        catch (error) {
            console.error('Phone number parsing error:', error);
            throw new common_1.BadRequestException('Invalid phone number format. Use +216 followed by 8 digits.');
        }
        const otp = this.generateOtp(formattedPhone);
        const message = `${otp}. Valid for 5 minutes.`;
        try {
            console.log('Sending SMS with WinSMS API');
            const response = await axios_1.default.get(this.WIN_SMS_API_URL, {
                params: {
                    action: 'send-sms',
                    api_key: this.WIN_SMS_API_KEY,
                    to: `216${formattedPhone}`,
                    from: this.WIN_SMS_SENDER,
                    sms: message
                }
            });
            console.log('WinSMS API response:', response.data);
            if (response.data?.code !== 'ok') {
                throw new Error(response.data?.message || 'Failed to send SMS');
            }
            console.log('SMS sent successfully');
            return;
        }
        catch (error) {
            console.error('WinSMS API error:', error.response?.data || error.message);
            throw new common_1.BadRequestException(`Failed to send OTP: ${error.message}`);
        }
    }
    verifyOtp(phone, otp) {
        console.log('verifyOtp called with phone:', phone, 'otp:', otp);
        let formattedPhone;
        try {
            const phoneNumber = (0, libphonenumber_js_1.parsePhoneNumberWithError)(phone, 'TN');
            formattedPhone = phoneNumber.nationalNumber.toString();
            console.log('Formatted phone for verification:', formattedPhone);
        }
        catch (error) {
            console.error('Phone number parsing error in verifyOtp:', error);
            return false;
        }
        console.log('Current OTP store before verification:', Array.from(this.otpStore.entries()));
        const stored = this.otpStore.get(formattedPhone);
        if (!stored) {
            console.log('No OTP found for phone:', formattedPhone);
            return false;
        }
        if (Date.now() > stored.expires) {
            console.log('OTP expired:', {
                currentTime: new Date().toISOString(),
                expiresAt: new Date(stored.expires).toISOString()
            });
            this.otpStore.delete(formattedPhone);
            return false;
        }
        if (stored.otp !== otp) {
            console.log('OTP mismatch:', { storedOTP: stored.otp, providedOTP: otp });
            return false;
        }
        console.log('OTP verified successfully for:', formattedPhone);
        this.otpStore.delete(formattedPhone);
        return true;
    }
};
exports.InfobipOtpService = InfobipOtpService;
exports.InfobipOtpService = InfobipOtpService = __decorate([
    (0, common_1.Injectable)()
], InfobipOtpService);
//# sourceMappingURL=infobip-otp.service.js.map