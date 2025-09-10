// src/infobip-otp/infobip-otp.module.ts
import { Module } from '@nestjs/common';
import { InfobipOtpService } from './infobip-otp.service';
import { InfobipOtpController } from './infobip-otp.controller';

@Module({
  providers: [InfobipOtpService],
  controllers: [InfobipOtpController],
  exports: [InfobipOtpService],
})
export class InfobipOtpModule {}
