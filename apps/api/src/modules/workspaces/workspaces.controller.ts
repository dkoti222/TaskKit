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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.workspaces.listMine(user.id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workspaces.getOne(user.id, id);
  }

  @Patch(':id')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaces.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('OWNER')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.workspaces.remove(id);
    return { message: 'Workspace deleted' };
  }
}