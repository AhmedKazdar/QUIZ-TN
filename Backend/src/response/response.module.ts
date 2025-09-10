import { forwardRef, Module } from '@nestjs/common';
import { ResponseService } from './response.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Response, ResponseSchema } from './response.schema';
import { ResponseController } from './response.controller';
import { UserModule } from 'src/user/user.module';
import { JwtService } from '@nestjs/jwt';
import { QuestionModule } from 'src/question/question.module';
import { ScoreModule } from 'src/score/score.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Response.name, schema: ResponseSchema },
    ]),
    UserModule,
    forwardRef(() => QuestionModule),
    ScoreModule,
  ],
  providers: [ResponseService, JwtService],
  controllers: [ResponseController],
  exports: [ResponseService],
})
export class ResponseModule {}
