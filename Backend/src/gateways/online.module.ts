import { forwardRef, Module } from '@nestjs/common';
import { OnlineGateway } from './online.gateway';
import { PlayerModule } from 'src/player/player.module';

@Module({
  imports: [forwardRef(() => PlayerModule)],
  providers: [OnlineGateway],
  exports: [OnlineGateway],
})
export class OnlineModule {}
