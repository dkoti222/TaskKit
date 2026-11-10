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

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      PrismaModule,
      HealthModule,
      UsersModule,
      MailModule,
      AuthModule,
      WorkspacesModule,
      BoardsModule,
      CardsModule,
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  export class AppModule {}