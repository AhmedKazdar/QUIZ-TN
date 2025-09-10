import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email of the user',
  })
  @IsString({ message: 'username must be a string' })
  username: string;

  @ApiProperty({
    description: 'Password of the user',
  })
  @IsString({ message: 'Password must be a string' })
  password: string;
}
