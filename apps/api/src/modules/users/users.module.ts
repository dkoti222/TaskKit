import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccountPurgeService } from './account-purge.service';

@Module({
  providers: [UsersService, AccountPurgeService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
