import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardAccessService } from '../boards/board-access.service';
import { nextPosition } from '../../common/utils/position';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateChecklistItemDto } from './dto/checklist-item.dto';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { BoardEventContext } from '../../common/events/domain-events';

const userFields = { id: true, name: true, avatarUrl: true } as const;

@Injectable()
export class CardExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly events: DomainEvents,
  ) {}

  // ---------- Assignees ----------
  async addAssignee(ctx: BoardEventContext, cardId: string, userId: string) {
    const target = await this.access.resolve(ctx.boardId, userId);
    if (!target || target.role === 'VIEWER') {
      throw new BadRequestException("This person can't be assigned on this board");
    }
    // Already assigned: nothing changes, so no version bump and no event (no second notification).
    const existing = await this.prisma.cardAssignee.findUnique({
      where: { cardId_userId: { cardId, userId } },
    });
    if (!existing) {
      await this.prisma.cardAssignee.create({ data: { cardId, userId } });
      await this.bumpVersion(cardId);
      this.events.emit({ ...ctx, type: 'card.assignee.added', data: { cardId, userId } });
    }
    return this.listAssignees(cardId);
  }

  async removeAssignee(ctx: BoardEventContext, cardId: string, userId: string) {
    const removed = await this.prisma.cardAssignee.deleteMany({ where: { cardId, userId } });
    if (removed.count > 0) {
      await this.bumpVersion(cardId);
      this.events.emit({ ...ctx, type: 'card.assignee.removed', data: { cardId, userId } });
    }
    return this.listAssignees(cardId);
  }

  private async listAssignees(cardId: string) {
    const rows = await this.prisma.cardAssignee.findMany({
      where: { cardId },
      include: { user: { select: userFields } },
    });
    return rows.map((r) => r.user);
  }

  // ---------- Labels ----------
  listLabels(boardId: string) {
    return this.prisma.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } });
  }

  async createLabel(ctx: BoardEventContext, dto: CreateLabelDto) {
    const label = await this.prisma.label.create({
      data: { boardId: ctx.boardId, name: dto.name, color: dto.color },
    });
    this.events.emit({
      ...ctx,
      type: 'label.created',
      data: { labelId: label.id, name: label.name },
    });
    return label;
  }

  async deleteLabel(ctx: BoardEventContext, labelId: string) {
    const label = await this.prisma.label.delete({ where: { id: labelId } });
    this.events.emit({ ...ctx, type: 'label.deleted', data: { labelId, name: label.name } });
  }

  async addLabel(ctx: BoardEventContext, cardId: string, labelId: string) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label || label.boardId !== ctx.boardId) {
      throw new BadRequestException('That label is not on this board');
    }
    const existing = await this.prisma.cardLabel.findUnique({
      where: { cardId_labelId: { cardId, labelId } },
    });
    if (!existing) {
      await this.prisma.cardLabel.create({ data: { cardId, labelId } });
      await this.bumpVersion(cardId);
      this.events.emit({ ...ctx, type: 'card.label.added', data: { cardId, labelId } });
    }
    return this.listCardLabels(cardId);
  }

  async removeLabel(ctx: BoardEventContext, cardId: string, labelId: string) {
    const removed = await this.prisma.cardLabel.deleteMany({ where: { cardId, labelId } });
    if (removed.count > 0) {
      await this.bumpVersion(cardId);
      this.events.emit({ ...ctx, type: 'card.label.removed', data: { cardId, labelId } });
    }
    return this.listCardLabels(cardId);
  }

  private async listCardLabels(cardId: string) {
    const rows = await this.prisma.cardLabel.findMany({
      where: { cardId },
      include: { label: true },
    });
    return rows.map((r) => r.label);
  }

  // ---------- Checklist ----------
  async addItem(ctx: BoardEventContext, cardId: string, text: string) {
    const last = await this.prisma.checklistItem.aggregate({
      where: { cardId },
      _max: { position: true },
    });
    const item = await this.prisma.checklistItem.create({
      data: { cardId, text, position: nextPosition(last._max.position) },
    });
    this.events.emit({
      ...ctx,
      type: 'checklist.changed',
      data: { cardId, itemId: item.id, action: 'added', text },
    });
    return item;
  }

  async updateItem(ctx: BoardEventContext, itemId: string, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.checklistItem.update({ where: { id: itemId }, data: dto });
    // Ticking is what people care about; a text edit is "renamed".
    const action = dto.done === undefined ? 'renamed' : dto.done ? 'checked' : 'unchecked';
    this.events.emit({
      ...ctx,
      type: 'checklist.changed',
      data: { cardId: item.cardId, itemId, action, text: item.text },
    });
    return item;
  }

  async deleteItem(ctx: BoardEventContext, itemId: string) {
    const item = await this.prisma.checklistItem.delete({ where: { id: itemId } });
    this.events.emit({
      ...ctx,
      type: 'checklist.changed',
      data: { cardId: item.cardId, itemId, action: 'deleted', text: item.text },
    });
  }

  // ---------- Helper ----------
  private async bumpVersion(cardId: string) {
    await this.prisma.card.update({
      where: { id: cardId },
      data: { version: { increment: 1 } },
    });
  }
}