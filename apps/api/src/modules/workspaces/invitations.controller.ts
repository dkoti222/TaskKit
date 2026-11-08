import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';
import { CurrentMembership } from './decorators/current-membership.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import type { WorkspaceMember } from '../../generated/prisma/client';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@WorkspaceRoles('OWNER', 'ADMIN')
@Controller('workspaces/:workspaceId/invitations')
export class WorkspaceInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(
    @CurrentMembership() actor: WorkspaceMember,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(actor, workspaceId, dto);
  }

  @Get()
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.invitations.listPending(workspaceId);
  }

  @Delete(':invitationId')
  @HttpCode(200)
  async revoke(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    await this.invitations.revoke(workspaceId, invitationId);
    return { message: 'Invitation revoked' };
  }
}

@ApiTags('invitations')
@ApiBearerAuth()
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':token')
  preview(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invitations.preview(user, token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invitations.accept(user, token);
  }
}