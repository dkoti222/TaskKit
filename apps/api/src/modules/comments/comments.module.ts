import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { CardCommentsController, CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [BoardsModule], // BoardAccessService (guard and mentions)
  controllers: [CardCommentsController, CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
