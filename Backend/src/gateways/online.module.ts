import { forwardRef, Module } from '@nestjs/common';
import { OnlineGateway } from './online.gateway';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [OnlineGateway],
  exports: [OnlineGateway],
})
export class OnlineModule {}
