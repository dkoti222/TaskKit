import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { CommentsModule } from '../comments/comments.module';
import {
  BoardActivityController,
  CardActivityController,
  WorkspaceActivityController,
} from './activity.controller';
import { ActivityListener } from './activity.listener';
import { ActivityService } from './activity.service';

@Module({
  imports: [BoardsModule, CommentsModule],
  controllers: [BoardActivityController, CardActivityController, WorkspaceActivityController],
  providers: [ActivityService, ActivityListener],
})
export class ActivityModule {}
