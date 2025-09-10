import {
  IsString,
  IsBoolean,
  IsNotEmpty,
  IsMongoId,
} from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Types } from 'mongoose';

export class CreateResponseDto {
  @ApiProperty({ description: 'Text of the response' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'Question ID for the response' })
  @IsMongoId()
  questionId: Types.ObjectId; // Expecting ObjectId in string format

  @ApiProperty({ description: 'Mark if the response is correct' })
  @IsBoolean()
  isCorrect: boolean;

  @ApiProperty()
  @IsMongoId()
  userId: Types.ObjectId; // Expecting ObjectId in string format
}
