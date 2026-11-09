import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BoardMembersService } from './board-members.service';
import { SetBoardRoleDto } from './dto/set-board-role.dto';
import { BoardRoleGuard } from './guards/board-role.guard';
import { BoardRoles } from './decorators/board-roles.decorator';
import { CurrentBoard } from './decorators/current-board.decorator';
import type { BoardAccess } from './board-access.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('board members')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('boards/:boardId/members')
export class BoardMembersController {
  constructor(private readonly members: BoardMembersService) {}

  @Get()
  list(@Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.members.list(boardId);
  }

  @Put(':userId')
  @BoardRoles('OWNER', 'ADMIN')
  setRole(
    @CurrentUser() user: AuthUser,
    @CurrentBoard() access: BoardAccess,
    @Param('boardId', ParseUUIDPipe) _boardId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetBoardRoleDto,
  ) {
    return this.members.setRole(user.id, access, userId, dto.role);
  }

  @Delete(':userId')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.members.remove(user.id, boardId, userId);
    return { message: 'Removed from board' };
  }
}