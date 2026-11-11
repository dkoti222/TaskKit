import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BOARD_EVENT_TYPES, type BoardEvent } from '../../common/events/domain-events';

/**
 * Writes one Activity row per board domain event: the board's history.
 *
 * `data` keeps names as they were at that moment (card title, list names, the other person's
 * name), so "Sana moved Login bug from To do to Doing" still reads right after a rename or delete.
 *
 * Not recorded (they'd only add noise):
 * - comment.updated / comment.deleted: the comment.created row shows the comment's current
 *   state (edited or deleted) instead.
 * - a card dragged up or down inside the same list.
 */
@Injectable()
export class ActivityListener implements OnModuleInit {
  private readonly logger = new Logger(ActivityListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  onModuleInit() {
    for (const type of BOARD_EVENT_TYPES) {
      this.emitter.on(type, (event: BoardEvent) => void this.record(event));
    }
  }

  private async record(event: BoardEvent) {
    try {
      const entry = await this.describe(event);
      if (!entry) return;
      await this.prisma.activity.create({
        data: {
          boardId: event.boardId,
          actorId: event.actorId,
          type: event.type,
          cardId: entry.cardId ?? null,
          data: entry.data as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // History is nice to have: never let it break the request that changed something.
      this.logger.error(`Couldn't record ${event.type}`, error instanceof Error ? error.stack : error);
    }
  }

  /** The row's cardId and the names to keep, or null to skip the event. */
  private async describe(
    event: BoardEvent,
  ): Promise<{ cardId?: string; data: Record<string, unknown> } | null> {
    switch (event.type) {
      case 'card.created':
        return {
          cardId: event.data.cardId,
          data: { ...(await this.card(event.data.cardId)), listName: await this.listName(event.data.listId) },
        };
      case 'card.updated':
        return {
          cardId: event.data.cardId,
          data: { ...(await this.card(event.data.cardId)), fields: event.data.fields },
        };
      case 'card.archived':
        return {
          cardId: event.data.cardId,
          data: { ...(await this.card(event.data.cardId)), archived: event.data.archived },
        };
      case 'card.moved': {
        if (event.data.fromListId === event.data.listId) return null;
        return {
          cardId: event.data.cardId,
          data: {
            ...(await this.card(event.data.cardId)),
            fromListName: await this.listName(event.data.fromListId),
            toListName: await this.listName(event.data.listId),
          },
        };
      }
      case 'card.assignee.added':
      case 'card.assignee.removed':
        return {
          cardId: event.data.cardId,
          data: {
            ...(await this.card(event.data.cardId)),
            userId: event.data.userId,
            userName: await this.userName(event.data.userId),
          },
        };
      case 'card.label.added':
      case 'card.label.removed': {
        const label = await this.prisma.label.findUnique({
          where: { id: event.data.labelId },
          select: { name: true, color: true },
        });
        return {
          cardId: event.data.cardId,
          data: {
            ...(await this.card(event.data.cardId)),
            labelName: label?.name ?? null,
            labelColor: label?.color ?? null,
          },
        };
      }
      case 'checklist.changed':
        return {
          cardId: event.data.cardId,
          data: {
            ...(await this.card(event.data.cardId)),
            action: event.data.action,
            text: event.data.text,
          },
        };
      case 'comment.created':
        return {
          cardId: event.data.cardId,
          data: { ...(await this.card(event.data.cardId)), commentId: event.data.commentId },
        };
      case 'comment.updated':
      case 'comment.deleted':
        return null;
      case 'list.created':
      case 'list.updated':
        return { data: { listId: event.data.listId, listName: event.data.name } };
      case 'list.archived':
        return {
          data: {
            listId: event.data.listId,
            listName: await this.listName(event.data.listId),
            archived: event.data.archived,
          },
        };
      case 'list.moved':
        return {
          data: { listId: event.data.listId, listName: await this.listName(event.data.listId) },
        };
      case 'label.created':
      case 'label.deleted':
        return { data: { labelId: event.data.labelId, labelName: event.data.name } };
      case 'board.updated':
        return { data: { changes: event.data.changes } };
      case 'board.member.changed':
        return {
          data: {
            userId: event.data.userId,
            userName: await this.userName(event.data.userId),
            role: event.data.role,
          },
        };
    }
  }

  private async card(cardId: string) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId }, select: { title: true } });
    return { cardTitle: card?.title ?? null };
  }

  private async listName(listId: string) {
    const list = await this.prisma.list.findUnique({ where: { id: listId }, select: { name: true } });
    return list?.name ?? null;
  }

  private async userName(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return user?.name ?? null;
  }
}
