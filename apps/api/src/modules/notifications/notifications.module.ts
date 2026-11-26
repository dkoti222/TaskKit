import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BoardsModule } from '../boards/boards.module';
import { MailModule } from '../mail/mail.module';
import { MeNotificationsController, NotificationsController } from './notifications.controller';
import { NotificationsListener } from './notifications.listener';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { NOTIFICATIONS_QUEUE, redisConnection } from './notifications.queue';
import { PushService } from './push.service';

@Module({
  imports: [
    // The Redis connection BullMQ uses (REDIS_URL, e.g. redis://localhost:6379).
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379'),
      }),
    }),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
    BoardsModule, // BoardAccessService
    MailModule,
  ],
  controllers: [NotificationsController, MeNotificationsController],
  providers: [NotificationsService, NotificationsListener, NotificationsProcessor, PushService],
})
export class NotificationsModule {}
