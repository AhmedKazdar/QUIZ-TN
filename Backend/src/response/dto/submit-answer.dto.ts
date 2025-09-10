import { IsString, IsBoolean, IsNotEmpty, IsMongoId } from 'class-validator';

export class SubmitAnswerDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsMongoId()
  @IsNotEmpty()
  questionId: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsString()
  @IsNotEmpty()
  text: string; // Changed from selectedAnswerText to text
}
