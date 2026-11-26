  import { Module } from '@nestjs/common';
  import { ConfigModule } from '@nestjs/config';
  import { HealthModule } from './health/health.module';
  import { PrismaModule } from './prisma/prisma.module';
  import { UsersModule } from './modules/users/users.module';
  import { MailModule } from './modules/mail/mail.module';
  import { AuthModule } from './modules/auth/auth.module';
  import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { BoardsModule } from './modules/boards/boards.module';
import { CardsModule } from './modules/cards/cards.module';
import { EventsModule } from './common/events/events.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ActivityModule } from './modules/activity/activity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { SearchModule } from './modules/search/search.module';

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      PrismaModule,
      EventsModule,
      HealthModule,
      UsersModule,
      MailModule,
      AuthModule,
      WorkspacesModule,
      BoardsModule,
      CardsModule,
      RealtimeModule,
      CommentsModule,
      ActivityModule,
      NotificationsModule,
      AttachmentsModule,
      SearchModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  export class AppModule {}