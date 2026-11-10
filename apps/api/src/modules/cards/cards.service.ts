import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { nextPosition } from '../../common/utils/position';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

const userFields = { id: true, name: true, email: true, avatarUrl: true } as const;

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(listId: string, userId: string, dto: CreateCardDto) {
    const last = await this.prisma.card.aggregate({
      where: { listId },
      _max: { position: true },
    });
    return this.prisma.card.create({
      data: {
        listId,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        position: nextPosition(last._max.position),
        createdById: userId,
      },
    });
  }

  async getDetail(cardId: string) {
    const card = await this.prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: {
        list: { select: { id: true, name: true, boardId: true } },
        createdBy: { select: userFields },
        assignees: { include: { user: { select: userFields } } },
        labels: { include: { label: true } },
        checklistItems: { orderBy: { position: 'asc' } },
      },
    });
    return {
      ...card,
      assignees: card.assignees.map((a) => a.user),
      labels: card.labels.map((l) => l.label),
    };
  }

  update(cardId: string, dto: UpdateCardDto) {
    return this.prisma.card.update({
      where: { id: cardId },
      data: {
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt === undefined ? undefined : dto.dueAt ? new Date(dto.dueAt) : null,
        version: { increment: 1 },
      },
    });
  }

  setArchived(cardId: string, archived: boolean) {
    return this.prisma.card.update({
      where: { id: cardId },
      data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } },
    });
  }
}