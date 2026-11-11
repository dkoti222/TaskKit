import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { BoardRoles } from '../boards/decorators/board-roles.decorator';
import { CurrentActor } from '../boards/decorators/current-actor.decorator';
import type { BoardEventContext } from '../../common/events/domain-events';

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('lists/:listId/cards')
export class ListCardsController {
  constructor(private readonly cards: CardsService) {}

  @Post()
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentActor() actor: BoardEventContext,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.cards.create(actor, listId, dto);
  }
}

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('cards/:cardId')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  getOne(@Param('cardId', ParseUUIDPipe) cardId: string) {
    return this.cards.getDetail(cardId);
  }

  @Patch()
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  update(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cards.update(actor, cardId, dto);
  }

  @Post('archive')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  archive(@CurrentActor() actor: BoardEventContext, @Param('cardId', ParseUUIDPipe) cardId: string) {
    return this.cards.setArchived(actor, cardId, true);
  }

  @Post('restore')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  restore(@CurrentActor() actor: BoardEventContext, @Param('cardId', ParseUUIDPipe) cardId: string) {
    return this.cards.setArchived(actor, cardId, false);
  }
}