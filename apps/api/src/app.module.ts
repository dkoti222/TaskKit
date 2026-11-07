  import { Module } from '@nestjs/common';
  import { ConfigModule } from '@nestjs/config';
  import { HealthModule } from './health/health.module';
  import { PrismaModule } from './prisma/prisma.module';
  import { UsersModule } from './modules/users/users.module';
  import { MailModule } from './modules/mail/mail.module';
  import { AuthModule } from './modules/auth/auth.module';

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      PrismaModule,
      HealthModule,
      UsersModule,
      MailModule,
      AuthModule,
    ],
  })
  export class AppModule {}