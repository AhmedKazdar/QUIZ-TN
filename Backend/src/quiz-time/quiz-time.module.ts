import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizTimeController } from './quiz-time.controller';
import { QuizTimeService } from './quiz-time.service';
import { QuizTime, QuizTimeSchema } from './entities/quiz-time.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizTime.name, schema: QuizTimeSchema },
    ]),
  ],
  controllers: [QuizTimeController],
  providers: [QuizTimeService],
  exports: [QuizTimeService],
})
export class QuizTimeModule {}
