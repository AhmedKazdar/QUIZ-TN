import {
  IsString,
  IsBoolean,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
} from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateResponseDto {
  @ApiProperty({
    description: 'text of the response',
    required: false,
  })
  @IsString()
  @IsOptional() // Make it optional if you want to allow partial updates
  text?: string; // Optional text field for updating (can be undefined or a string)

  @ApiProperty({
    description: 'true or false',
    required: false,
  })
  @IsBoolean()
  @IsOptional() // Optional for updating the correct status
  isCorrect?: boolean;

  @ApiProperty({
    description: 'questionId of the response',
    required: false,
  })
  @IsString()
  @IsOptional() // Optional for updating the questionId
  questionId?: string;
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}
