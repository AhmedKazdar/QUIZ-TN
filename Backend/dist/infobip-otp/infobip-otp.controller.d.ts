import { InfobipOtpService } from './infobip-otp.service';
export declare class InfobipOtpController {
    private readonly otpService;
    constructor(otpService: InfobipOtpService);
    sendOtp(phone: string): Promise<{
        message: string;
    }>;
    verifyOtp(phone: string, otp: string): {
        message: string;
    };
    handleDeliveryReport(report: any): Promise<{
        message: string;
    }>;
}
