import { IsString, IsNotEmpty, MinLength } from '@nestjs/class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'The user’s current password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  oldPassword: string;

  @ApiProperty({
    description: 'The new password for the user',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  newPassword: string;
}
