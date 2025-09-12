import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateQuizTimeDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/, {
    message: 'Time must be in HH:MM or HH:MM:SS format',
  })
  time: string;
}
