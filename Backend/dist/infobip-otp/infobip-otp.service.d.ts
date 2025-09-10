export declare class InfobipOtpService {
    private otpStore;
    private readonly WIN_SMS_API_KEY;
    private readonly WIN_SMS_SENDER;
    private readonly WIN_SMS_API_URL;
    generateOtp(phone: string): string;
    sendOtp(phone: string): Promise<void>;
    verifyOtp(phone: string, otp: string): boolean;
}
