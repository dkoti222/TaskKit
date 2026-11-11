import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { BoardEventContext } from '../../common/events/domain-events';
import { pageArgs, toPage, type PageQueryDto } from '../../common/utils/pagination';
import { BoardAccessService, type BoardRole } from '../boards/board-access.service';
import { mentionTokenIds, parseMentions } from './mentions';

const authorFields = { id: true, name: true, avatarUrl: true } as const;

type CommentRow = {
  id: string;
  cardId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  author: { id: string; name: string; avatarUrl: string | null };
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly events: DomainEvents,
  ) {}

  async list(cardId: string, query: PageQueryDto) {
    const rows = await this.prisma.comment.findMany({
      where: { cardId, deletedAt: null },
      include: { author: { select: authorFields } },
      ...pageArgs(query),
    });
    const page = toPage(rows, query);
    return { ...page, items: await this.present(page.items) };
  }

  async create(ctx: BoardEventContext, cardId: string, body: string) {
    const comment = await this.prisma.comment.create({
      data: { cardId, authorId: ctx.actorId, body },
      include: { author: { select: authorFields } },
    });
    this.events.emit({ ...ctx, type: 'comment.created', data: { cardId, commentId: comment.id } });
    await this.announceMentions(ctx, comment, []);
    return (await this.present([comment]))[0];
  }

  async update(ctx: BoardEventContext, commentId: string, body: string) {
    const existing = await this.findLive(commentId);
    if (existing.author.id !== ctx.actorId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    const people = await this.access.peopleWithAccess(ctx.boardId);
    const before = parseMentions(existing.body, people);

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body, editedAt: new Date() },
      include: { author: { select: authorFields } },
    });
    this.events.emit({
      ...ctx,
      type: 'comment.updated',
      data: { cardId: comment.cardId, commentId },
    });
    // Only people newly mentioned by the edit hear about it.
    await this.announceMentions(ctx, comment, before, people);
    return (await this.present([comment]))[0];
  }

  /** The author, or a board Owner or Admin. Soft delete: the row stays, marked deleted. */
  async remove(ctx: BoardEventContext, role: BoardRole, commentId: string) {
    const existing = await this.findLive(commentId);
    const isAuthor = existing.author.id === ctx.actorId;
    if (!isAuthor && role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only the author or a board Admin can delete this comment');
    }
    await this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    this.events.emit({
      ...ctx,
      type: 'comment.deleted',
      data: { cardId: existing.cardId, commentId },
    });
  }

  /**
   * The shape the app gets. `mentions` names everyone written as an `@[userId]` token, so the
   * app can show "@Ravi Kumar" instead of the id.
   */
  async present(rows: CommentRow[]) {
    const ids = [...new Set(rows.flatMap((r) => mentionTokenIds(r.body)))];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));

    return rows.map((r) => ({
      id: r.id,
      cardId: r.cardId,
      body: r.deletedAt ? '' : r.body,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      deleted: !!r.deletedAt,
      author: r.author,
      mentions: r.deletedAt
        ? []
        : [...new Set(mentionTokenIds(r.body))]
            .filter((id) => names.has(id))
            .map((id) => ({ id, name: names.get(id)! })),
    }));
  }

  private async findLive(commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { author: { select: authorFields } },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    return comment;
  }

  private async announceMentions(
    ctx: BoardEventContext,
    comment: { id: string; cardId: string; body: string },
    alreadyMentioned: string[],
    people?: { id: string; name: string }[],
  ) {
    const everyone = people ?? (await this.access.peopleWithAccess(ctx.boardId));
    const userIds = parseMentions(comment.body, everyone).filter(
      (id) => id !== ctx.actorId && !alreadyMentioned.includes(id),
    );
    if (userIds.length === 0) return;
    this.events.emit({
      ...ctx,
      type: 'comment.mentioned',
      data: { cardId: comment.cardId, commentId: comment.id, userIds },
    });
  }
}
