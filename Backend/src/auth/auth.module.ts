import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { UserModule } from 'src/user/user.module';
import { AuthController } from './auth.controller';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { InfobipOtpModule } from 'src/infobip-otp/infobip-otp.module';

@Module({
  imports: [
    JwtModule.register({
      secret: '123456',
      signOptions: { expiresIn: '1h' },
    }),
    forwardRef(() => UserModule),
    CreateUserDto,
    InfobipOtpModule,
  ],
  providers: [JwtStrategy, AuthService],
  controllers: [AuthController],
  exports: [JwtModule, JwtStrategy, AuthService],
})
export class AuthModule {}
