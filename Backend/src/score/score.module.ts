// src/score/score.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScoreService } from './score.service';
import { ScoreController } from './score.controller';
import { Score, ScoreSchema } from './score.schema';
import { User, UserSchema } from '../user/user.schema';
import { Response, ResponseSchema } from '../response/response.schema';
import { Question, QuestionSchema } from '../question/question.schema';
import { UserModule } from 'src/user/user.module';
import { ResponseModule } from 'src/response/response.module';
import { QuestionModule } from 'src/question/question.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Score.name, schema: ScoreSchema },
      { name: User.name, schema: UserSchema },
      { name: Response.name, schema: ResponseSchema },
      { name: Question.name, schema: QuestionSchema },
    ]),
    UserModule,
    forwardRef(() => ResponseModule), // Handle circular dependency
    forwardRef(() => QuestionModule), // If QuestionModule is needed
  ],
  providers: [ScoreService],
  controllers: [ScoreController],
  exports: [ScoreService],
})
export class ScoreModule {}
