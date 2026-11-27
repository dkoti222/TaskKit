import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PageQueryDto } from '../../common/utils/pagination';
import { AuditService } from './audit.service';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';

@ApiTags('audit log')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@WorkspaceRoles('OWNER', 'ADMIN')
@Controller('workspaces/:workspaceId/audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Owner and Admin. Newest first, `?cursor=&limit=20`. */
  @Get()
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string, @Query() query: PageQueryDto) {
    return this.audit.list(workspaceId, query);
  }
}
