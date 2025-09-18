// backend/src/player/player.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { AuthModule } from '../auth/auth.module';
import { Player, PlayerSchema } from './player.schema';
import { InfobipOtpModule } from 'src/infobip-otp/infobip-otp.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Player.name, schema: PlayerSchema }]),
    AuthModule,
    InfobipOtpModule,
  ],
  providers: [PlayerService],
  controllers: [PlayerController],
  exports: [PlayerService],
})
export class PlayerModule {}