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
import { CurrentBoard } from '../boards/decorators/current-board.decorator';
import type { BoardAccess } from '../boards/board-access.service';

@ApiTags('card details')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@BoardRoles('OWNER', 'ADMIN', 'MEMBER')
@Controller('cards/:cardId')
export class CardExtrasController {
  constructor(private readonly extras: CardExtrasService) {}

  @Put('assignees/:userId')
  addAssignee(
    @CurrentBoard() access: BoardAccess,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.extras.addAssignee(access.board.id, cardId, userId);
  }

  @Delete('assignees/:userId')
  removeAssignee(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.extras.removeAssignee(cardId, userId);
  }

  @Put('labels/:labelId')
  addLabel(
    @CurrentBoard() access: BoardAccess,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.extras.addLabel(access.board.id, cardId, labelId);
  }

  @Delete('labels/:labelId')
  removeLabel(
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.extras.removeLabel(cardId, labelId);
  }

  @Post('checklist')
  addItem(@Param('cardId', ParseUUIDPipe) cardId: string, @Body() dto: CreateChecklistItemDto) {
    return this.extras.addItem(cardId, dto.text);
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
  create(@Param('boardId', ParseUUIDPipe) boardId: string, @Body() dto: CreateLabelDto) {
    return this.extras.createLabel(boardId, dto);
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
  async remove(@Param('labelId', ParseUUIDPipe) labelId: string) {
    await this.extras.deleteLabel(labelId);
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
  update(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: UpdateChecklistItemDto) {
    return this.extras.updateItem(itemId, dto);
  }

  @Delete()
  @HttpCode(200)
  async remove(@Param('itemId', ParseUUIDPipe) itemId: string) {
    await this.extras.deleteItem(itemId);
    return { message: 'Checklist item deleted' };
  }
}