import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({
    description: 'textequestion of the question',
  })
  @IsString()
  @IsNotEmpty()
  textequestion: string;

  @ApiProperty({
    description: 'type of the question',
  })
  @IsString()
  @IsNotEmpty()
  type: string;
}
