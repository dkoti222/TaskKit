import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BoardAccessService, BoardRole } from '../board-access.service';
import { BOARD_ROLES_KEY } from '../decorators/board-roles.decorator';

@Injectable()
export class BoardRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: BoardAccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const boardId: string | undefined = req.params.boardId ?? req.params.id;
    const userId: string | undefined = req.user?.id;
    if (!boardId || !userId) throw new NotFoundException('Board not found');

    const access = await this.access.resolve(boardId, userId);
    if (!access) throw new NotFoundException('Board not found');

    const allowed = this.reflector.getAllAndOverride<BoardRole[]>(BOARD_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowed?.length && !allowed.includes(access.role)) {
      throw new ForbiddenException('Your role on this board does not allow this action');
    }

    req.boardAccess = access;
    return true;
  }
}