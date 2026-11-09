import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { BoardAccess } from './board-access.service';

const userFields = { id: true, name: true, email: true, avatarUrl: true } as const;

@Injectable()
export class BoardMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(boardId: string) {
    const members = await this.prisma.boardMember.findMany({
      where: { boardId },
      orderBy: { addedAt: 'asc' },
      include: { user: { select: userFields } },
    });
    return members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      addedAt: m.addedAt,
    }));
  }

  async setRole(
    actorId: string,
    access: BoardAccess,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER',
  ) {
    if (actorId === userId) {
      throw new BadRequestException("You can't change your own board role");
    }

    const workspaceMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: access.board.workspaceId, userId } },
    });
    if (!workspaceMember) {
      throw new BadRequestException('This person must join the workspace first');
    }
    if (workspaceMember.role === 'OWNER') {
      throw new BadRequestException('The workspace Owner always has full access');
    }

    const member = await this.prisma.boardMember.upsert({
      where: { boardId_userId: { boardId: access.board.id, userId } },
      create: { boardId: access.board.id, userId, role },
      update: { role },
      include: { user: { select: userFields } },
    });

    return {
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    };
  }

  async remove(actorId: string, boardId: string, userId: string) {
    if (actorId === userId) {
      throw new BadRequestException("You can't remove yourself here");
    }
    const result = await this.prisma.boardMember.deleteMany({ where: { boardId, userId } });
    if (result.count === 0) {
      throw new NotFoundException('Board member not found');
    }
  }
}