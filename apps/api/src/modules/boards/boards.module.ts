import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardAccessService } from './board-access.service';
import { BoardMembersService } from './board-members.service';
import { BoardsController, WorkspaceBoardsController } from './boards.controller';
import { BoardMembersController } from './board-members.controller';

@Module({
  controllers: [WorkspaceBoardsController, BoardsController, BoardMembersController],
  providers: [BoardsService, BoardAccessService, BoardMembersService],
  exports: [BoardAccessService],
})
export class BoardsModule {}