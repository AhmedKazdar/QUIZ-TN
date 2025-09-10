// result.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Result, ResultSchema } from './result.schema';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { ResponseModule } from '../response/response.module'; // 👈 import this
import { User, UserSchema } from '../user/user.schema';
import { Question, QuestionSchema } from '../question/question.schema';
import { Response, ResponseSchema } from '../response/response.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Result.name, schema: ResultSchema },
      { name: User.name, schema: UserSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: Response.name, schema: ResponseSchema },
    ]),
    ResponseModule,
  ],
  controllers: [ResultController],
  providers: [ResultService],
})
export class ResultModule {}
