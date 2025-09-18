// backend/src/player/dto/register-player.dto.ts
import { IsPhoneNumber, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class RegisterPlayerDto {
  @IsPhoneNumber('TN')
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  username?: string;
}

