import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InfobipOtpService } from './infobip-otp.service';

@Controller('otp')
export class InfobipOtpController {
  constructor(private readonly otpService: InfobipOtpService) {}

  @Post('send')
  async sendOtp(@Body('phone') phone: string) {
    console.log('Controller received phone:', phone);
    if (!phone) {
      throw new HttpException(
        'Phone number is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      await this.otpService.sendOtp(phone);
      return { message: 'OTP sent successfully' };
    } catch (error) {
      console.error('Controller error:', error);
      throw new HttpException(
        error.message || 'Failed to send OTP',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('verify')
  verifyOtp(@Body('phone') phone: string, @Body('otp') otp: string) {
    console.log('Verify OTP called with:', { phone, otp });
    if (!phone || !otp) {
      throw new HttpException(
        'Phone number and OTP are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const isValid = this.otpService.verifyOtp(phone, otp);
    if (!isValid) {
      throw new HttpException(
        'Invalid or expired OTP',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return { message: 'OTP verified successfully' };
  }

  @Post('webhook/delivery-report')
  async handleDeliveryReport(@Body() report: any) {
    console.log('Received delivery report:', JSON.stringify(report, null, 2));
    return { message: 'Delivery report received' };
  }
}
