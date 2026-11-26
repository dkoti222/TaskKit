import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityQueryDto, ActivityService } from './activity.service';
import { PageQueryDto } from '../../common/utils/pagination';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard';
import { CurrentMembership } from '../workspaces/decorators/current-membership.decorator';
import type { WorkspaceMember } from '../../generated/prisma/client';

// All read-only: anyone who can see the board.

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('boards/:boardId')
export class BoardActivityController {
  constructor(private readonly activity: ActivityService) {}

  /** Screen 20. `?kind=all|cards|members&cursor=&limit=20`, newest first. */
  @Get('activity')
  list(@Param('boardId', ParseUUIDPipe) boardId: string, @Query() query: ActivityQueryDto) {
    return this.activity.listForBoard(boardId, query);
  }

  /** Screen 18: archived lists and cards, to restore with the existing restore endpoints. */
  @Get('archived')
  archived(@Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.activity.archived(boardId);
  }
}

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('cards/:cardId')
export class CardActivityController {
  constructor(private readonly activity: ActivityService) {}

  /** Screen 15's "Comments and activity" timeline, newest first. */
  @Get('activity')
  list(@Param('cardId', ParseUUIDPipe) cardId: string, @Query() query: PageQueryDto) {
    return this.activity.listForCard(cardId, query);
  }
}

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/activity')
export class WorkspaceActivityController {
  constructor(private readonly activity: ActivityService) {}

  /** Screen 08 "Recent activity": any workspace member, only boards they can see. */
  @Get()
  list(
    @CurrentMembership() member: WorkspaceMember,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: PageQueryDto,
  ) {
    return this.activity.listForWorkspace(workspaceId, member, query);
  }
}
