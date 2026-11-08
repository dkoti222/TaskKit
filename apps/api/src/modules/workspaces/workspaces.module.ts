import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';

@Module({
  controllers: [WorkspacesController, MembersController],
  providers: [WorkspacesService, MembersService],
})
export class WorkspacesModule {}