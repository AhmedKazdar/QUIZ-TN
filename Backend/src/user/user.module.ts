import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './user.schema';
import { OnlineModule } from 'src/gateways/online.module';
import { InfobipOtpModule } from 'src/infobip-otp/infobip-otp.module';
import { AuthModule } from 'src/auth/auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // User model available here
    JwtModule.register({
      secret: '123456',
      signOptions: { expiresIn: '10d' },
    }),
    OnlineModule,
    InfobipOtpModule,
    forwardRef(() => AuthModule),
  ],
  providers: [UserService, JwtAuthGuard, RolesGuard],
  controllers: [UserController],
  exports: [UserService, MongooseModule], // Export MongooseModule so other modules can use UserModel
})
export class UserModule {}
