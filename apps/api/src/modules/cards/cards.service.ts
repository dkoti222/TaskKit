import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { nextPosition } from '../../common/utils/position';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { LIMITS } from '../../common/limits';
import { limitReached } from '../../common/errors/api-errors';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { BoardEventContext } from '../../common/events/domain-events';

const userFields = { id: true, name: true, email: true, avatarUrl: true } as const;

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
  ) {}

  async create(ctx: BoardEventContext, listId: string, dto: CreateCardDto) {
    if (dto.id) {
      const existing = await this.prisma.card.findUnique({ where: { id: dto.id } });
      if (existing) {
        // The same create sent again: answer with what the first one made.
        if (existing.listId === listId && existing.createdById === ctx.actorId) return existing;
        throw new ConflictException('That card id is already used');
      }
    }
    const cards = await this.prisma.card.count({ where: { listId, archivedAt: null } });
    if (cards >= LIMITS.cardsPerList) {
      throw limitReached(`A list can have up to ${LIMITS.cardsPerList} cards.`);
    }
    const last = await this.prisma.card.aggregate({
      where: { listId },
      _max: { position: true },
    });
    const card = await this.prisma.card.create({
      data: {
        ...(dto.id ? { id: dto.id } : {}),
        listId,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        position: nextPosition(last._max.position),
        createdById: ctx.actorId,
      },
    });
    this.events.emit({ ...ctx, type: 'card.created', data: { cardId: card.id, listId } });
    return card;
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

  async update(ctx: BoardEventContext, cardId: string, dto: UpdateCardDto) {
    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt === undefined ? undefined : dto.dueAt ? new Date(dto.dueAt) : null,
        version: { increment: 1 },
      },
    });
    const fields = (['title', 'description', 'dueAt'] as const).filter((f) => dto[f] !== undefined);
    this.events.emit({
      ...ctx,
      type: 'card.updated',
      data: { cardId, version: card.version, fields },
    });
    return card;
  }

  async setArchived(ctx: BoardEventContext, cardId: string, archived: boolean) {
    const card = await this.prisma.card.update({
      where: { id: cardId },
      data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } },
    });
    this.events.emit({ ...ctx, type: 'card.archived', data: { cardId, archived } });
    return card;
  }
}