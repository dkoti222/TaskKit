import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CommentBodyDto } from './dto/comment.dto';
import { PageQueryDto } from '../../common/utils/pagination';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { BoardRoles } from '../boards/decorators/board-roles.decorator';
import { CurrentBoard } from '../boards/decorators/current-board.decorator';
import { CurrentActor } from '../boards/decorators/current-actor.decorator';
import type { BoardAccess } from '../boards/board-access.service';
import type { BoardEventContext } from '../../common/events/domain-events';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('cards/:cardId/comments')
export class CardCommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** Anyone with access to the board. Newest first. */
  @Get()
  list(@Param('cardId', ParseUUIDPipe) cardId: string, @Query() query: PageQueryDto) {
    return this.comments.list(cardId, query);
  }

  @Post()
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: CommentBodyDto,
  ) {
    return this.comments.create(actor, cardId, dto.body);
  }
}

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
// Viewers are read-only, even on comments they wrote before becoming Viewers.
@BoardRoles('OWNER', 'ADMIN', 'MEMBER')
@Controller('comments/:commentId')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** Author only. */
  @Patch()
  update(
    @CurrentActor() actor: BoardEventContext,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: CommentBodyDto,
  ) {
    return this.comments.update(actor, commentId, dto.body);
  }

  /** The author, or a board Owner or Admin. */
  @Delete()
  @HttpCode(200)
  async remove(
    @CurrentActor() actor: BoardEventContext,
    @CurrentBoard() access: BoardAccess,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ) {
    await this.comments.remove(actor, access.role, commentId);
    return { message: 'Comment deleted' };
  }
}
