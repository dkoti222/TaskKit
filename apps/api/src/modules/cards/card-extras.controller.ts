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
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CardExtrasService } from './card-extras.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './dto/checklist-item.dto';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { BoardRoles } from '../boards/decorators/board-roles.decorator';
import { CurrentActor } from '../boards/decorators/current-actor.decorator';
import type { BoardEventContext } from '../../common/events/domain-events';

@ApiTags('card details')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@BoardRoles('OWNER', 'ADMIN', 'MEMBER')
@Controller('cards/:cardId')
export class CardExtrasController {
  constructor(private readonly extras: CardExtrasService) {}

  @Put('assignees/:userId')
  addAssignee(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.extras.addAssignee(actor, cardId, userId);
  }

  @Delete('assignees/:userId')
  removeAssignee(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.extras.removeAssignee(actor, cardId, userId);
  }

  @Put('labels/:labelId')
  addLabel(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.extras.addLabel(actor, cardId, labelId);
  }

  @Delete('labels/:labelId')
  removeLabel(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.extras.removeLabel(actor, cardId, labelId);
  }

  @Post('checklist')
  addItem(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.extras.addItem(actor, cardId, dto.text);
  }
}

@ApiTags('labels')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('boards/:boardId/labels')
export class BoardLabelsController {
  constructor(private readonly extras: CardExtrasService) {}

  @Get()
  list(@Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.extras.listLabels(boardId);
  }

  @Post()
  @BoardRoles('OWNER', 'ADMIN')
  create(
    @CurrentActor() actor: BoardEventContext,
    @Param('boardId', ParseUUIDPipe) _boardId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.extras.createLabel(actor, dto);
  }
}

@ApiTags('labels')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@BoardRoles('OWNER', 'ADMIN')
@Controller('labels/:labelId')
export class LabelsController {
  constructor(private readonly extras: CardExtrasService) {}

  @Delete()
  @HttpCode(200)
  async remove(
    @CurrentActor() actor: BoardEventContext,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    await this.extras.deleteLabel(actor, labelId);
    return { message: 'Label deleted' };
  }
}

@ApiTags('checklist')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@BoardRoles('OWNER', 'ADMIN', 'MEMBER')
@Controller('checklist-items/:itemId')
export class ChecklistItemsController {
  constructor(private readonly extras: CardExtrasService) {}

  @Patch()
  update(
    @CurrentActor() actor: BoardEventContext,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.extras.updateItem(actor, itemId, dto);
  }

  @Delete()
  @HttpCode(200)
  async remove(
    @CurrentActor() actor: BoardEventContext,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.extras.deleteItem(actor, itemId);
    return { message: 'Checklist item deleted' };
  }
}