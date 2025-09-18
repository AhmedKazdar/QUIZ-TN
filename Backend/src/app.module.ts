import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { QuestionModule } from './question/question.module';
import { ResponseModule } from './response/response.module';
import { ResultModule } from './result/result.module';
import { ScoreModule } from './score/score.module';
import { OnlineGateway } from './gateways/online.gateway';
import { OnlineModule } from './gateways/online.module';
import { InfobipOtpModule } from './infobip-otp/infobip-otp.module';
import { WebhookModule } from './webhook/webhook.module';
import { HealthController } from './health/health.controller';
import { QuizTimeModule } from './quiz-time/quiz-time.module';
import { PlayerModule } from './player/player.module';

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
    QuestionModule,
    ResponseModule,
    ResultModule,
    ScoreModule,
    OnlineModule,
    InfobipOtpModule,
    WebhookModule,
    QuizTimeModule,
    PlayerModule,
  ],
  providers: [OnlineGateway],
})
export class AppModule {}
