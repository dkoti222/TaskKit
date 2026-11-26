import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainEvents } from '../../common/events/domain-events.service';
import { pageArgs, toPage, type PageQueryDto } from '../../common/utils/pagination';
import { MailService } from '../mail/mail.service';
import { PushService } from './push.service';

export type NotificationType =
  | 'card.assigned'
  | 'comment.mentioned'
  | 'comment.created'
  | 'workspace.invited'
  | 'card.due';

/** Names as they were when the notification was made, plus the ids the app needs to open things. */
export type NotificationData = {
  actorId?: string | null;
  actorName?: string | null;
  workspaceId?: string;
  workspaceName?: string;
  boardId?: string;
  boardName?: string;
  cardId?: string;
  cardTitle?: string;
  commentId?: string;
  /** The comment's text, mentions written as @Name, cut to 140 characters. */
  preview?: string;
  invitationToken?: string;
  role?: string;
  dueAt?: string;
};

export type Settings = { push: boolean; mentionEmail: boolean; dueReminders: boolean };

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly push: PushService,
    private readonly mail: MailService,
  ) {}

  // ---------- Delivery (called by the worker) ----------

  /**
   * One notification per user: saves the row, sends it over the socket, then pushes it to their
   * phones if they allow push. Never the person who did the action. Deleted accounts are skipped.
   */
  async deliver(userIds: string[], type: NotificationType, data: NotificationData) {
    const ids = [...new Set(userIds)].filter((id) => id !== data.actorId);
    if (ids.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        email: true,
        notifyPush: true,
        notifyMentionEmail: true,
        notifyDueReminders: true,
      },
    });
    const recipients = type === 'card.due' ? users.filter((u) => u.notifyDueReminders) : users;

    for (const user of recipients) {
      const row = await this.prisma.notification.create({
        data: { userId: user.id, type, data: data as Prisma.InputJsonValue },
      });
      this.events.emit({ type: 'notification.created', userId: user.id, notification: row });
    }

    const text = pushText(type, data);
    await this.push.send(
      recipients
        .filter((u) => u.notifyPush)
        .map((u) => ({
          userId: u.id,
          title: text.title,
          body: text.body,
          data: { type, boardId: data.boardId, cardId: data.cardId, token: data.invitationToken },
        })),
    );

    if (type === 'comment.mentioned') {
      for (const u of recipients.filter((u) => u.notifyMentionEmail)) {
        await this.mail.sendMention(u.email, data.actorName ?? 'Someone', data.cardTitle ?? 'a card', data.preview ?? '');
      }
    }
  }

  // ---------- Endpoints ----------

  async list(userId: string, query: PageQueryDto & { unread?: boolean }) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, ...(query.unread ? { readAt: null } : {}) },
      select: { id: true, type: true, data: true, readAt: true, createdAt: true },
      ...pageArgs(query),
    });
    return toPage(rows, query);
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  /** Only your own: someone else's id is 404, as if it didn't exist. */
  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Notification not found');
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Saving a token that belongs to another account moves it here (same phone, new login). */
  async addPushToken(userId: string, token: string, platform: string) {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
    return { message: 'Push token saved' };
  }

  async removePushToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { userId, token } });
    return { message: 'Push token removed' };
  }

  async getSettings(userId: string): Promise<Settings> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notifyPush: true, notifyMentionEmail: true, notifyDueReminders: true },
    });
    return { push: u.notifyPush, mentionEmail: u.notifyMentionEmail, dueReminders: u.notifyDueReminders };
  }

  async updateSettings(userId: string, patch: Partial<Settings>) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        notifyPush: patch.push,
        notifyMentionEmail: patch.mentionEmail,
        notifyDueReminders: patch.dueReminders,
      },
    });
    return this.getSettings(userId);
  }
}

/** The push notification's title and body. The app writes its own text for screen 19. */
export function pushText(type: NotificationType, d: NotificationData): { title: string; body: string } {
  const who = d.actorName ?? 'Someone';
  const card = d.cardTitle ?? 'a card';
  switch (type) {
    case 'card.assigned':
      return { title: `${who} assigned you to ${card}`, body: d.boardName ?? '' };
    case 'comment.mentioned':
      return { title: `${who} mentioned you in ${card}`, body: d.preview ?? '' };
    case 'comment.created':
      return { title: `${who} commented on ${card}`, body: d.preview ?? '' };
    case 'workspace.invited':
      return { title: `${who} invited you to ${d.workspaceName ?? 'a workspace'}`, body: 'Open TaskKit to accept.' };
    case 'card.due':
      return { title: `${card} is due soon`, body: d.boardName ?? '' };
  }
}
