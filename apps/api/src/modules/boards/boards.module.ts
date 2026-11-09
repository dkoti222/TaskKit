import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardAccessService } from './board-access.service';
import { BoardsController, WorkspaceBoardsController } from './boards.controller';

@Module({
  controllers: [WorkspaceBoardsController, BoardsController],
  providers: [BoardsService, BoardAccessService],
  exports: [BoardAccessService],
})
export class BoardsModule {}