import {
  Body,
  Controller,
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
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { BoardRoleGuard } from './guards/board-role.guard';
import { BoardRoles } from './decorators/board-roles.decorator';
import { CurrentBoard } from './decorators/current-board.decorator';
import type { BoardAccess } from './board-access.service';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard';
import { WorkspaceRoles } from '../workspaces/decorators/workspace-roles.decorator';
import { CurrentMembership } from '../workspaces/decorators/current-membership.decorator';
import type { WorkspaceMember } from '../../generated/prisma/client';

@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/boards')
export class WorkspaceBoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Post()
  @WorkspaceRoles('OWNER', 'ADMIN', 'MEMBER')
  create(
    @CurrentMembership() member: WorkspaceMember,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boards.create(member, workspaceId, dto);
  }

  @Get()
  list(
    @CurrentMembership() member: WorkspaceMember,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('archived') archived?: string,
  ) {
    return this.boards.listForMember(member, workspaceId, archived === 'true');
  }
}

@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) _id: string, @CurrentBoard() access: BoardAccess) {
    return { ...access.board, role: access.role };
  }

  @Patch(':id')
  @BoardRoles('OWNER', 'ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBoardDto) {
    return this.boards.update(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.boards.setArchived(id, true);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.boards.setArchived(id, false);
  }
}