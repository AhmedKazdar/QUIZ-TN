import { IsEmail, IsOptional, IsPhoneNumber, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    description: 'New username',
    example: 'newusername',
    required: false
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiProperty({
    description: 'New email',
    example: 'newemail@example.com',
    required: false
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'New phone number',
    example: '+21612345678',
    required: false
  })
  @IsString()
  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +21612345678)',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'New role',
    example: 'user',
    required: false
  })
  @IsString()
  @IsOptional()
  role?: string;
}
