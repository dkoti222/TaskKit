import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { WorkspaceMember } from '../../generated/prisma/client';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard';
import { CurrentMembership } from '../workspaces/decorators/current-membership.decorator';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Any workspace member. Only boards they can see are searched (private boards only for their
   * members). `?q=&boardId=&labelId=&assigneeId=&due=overdue|week&cursor=&limit=20`
   */
  @Get()
  search(
    @CurrentMembership() member: WorkspaceMember,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.search(member, workspaceId, query);
  }
}
