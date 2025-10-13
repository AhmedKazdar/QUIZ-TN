import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';


import { OnlineModule } from './gateways/online.module';
import { InfobipOtpModule } from './infobip-otp/infobip-otp.module';
import { WebhookModule } from './webhook/webhook.module';
import { HealthController } from './health/health.controller';
import { QuizTimeModule } from './quiz-time/quiz-time.module';
import { PlayerModule } from './player/player.module';
import { QuizModule } from './quiz/quiz.module';
import { WebSocketModule } from './websocket/websocket.module';



@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI')
      }),
      inject: [ConfigService],
    }),
    UserModule,
    AuthModule,
    OnlineModule,
    InfobipOtpModule,
    WebhookModule,
    QuizTimeModule,
    PlayerModule,
     WebSocketModule,
    QuizModule,
  ],
  providers: [],
})
export class AppModule {}
