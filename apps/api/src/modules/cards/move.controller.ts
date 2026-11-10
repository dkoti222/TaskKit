import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MoveService } from './move.service';
import { MoveCardDto } from './dto/move-card.dto';
import { MoveListDto } from './dto/move-list.dto';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { BoardRoles } from '../boards/decorators/board-roles.decorator';
import { CurrentBoard } from '../boards/decorators/current-board.decorator';
import type { BoardAccess } from '../boards/board-access.service';

@ApiTags('move')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@BoardRoles('OWNER', 'ADMIN', 'MEMBER')
@Controller()
export class MoveController {
  constructor(private readonly move: MoveService) {}

  @Patch('cards/:cardId/move')
  moveCard(
    @CurrentBoard() access: BoardAccess,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: MoveCardDto,
  ) {
    return this.move.moveCard(access.board.id, cardId, dto);
  }

  @Patch('lists/:listId/move')
  moveList(
    @CurrentBoard() access: BoardAccess,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: MoveListDto,
  ) {
    return this.move.moveList(access.board.id, listId, dto.index);
  }
}