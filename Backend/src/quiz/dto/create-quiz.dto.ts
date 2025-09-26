import { IsString, IsArray, IsOptional, IsIn, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AnswerOptionDto {
  @IsString()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuizDto {
  @IsString()
  question: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerOptionDto)
  options: AnswerOptionDto[];

}

export class SubmitQuizResponseDto {
  @IsString()
  questionId: string;

  @IsString()
  selectedOptionId: string;

  @IsBoolean()
  isCorrect: boolean;

  @IsOptional()
  timeSpent?: number; // in seconds
}
