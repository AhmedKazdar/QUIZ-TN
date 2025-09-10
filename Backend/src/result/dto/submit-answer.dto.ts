import { IsArray, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class Answer {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  selectedResponseId: string;
}

export class SubmitAnswerDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ type: [Answer] })
  @IsArray()
  answers: Answer[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  quizId?: string;
}
