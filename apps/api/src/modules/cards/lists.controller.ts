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
import { ListsService } from './lists.service';
import { CreateListDto } from './dto/create-list.dto';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { BoardRoles } from '../boards/decorators/board-roles.decorator';
import { CurrentBoard } from '../boards/decorators/current-board.decorator';
import type { BoardAccess } from '../boards/board-access.service';

@ApiTags('lists')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('boards/:boardId')
export class BoardContentController {
  constructor(private readonly lists: ListsService) {}

  @Get('content')
  content(@Param('boardId', ParseUUIDPipe) _boardId: string, @CurrentBoard() access: BoardAccess) {
    return this.lists.getBoardContent(access);
  }

  @Post('lists')
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  create(@Param('boardId', ParseUUIDPipe) boardId: string, @Body() dto: CreateListDto) {
    return this.lists.create(boardId, dto.name);
  }
}

@ApiTags('lists')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@BoardRoles('OWNER', 'ADMIN', 'MEMBER')
@Controller('lists/:listId')
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Patch()
  rename(@Param('listId', ParseUUIDPipe) listId: string, @Body() dto: CreateListDto) {
    return this.lists.rename(listId, dto.name);
  }

  @Post('archive')
  @HttpCode(200)
  archive(@Param('listId', ParseUUIDPipe) listId: string) {
    return this.lists.setArchived(listId, true);
  }

  @Post('restore')
  @HttpCode(200)
  restore(@Param('listId', ParseUUIDPipe) listId: string) {
    return this.lists.setArchived(listId, false);
  }
}