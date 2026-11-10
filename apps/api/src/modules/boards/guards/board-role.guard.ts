import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { BoardAccessService, BoardRole } from '../board-access.service';
import { BOARD_ROLES_KEY } from '../decorators/board-roles.decorator';

@Injectable()
export class BoardRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: BoardAccessService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.id;
    const boardId = await this.findBoardId(req.params);
    if (!boardId || !userId) throw new NotFoundException('Not found');

    const access = await this.access.resolve(boardId, userId);
    if (!access) throw new NotFoundException('Not found');

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

  private async findBoardId(params: Record<string, string>): Promise<string | undefined> {
    if (params.boardId) return params.boardId;

    if (params.listId) {
      const list = await this.prisma.list.findUnique({
        where: { id: params.listId },
        select: { boardId: true },
      });
      return list?.boardId;
    }

    if (params.cardId) {
      const card = await this.prisma.card.findUnique({
        where: { id: params.cardId },
        select: { list: { select: { boardId: true } } },
      });
      return card?.list.boardId;
    }

    return params.id;
  }
}