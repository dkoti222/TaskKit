import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';
import { CurrentMembership } from './decorators/current-membership.decorator';
import type { WorkspaceMember } from '../../generated/prisma/client';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.members.list(workspaceId);
  }

  @Patch(':userId')
  @WorkspaceRoles('OWNER', 'ADMIN')
  changeRole(
    @CurrentMembership() actor: WorkspaceMember,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.members.changeRole(actor, workspaceId, userId, dto.role);
  }

  @Delete(':userId')
  @HttpCode(200)
  @WorkspaceRoles('OWNER', 'ADMIN')
  async remove(
    @CurrentMembership() actor: WorkspaceMember,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.members.remove(actor, workspaceId, userId);
    return { message: 'Member removed' };
  }
}