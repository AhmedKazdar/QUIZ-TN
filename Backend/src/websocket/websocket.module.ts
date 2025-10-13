// websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { QuizGateway } from './quiz.gateway';
import { QuizModule } from '../quiz/quiz.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [QuizModule, AuthModule],
  providers: [QuizGateway],
  exports: [QuizGateway],
})
export class WebSocketModule {}