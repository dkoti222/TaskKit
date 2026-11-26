import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Prisma, type WorkspaceMember } from '../../generated/prisma/client';
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
    this.events.emit({
      type: 'board.created',
      boardId: board.id,
      actorId: member.userId,
      data: { name: board.name },
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
      include: {
        members: { where: { userId: member.userId }, select: { role: true } },
        _count: { select: { lists: { where: { archivedAt: null } }, members: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Cards per board (not archived, in lists that aren't archived), for "4 lists · 18 cards".
    const cardCounts = new Map<string, number>();
    if (boards.length) {
      const rows = await this.prisma.$queryRaw<{ board_id: string; count: bigint }[]>`
        SELECT l.board_id, count(c.id) AS count
        FROM cards c JOIN lists l ON l.id = c.list_id
        WHERE l.board_id IN (${Prisma.join(boards.map((b) => b.id))})
          AND c.archived_at IS NULL AND l.archived_at IS NULL
        GROUP BY l.board_id`;
      for (const r of rows) cardCounts.set(r.board_id, Number(r.count));
    }

    return boards.map(({ members, _count, ...board }) => ({
      ...board,
      role: isOwner ? 'OWNER' : (members[0]?.role ?? member.role),
      listCount: _count.lists,
      cardCount: cardCounts.get(board.id) ?? 0,
      /** People added to the board (shown on private board tiles). */
      memberCount: _count.members,
    }));
  }

  async update(ctx: BoardEventContext, dto: UpdateBoardDto) {
    const board = await this.prisma.board.update({ where: { id: ctx.boardId }, data: dto });
    // A visibility change (WORKSPACE -> PRIVATE) can remove people's access.
    this.events.emit({ ...ctx, type: 'board.updated', data: { changes: { name: dto.name, color: dto.color, visibility: dto.visibility } } });
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