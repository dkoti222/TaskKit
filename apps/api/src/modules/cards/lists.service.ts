import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { nextPosition } from '../../common/utils/position';
import type { BoardAccess } from '../boards/board-access.service';

const userFields = { id: true, name: true, avatarUrl: true } as const;

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBoardContent(access: BoardAccess) {
    const lists = await this.prisma.list.findMany({
      where: { boardId: access.board.id, archivedAt: null },
      orderBy: { position: 'asc' },
      include: {
        cards: {
          where: { archivedAt: null },
          orderBy: { position: 'asc' },
          include: {
            assignees: { include: { user: { select: userFields } } },
            labels: { include: { label: true } },
            checklistItems: { select: { done: true } },
          },
        },
      },
    });

    return {
      board: { ...access.board, role: access.role },
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        position: list.position,
        cards: list.cards.map((card) => ({
          id: card.id,
          title: card.title,
          dueAt: card.dueAt,
          position: card.position,
          version: card.version,
          assignees: card.assignees.map((a) => a.user),
          labels: card.labels.map((l) => l.label),
          checklist: {
            total: card.checklistItems.length,
            done: card.checklistItems.filter((i) => i.done).length,
          },
        })),
      })),
    };
  }

  async create(boardId: string, name: string) {
    const last = await this.prisma.list.aggregate({
      where: { boardId },
      _max: { position: true },
    });
    return this.prisma.list.create({
      data: { boardId, name, position: nextPosition(last._max.position) },
    });
  }

  rename(listId: string, name: string) {
    return this.prisma.list.update({ where: { id: listId }, data: { name } });
  }

  setArchived(listId: string, archived: boolean) {
    return this.prisma.list.update({
      where: { id: listId },
      data: { archivedAt: archived ? new Date() : null },
    });
  }
}