import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Board } from '../../generated/prisma/client';

export type BoardRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type BoardAccess = { board: Board; role: BoardRole };

@Injectable()
export class BoardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(boardId: string, userId: string): Promise<BoardAccess | null> {
    const board = await this.prisma.board.findUnique({ where: { id: boardId } });
    if (!board) return null;

    const workspaceMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
    });
    if (!workspaceMember) return null;

    // Rule 1: workspace Owner is OWNER on every board
    if (workspaceMember.role === 'OWNER') return { board, role: 'OWNER' };

    // Rule 2: added to the board → board role
    const boardMember = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (boardMember) return { board, role: boardMember.role };

    // Rule 3: workspace board → workspace role
    if (board.visibility === 'WORKSPACE') return { board, role: workspaceMember.role };

    // Rule 4: private board, not added → no access
    return null;
  }

  /**
   * Everyone who can see the board, by the same four rules as resolve(): the workspace Owner,
   * people added to the board, and (on WORKSPACE boards) every workspace member.
   */
  async peopleWithAccess(boardId: string): Promise<{ id: string; name: string }[]> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true, visibility: true, members: { select: { userId: true } } },
    });
    if (!board) return [];
    const added = new Set(board.members.map((m) => m.userId));
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: board.workspaceId, user: { deletedAt: null } },
      select: { role: true, user: { select: { id: true, name: true } } },
    });
    return members
      .filter(
        (m) => m.role === 'OWNER' || added.has(m.user.id) || board.visibility === 'WORKSPACE',
      )
      .map((m) => m.user);
  }
}
