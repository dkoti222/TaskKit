import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import type { WorkspaceMember } from '../../generated/prisma/client';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

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

  update(boardId: string, dto: UpdateBoardDto) {
    return this.prisma.board.update({ where: { id: boardId }, data: dto });
  }

  setArchived(boardId: string, archived: boolean) {
    return this.prisma.board.update({
      where: { id: boardId },
      data: { archivedAt: archived ? new Date() : null },
    });
  }
}