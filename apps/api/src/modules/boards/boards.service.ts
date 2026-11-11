import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import type { WorkspaceMember } from '../../generated/prisma/client';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { BoardEventContext } from '../../common/events/domain-events';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  async create(member: WorkspaceMember, workspaceId: string, dto: CreateBoardDto) {
    const board = await this.prisma.board.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color,
        visibility: dto.visibility,
        createdById: member.userId,
        members: { create: { userId: member.userId, role: 'ADMIN' } },
      },
    });
    return { ...board, role: member.role === 'OWNER' ? 'OWNER' : 'ADMIN' };
  }

  async listForMember(member: WorkspaceMember, workspaceId: string, archived: boolean) {
    const isOwner = member.role === 'OWNER';

    const boards = await this.prisma.board.findMany({
      where: {
        workspaceId,
        archivedAt: archived ? { not: null } : null,
        ...(isOwner
          ? {}
          : {
              OR: [
                { visibility: 'WORKSPACE' },
                { members: { some: { userId: member.userId } } },
              ],
            }),
      },
      include: { members: { where: { userId: member.userId }, select: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return boards.map(({ members, ...board }) => ({
      ...board,
      role: isOwner ? 'OWNER' : (members[0]?.role ?? member.role),
    }));
  }

  async update(ctx: BoardEventContext, dto: UpdateBoardDto) {
    const board = await this.prisma.board.update({ where: { id: ctx.boardId }, data: dto });
    // A visibility change (WORKSPACE -> PRIVATE) can remove people's access.
    this.events.emit({ ...ctx, type: 'board.updated', data: { changes: { ...dto } } });
    return board;
  }

  async setArchived(ctx: BoardEventContext, archived: boolean) {
    const board = await this.prisma.board.update({
      where: { id: ctx.boardId },
      data: { archivedAt: archived ? new Date() : null },
    });
    this.events.emit({ ...ctx, type: 'board.updated', data: { changes: { archived } } });
    return board;
  }
}