import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from '@nestjs/class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Username of the user (required)',
    example: 'johndoe'
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Email of the user (optional)',
    required: false,
    example: 'user@example.com'
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Password of the user (required)',
    minLength: 6,
    example: 'password123'
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  password: string;

  @ApiProperty({
    description: 'Phone number of the user (optional)',
    required: false,
    example: '+1234567890'
  })
  @IsPhoneNumber()
  @IsOptional()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @IsIn(['user', 'admin']) // Ensures only 'user' or 'admin' are valid roles
  role: string;
}
