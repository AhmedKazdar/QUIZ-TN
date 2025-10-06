// backend/src/player/player.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, NotFoundException, BadRequestException,Request } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PlayerService } from './player.service';
import { RegisterPlayerDto } from './dto/register-player.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestWithUser } from '../auth/types/request-with-user.interface';
import { JwtAuthGuard } from 'src/user/jwt-auth.guard';
import { InfobipOtpService } from 'src/infobip-otp/infobip-otp.service';

@Controller('player')
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly infobipOtpService: InfobipOtpService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() registerDto: RegisterPlayerDto) {
    // Send OTP via Infobip/WinSMS service
    await this.infobipOtpService.sendOtp(registerDto.phoneNumber);
    return {
      success: true,
      message: 'OTP sent successfully',
      phoneNumber: registerDto.phoneNumber,
    };
  }

  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    // Verify OTP first
    const isValid = this.infobipOtpService.verifyOtp(verifyOtpDto.phoneNumber, verifyOtpDto.otp);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Create or fetch player
    const player = await this.playerService.verifyOtp(verifyOtpDto);

    // Issue JWT token for the player
    const payload = {
      sub: (player as any)._id?.toString?.() || (player as any).id,
      phoneNumber: player.phoneNumber,
      username: player.username,
      role: 'user',
    };
    const token = this.jwtService.sign(payload);

    return {
      success: true,
      player: {
        id: (player as any)._id?.toString?.() || (player as any).id,
        phoneNumber: player.phoneNumber,
        username: player.username,
        score: player.score,
      },
      token,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: RequestWithUser) {
    const phoneNumber = req.user?.phoneNumber;
    if (!phoneNumber) {
      throw new BadRequestException('Authenticated user does not have a phone number');
    }

    const player = await this.playerService.findByPhoneNumber(phoneNumber);
    if (!player) {
      throw new NotFoundException('Player not found');
    }
    
    return {
      id: player.id,
      phoneNumber: player.phoneNumber,
      username: player.username,
      score: player.score,
      createdAt: player.createdAt
    };
  }

  @Get('validate-token')
@UseGuards(JwtAuthGuard)
async validateToken(@Request() req) {
  return {
    valid: true,
    user: {
      id: req.user.userId,
      username: req.user.username,
      phoneNumber: req.user.phoneNumber
    },
    message: 'Token is valid'
  };
}
}