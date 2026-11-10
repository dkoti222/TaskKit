import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardAccessService } from '../boards/board-access.service';
import { nextPosition } from '../../common/utils/position';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateChecklistItemDto } from './dto/checklist-item.dto';

const userFields = { id: true, name: true, avatarUrl: true } as const;

@Injectable()
export class CardExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  // ---------- Assignees ----------
  async addAssignee(boardId: string, cardId: string, userId: string) {
    const target = await this.access.resolve(boardId, userId);
    if (!target || target.role === 'VIEWER') {
      throw new BadRequestException("This person can't be assigned on this board");
    }
    await this.prisma.cardAssignee.upsert({
      where: { cardId_userId: { cardId, userId } },
      create: { cardId, userId },
      update: {},
    });
    await this.bumpVersion(cardId);
    return this.listAssignees(cardId);
  }

  async removeAssignee(cardId: string, userId: string) {
    await this.prisma.cardAssignee.deleteMany({ where: { cardId, userId } });
    await this.bumpVersion(cardId);
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

  createLabel(boardId: string, dto: CreateLabelDto) {
    return this.prisma.label.create({ data: { boardId, name: dto.name, color: dto.color } });
  }

  async deleteLabel(labelId: string) {
    await this.prisma.label.delete({ where: { id: labelId } });
  }

  async addLabel(boardId: string, cardId: string, labelId: string) {
    const label = await this.prisma.label.findUnique({ where: { id: labelId } });
    if (!label || label.boardId !== boardId) {
      throw new BadRequestException('That label is not on this board');
    }
    await this.prisma.cardLabel.upsert({
      where: { cardId_labelId: { cardId, labelId } },
      create: { cardId, labelId },
      update: {},
    });
    await this.bumpVersion(cardId);
    return this.listCardLabels(cardId);
  }

  async removeLabel(cardId: string, labelId: string) {
    await this.prisma.cardLabel.deleteMany({ where: { cardId, labelId } });
    await this.bumpVersion(cardId);
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
  async addItem(cardId: string, text: string) {
    const last = await this.prisma.checklistItem.aggregate({
      where: { cardId },
      _max: { position: true },
    });
    return this.prisma.checklistItem.create({
      data: { cardId, text, position: nextPosition(last._max.position) },
    });
  }

  updateItem(itemId: string, dto: UpdateChecklistItemDto) {
    return this.prisma.checklistItem.update({ where: { id: itemId }, data: dto });
  }

  async deleteItem(itemId: string) {
    await this.prisma.checklistItem.delete({ where: { id: itemId } });
  }

  // ---------- Helper ----------
  private async bumpVersion(cardId: string) {
    await this.prisma.card.update({
      where: { id: cardId },
      data: { version: { increment: 1 } },
    });
  }
}