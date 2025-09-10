import { ApiProperty } from '@nestjs/swagger';

export class ResultDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  quizId: string;

  @ApiProperty()
  questionId: string;

  @ApiProperty()
  selectedResponseId: string;

  @ApiProperty()
  isCorrect: boolean;
}
