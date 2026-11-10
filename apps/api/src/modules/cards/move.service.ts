import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { POSITION_GAP, positionAt } from '../../common/utils/position';
import { MoveCardDto } from './dto/move-card.dto';

const CONFLICT_MSG = 'This card was changed by someone else. Refresh and try again.';

@Injectable()
export class MoveService {
  constructor(private readonly prisma: PrismaService) {}

  moveCard(boardId: string, cardId: string, dto: MoveCardDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. The card must exist, and the app must have its latest version
      const card = await tx.card.findUnique({
        where: { id: cardId },
        select: { version: true, archivedAt: true },
      });
      if (!card || card.archivedAt) throw new NotFoundException('Card not found');
      if (card.version !== dto.version) throw new ConflictException(CONFLICT_MSG);

      // 2. The target list must be on the SAME board and not archived
      const list = await tx.list.findUnique({
        where: { id: dto.listId },
        select: { boardId: true, archivedAt: true },
      });
      if (!list || list.boardId !== boardId) {
        throw new BadRequestException('That list is not on this board');
      }
      if (list.archivedAt) throw new BadRequestException("Can't move a card into an archived list");

      // 3. The other cards in the target list, in order
      const siblings = await tx.card.findMany({
        where: { listId: dto.listId, archivedAt: null, id: { not: cardId } },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      const index = Math.min(dto.index, siblings.length);
      let position = positionAt(siblings, index);

      // 4. Too crowded? Renumber the whole list: 1000, 2000, 3000 ...
      if (position === null) {
        const others = siblings.map((s) => s.id);
        others.splice(index, 0, cardId); // put the moved card in its new spot
        for (let i = 0; i < others.length; i++) {
          if (others[i] === cardId) continue;
          await tx.card.update({
            where: { id: others[i] },
            data: { position: (i + 1) * POSITION_GAP },
          });
        }
        position = (index + 1) * POSITION_GAP;
      }

      // 5. Save, but only if nobody changed the card in the meantime
      const result = await tx.card.updateMany({
        where: { id: cardId, version: dto.version },
        data: { listId: dto.listId, position, version: { increment: 1 } },
      });
      if (result.count === 0) throw new ConflictException(CONFLICT_MSG);

      return tx.card.findUnique({
        where: { id: cardId },
        select: { id: true, listId: true, position: true, version: true },
      });
    });
  }

  moveList(boardId: string, listId: string, newIndex: number) {
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.list.findUnique({
        where: { id: listId },
        select: { archivedAt: true },
      });
      if (!list || list.archivedAt) throw new NotFoundException('List not found');

      const siblings = await tx.list.findMany({
        where: { boardId, archivedAt: null, id: { not: listId } },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      const index = Math.min(newIndex, siblings.length);
      let position = positionAt(siblings, index);

      if (position === null) {
        const others = siblings.map((s) => s.id);
        others.splice(index, 0, listId);
        for (let i = 0; i < others.length; i++) {
          if (others[i] === listId) continue;
          await tx.list.update({
            where: { id: others[i] },
            data: { position: (i + 1) * POSITION_GAP },
          });
        }
        position = (index + 1) * POSITION_GAP;
      }

      return tx.list.update({
        where: { id: listId },
        data: { position },
        select: { id: true, position: true },
      });
    });
  }
}