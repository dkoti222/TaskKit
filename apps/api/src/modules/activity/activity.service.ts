import { Injectable } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PageQueryDto, pageArgs, toPage } from '../../common/utils/pagination';
import { CommentsService } from '../comments/comments.service';
import { BoardAccessService } from '../boards/board-access.service';

export class ActivityQueryDto extends PageQueryDto {
  /** Board activity filter chips (screen 20): everything, card changes, or member changes. */
  @IsOptional()
  @IsIn(['all', 'cards', 'members'])
  kind?: 'all' | 'cards' | 'members';
}

const KIND_FILTERS: Record<string, Prisma.ActivityWhereInput> = {
  cards: {
    OR: [
      { type: { startsWith: 'card.' } },
      { type: { startsWith: 'checklist.' } },
      { type: { startsWith: 'comment.' } },
    ],
  },
  members: { type: 'board.member.changed' },
};

const actorFields = { id: true, name: true, avatarUrl: true } as const;

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comments: CommentsService,
    private readonly access: BoardAccessService,
  ) {}

  async listForBoard(boardId: string, query: ActivityQueryDto) {
    const filter = query.kind ? KIND_FILTERS[query.kind] : undefined;
    return this.page({ boardId, ...filter }, query);
  }

  /** Screen 08's "Recent activity": every board in the workspace this member can see. */
  async listForWorkspace(
    workspaceId: string,
    member: { userId: string; role: string },
    query: PageQueryDto,
  ) {
    const boardIds = await this.access.visibleBoardIds(workspaceId, member);
    return this.page({ boardId: { in: boardIds } }, query);
  }

  /** A card's timeline: its changes and its comments (comment.created rows), newest first. */
  async listForCard(cardId: string, query: PageQueryDto) {
    return this.page({ cardId }, query);
  }

  /** Archived lists and cards on a board, with who archived them (screen 18). */
  async archived(boardId: string) {
    const [lists, cards] = await Promise.all([
      this.prisma.list.findMany({
        where: { boardId, archivedAt: { not: null } },
        orderBy: { archivedAt: 'desc' },
        select: {
          id: true,
          name: true,
          archivedAt: true,
          _count: { select: { cards: { where: { archivedAt: null } } } },
        },
      }),
      this.prisma.card.findMany({
        where: { list: { boardId }, archivedAt: { not: null } },
        orderBy: { archivedAt: 'desc' },
        select: {
          id: true,
          title: true,
          archivedAt: true,
          list: { select: { id: true, name: true, archivedAt: true } },
        },
      }),
    ]);

    // "archived by": the most recent archive entry for each item. Items archived before
    // activity existed (Step 10) have none, so archivedBy is null for them.
    const archiveRows = await this.prisma.activity.findMany({
      where: {
        boardId,
        type: { in: ['card.archived', 'list.archived'] },
        data: { path: ['archived'], equals: true },
      },
      orderBy: { createdAt: 'desc' },
      select: { cardId: true, data: true, actor: { select: actorFields } },
    });
    const byCard = new Map<string, (typeof archiveRows)[number]['actor']>();
    const byList = new Map<string, (typeof archiveRows)[number]['actor']>();
    for (const row of archiveRows) {
      if (row.cardId && !byCard.has(row.cardId)) byCard.set(row.cardId, row.actor);
      const listId = (row.data as { listId?: string }).listId;
      if (!row.cardId && listId && !byList.has(listId)) byList.set(listId, row.actor);
    }

    return {
      lists: lists.map((l) => ({
        id: l.id,
        name: l.name,
        archivedAt: l.archivedAt,
        cardCount: l._count.cards,
        archivedBy: byList.get(l.id) ?? null,
      })),
      cards: cards.map((c) => ({
        id: c.id,
        title: c.title,
        archivedAt: c.archivedAt,
        // If the list is archived too, the card can't be seen until the list is restored.
        list: { id: c.list.id, name: c.list.name, archived: !!c.list.archivedAt },
        archivedBy: byCard.get(c.id) ?? null,
      })),
    };
  }

  private async page(where: Prisma.ActivityWhereInput, query: PageQueryDto) {
    const rows = await this.prisma.activity.findMany({
      where,
      include: {
        actor: { select: actorFields },
        board: { select: { id: true, name: true, color: true } },
      },
      ...pageArgs(query),
    });
    const page = toPage(rows, query);

    // Comment entries carry the comment as it is now (edited, or deleted).
    const commentIds = page.items
      .map((r) => (r.type === 'comment.created' ? (r.data as { commentId?: string }).commentId : null))
      .filter((id): id is string => !!id);
    const commentRows = commentIds.length
      ? await this.prisma.comment.findMany({
          where: { id: { in: commentIds } },
          include: { author: { select: actorFields } },
        })
      : [];
    const comments = new Map(
      (await this.comments.present(commentRows)).map((c) => [c.id, c]),
    );

    return {
      nextCursor: page.nextCursor,
      items: page.items.map((r) => ({
        id: r.id,
        type: r.type,
        boardId: r.boardId,
        board: r.board,
        cardId: r.cardId,
        createdAt: r.createdAt,
        actor: r.actor,
        data: r.data,
        ...(r.type === 'comment.created'
          ? { comment: comments.get((r.data as { commentId: string }).commentId) ?? null }
          : {}),
      })),
    };
  }
}
