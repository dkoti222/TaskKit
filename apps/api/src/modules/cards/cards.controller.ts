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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('cards')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('lists/:listId/cards')
export class ListCardsController {
  constructor(private readonly cards: CardsService) {}

  @Post()
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentUser() user: AuthUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.cards.create(listId, user.id, dto);
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
  update(@Param('cardId', ParseUUIDPipe) cardId: string, @Body() dto: UpdateCardDto) {
    return this.cards.update(cardId, dto);
  }

  @Post('archive')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  archive(@Param('cardId', ParseUUIDPipe) cardId: string) {
    return this.cards.setArchived(cardId, true);
  }

  @Post('restore')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  restore(@Param('cardId', ParseUUIDPipe) cardId: string) {
    return this.cards.setArchived(cardId, false);
  }
}