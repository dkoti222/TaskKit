import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MoveService } from './move.service';
import { MoveCardDto } from './dto/move-card.dto';
import { MoveListDto } from './dto/move-list.dto';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { BoardRoles } from '../boards/decorators/board-roles.decorator';
import { CurrentActor } from '../boards/decorators/current-actor.decorator';
import type { BoardEventContext } from '../../common/events/domain-events';

@ApiTags('move')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@BoardRoles('OWNER', 'ADMIN', 'MEMBER')
@Controller()
export class MoveController {
  constructor(private readonly move: MoveService) {}

  @Patch('cards/:cardId/move')
  moveCard(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: MoveCardDto,
  ) {
    return this.move.moveCard(actor, cardId, dto);
  }

  @Patch('lists/:listId/move')
  moveList(
    @CurrentActor() actor: BoardEventContext,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: MoveListDto,
  ) {
    return this.move.moveList(actor, listId, dto.index);
  }
}