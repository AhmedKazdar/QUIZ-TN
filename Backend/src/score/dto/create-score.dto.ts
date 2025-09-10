import { IsString } from 'class-validator';

export class CreateScoreDto {
  @IsString()
  userId: string;
}
