import { Module } from '@nestjs/common';
import { QuizGateway } from '../websocket/quiz.gateway';
import { QuizSessionService } from './quiz-session.service';
import { QuizService } from './quiz.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Quiz, QuizSchema } from './schemas/quiz.schema';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Quiz.name, schema: QuizSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    ConfigModule, // Add ConfigModule for JWT configuration
  ],
  providers: [
    QuizGateway,
    QuizSessionService,
    QuizService, // Add QuizService directly as a provider
  ],
  exports: [
    QuizGateway,
    QuizSessionService,
    QuizService, // Export QuizService for other modules
  ],
})
export class QuizSocketModule {}
