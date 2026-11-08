import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role, WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const workspaceId: string | undefined = req.params.workspaceId ?? req.params.id;
    const userId: string | undefined = req.user?.id;

    if (!workspaceId || !userId) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    const allowed = this.reflector.getAllAndOverride<Role[]>(WORKSPACE_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed?.length && !allowed.includes(membership.role)) {
      throw new ForbiddenException('Your role does not allow this action');
    }

    req.membership = membership;
    return true;
  }
}