import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BoardsModule } from '../boards/boards.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeListener } from './realtime.listener';

@Module({
  imports: [
    BoardsModule, // for BoardAccessService
    // Same secret as AuthModule, so socket tokens are checked exactly like HTTP ones.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeListener],
})
export class RealtimeModule {}
