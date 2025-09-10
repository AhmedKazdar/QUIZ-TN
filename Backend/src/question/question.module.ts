import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { ResponseModule } from '../response/response.module';
import { QuestionSchema } from './question.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Question', schema: QuestionSchema }]),
    forwardRef(() => ResponseModule), // 🟢 FIX: Wrap ResponseModule in forwardRef
  ],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService, MongooseModule],
})
export class QuestionModule {}
