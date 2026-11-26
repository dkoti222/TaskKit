import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardAccessService } from '../boards/board-access.service';
import { mentionTokenIds, parseMentions } from '../comments/mentions';
import { NOTIFICATIONS_QUEUE, type NotificationJob } from './notifications.queue';
import { NotificationsService, type NotificationData } from './notifications.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The worker: takes jobs off the `notifications` queue (in the background, outside any HTTP
 * request), works out who should hear about it and what to say, then delivers.
 * A job that throws is retried by BullMQ (3 attempts, see NotificationsModule).
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { name, data } = job as unknown as NotificationJob;
    switch (name) {
      case 'card.assigned': {
        const info = await this.cardInfo(data.cardId, data.actorId);
        if (!info) return;
        return this.notifications.deliver([data.userId], 'card.assigned', info);
      }
      case 'comment.mentioned': {
        const info = await this.cardInfo(data.cardId, data.actorId, data.commentId);
        if (!info) return;
        return this.notifications.deliver(data.userIds, 'comment.mentioned', info);
      }
      case 'comment.created': {
        const info = await this.cardInfo(data.cardId, data.actorId, data.commentId);
        if (!info) return;
        // Everyone assigned to the card who can still see the board, except people this
        // comment mentions: they already get a "mentioned you" notification.
        const [assignees, comment, people] = await Promise.all([
          this.prisma.cardAssignee.findMany({ where: { cardId: data.cardId }, select: { userId: true } }),
          this.prisma.comment.findUnique({ where: { id: data.commentId }, select: { body: true } }),
          this.access.peopleWithAccess(data.boardId),
        ]);
        const mentioned = new Set(comment ? parseMentions(comment.body, people) : []);
        const canSee = new Set(people.map((p) => p.id));
        const to = assignees.map((a) => a.userId).filter((id) => canSee.has(id) && !mentioned.has(id));
        return this.notifications.deliver(to, 'comment.created', info);
      }
      case 'workspace.invited': {
        // Only people who already have an account get an in-app notification; everyone gets the email.
        const [invitee, workspace, actor] = await Promise.all([
          this.prisma.user.findUnique({ where: { email: data.email }, select: { id: true, deletedAt: true } }),
          this.prisma.workspace.findUnique({ where: { id: data.workspaceId }, select: { name: true } }),
          this.prisma.user.findUnique({ where: { id: data.actorId }, select: { name: true } }),
        ]);
        if (!invitee || invitee.deletedAt || !workspace) return;
        return this.notifications.deliver([invitee.id], 'workspace.invited', {
          actorId: data.actorId,
          actorName: actor?.name ?? null,
          workspaceId: data.workspaceId,
          workspaceName: workspace.name,
          invitationToken: data.token,
          role: data.role,
        });
      }
      case 'due.check':
        return this.checkDueDates();
      default:
        this.logger.warn(`Unknown job ${name as string}`);
    }
  }

  /**
   * Cards due within the next 24 hours whose assignees haven't been reminded about this due
   * date yet. `dueReminderFor` remembers the due date we reminded about, so each due date gets
   * one reminder, and moving the date makes a new one possible.
   */
  async checkDueDates() {
    const now = new Date();
    const cards = await this.prisma.card.findMany({
      where: {
        archivedAt: null,
        dueAt: { gt: now, lte: new Date(now.getTime() + DAY_MS) },
        list: { archivedAt: null, board: { archivedAt: null } },
        assignees: { some: {} },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        dueReminderFor: true,
        assignees: { select: { userId: true } },
        list: { select: { board: { select: { id: true, name: true, workspaceId: true } } } },
      },
    });

    let sent = 0;
    for (const card of cards) {
      if (card.dueReminderFor?.getTime() === card.dueAt!.getTime()) continue;
      // Claim the reminder first, so two workers (or a retry) can't both send it.
      const claimed = await this.prisma.card.updateMany({
        where: { id: card.id, dueAt: card.dueAt, dueReminderFor: card.dueReminderFor },
        data: { dueReminderFor: card.dueAt },
      });
      if (claimed.count === 0) continue;

      const board = card.list.board;
      const canSee = new Set((await this.access.peopleWithAccess(board.id)).map((p) => p.id));
      await this.notifications.deliver(
        card.assignees.map((a) => a.userId).filter((id) => canSee.has(id)),
        'card.due',
        {
          actorId: null,
          workspaceId: board.workspaceId,
          boardId: board.id,
          boardName: board.name,
          cardId: card.id,
          cardTitle: card.title,
          dueAt: card.dueAt!.toISOString(),
        },
      );
      sent++;
    }
    if (sent) this.logger.log(`Due reminders sent for ${sent} card(s)`);
  }

  /** Card, board and actor names (and the comment preview), or null if the card is gone. */
  private async cardInfo(
    cardId: string,
    actorId: string,
    commentId?: string,
  ): Promise<NotificationData | null> {
    const [card, actor, comment] = await Promise.all([
      this.prisma.card.findUnique({
        where: { id: cardId },
        select: {
          title: true,
          list: { select: { board: { select: { id: true, name: true, workspaceId: true } } } },
        },
      }),
      this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }),
      commentId
        ? this.prisma.comment.findUnique({ where: { id: commentId }, select: { body: true, deletedAt: true } })
        : null,
    ]);
    if (!card) return null;
    return {
      actorId,
      actorName: actor?.name ?? null,
      workspaceId: card.list.board.workspaceId,
      boardId: card.list.board.id,
      boardName: card.list.board.name,
      cardId,
      cardTitle: card.title,
      ...(commentId ? { commentId } : {}),
      ...(comment && !comment.deletedAt ? { preview: await this.preview(comment.body) } : {}),
    };
  }

  /** "@[id] see this" → "@Ravi Kumar see this", cut to 140 characters. */
  private async preview(body: string) {
    const ids = mentionTokenIds(body);
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));
    const text = body.replace(/@\[([0-9a-f-]{36})\]/gi, (_, id: string) => `@${names.get(id.toLowerCase()) ?? 'someone'}`);
    return text.length > 140 ? `${text.slice(0, 139)}…` : text;
  }
}
