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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { baseUrl } from '../../common/utils/base-url';
import { LogoUploadDto, SetLogoDto } from './dto/logo.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { MembersService } from './members.service';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { CurrentMembership } from './decorators/current-membership.decorator';
import type { WorkspaceMember } from '../../generated/prisma/client';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
    constructor(
    private readonly workspaces: WorkspacesService,
    private readonly members: MembersService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto, @Req() req: Request) {
    return this.workspaces.create(user.id, dto, baseUrl(req));
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.workspaces.listMine(user.id, baseUrl(req));
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.workspaces.getOne(user.id, id, baseUrl(req));
  }

  /** Name, description, and the rules: membersCanCreateBoards, allowInviteLinks. */
  @Patch(':id')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: Request,
  ) {
    return this.workspaces.update(id, dto, baseUrl(req));
  }

  /** Logo step 1: where to PUT the image (PNG, JPEG or WebP, up to 2 MB). */
  @Post(':id/logo/upload-url')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  logoUploadUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogoUploadDto,
    @Req() req: Request,
  ) {
    return this.workspaces.logoUploadUrl(id, dto.mimeType, dto.size, baseUrl(req));
  }

  /** Logo step 2: use the uploaded image. Returns the workspace. */
  @Put(':id/logo')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  setLogo(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetLogoDto, @Req() req: Request) {
    return this.workspaces.setLogo(id, dto.key, baseUrl(req));
  }

  @Delete(':id/logo')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  removeLogo(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.workspaces.removeLogo(id, baseUrl(req));
  }

  @Delete(':id')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.workspaces.remove(user.id, id);
    return { message: 'Workspace deleted' };
  }
    @Post(':id/transfer-ownership')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER')
  transferOwnership(
    @CurrentMembership() actor: WorkspaceMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.members.transferOwnership(actor, id, dto.userId);
  }

  @Post(':id/leave')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  async leave(
    @CurrentMembership() actor: WorkspaceMember,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.members.leave(actor, id);
    return { message: 'You left the workspace' };
  }
}