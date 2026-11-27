import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BoardAccessService } from '../boards/board-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { POSITION_GAP, positionAt } from '../../common/utils/position';
import { MoveCardDto } from './dto/move-card.dto';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { BoardEventContext } from '../../common/events/domain-events';

const CONFLICT_MSG = 'This card was changed by someone else. Refresh and try again.';

@Injectable()
export class MoveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly access: BoardAccessService,
  ) {}

  /**
   * Moves a card to `index` in list `dto.listId`. That list can be on another board of the same
   * workspace (screen 26) if you're Owner, Admin or Member there too. Then the card's labels are
   * removed (labels belong to a board) and so are assignees who can't edit the new board.
   */
  async moveCard(ctx: BoardEventContext, cardId: string, dto: MoveCardDto) {
    const target = await this.prisma.list.findUnique({
      where: { id: dto.listId },
      select: { boardId: true, board: { select: { workspaceId: true } } },
    });
    if (!target) throw new BadRequestException('That list doesn’t exist');
    const boardId = target.boardId;
    const crossBoard = boardId !== ctx.boardId;
    const dropAssignees: string[] = [];
    if (crossBoard) {
      const [source, there] = await Promise.all([
        this.prisma.board.findUniqueOrThrow({ where: { id: ctx.boardId }, select: { workspaceId: true } }),
        this.access.resolve(boardId, ctx.actorId),
      ]);
      if (source.workspaceId !== target.board.workspaceId) {
        throw new BadRequestException('Cards can only move to boards in the same workspace');
      }
      if (!there || there.role === 'VIEWER') {
        // Same answer whether the board is hidden from you or you're only a Viewer there.
        throw new ForbiddenException('You can’t add cards to that board');
      }
      const assignees = await this.prisma.cardAssignee.findMany({ where: { cardId }, select: { userId: true } });
      for (const { userId } of assignees) {
        const role = (await this.access.resolve(boardId, userId))?.role;
        if (!role || role === 'VIEWER') dropAssignees.push(userId);
      }
    }
    let fromListId = '';
    const moved = await this.prisma.$transaction(async (tx) => {
      // 1. The card must exist, and the app must have its latest version
      const card = await tx.card.findUnique({
        where: { id: cardId },
        select: { version: true, archivedAt: true, listId: true },
      });
      if (!card || card.archivedAt) throw new NotFoundException('Card not found');
      fromListId = card.listId;
      if (card.version !== dto.version) throw new ConflictException(CONFLICT_MSG);

      // 2. The target list must be on the target board and not archived
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

      // 6. Another board: its labels don't exist there, and some people may not have access.
      if (crossBoard) {
        await tx.cardLabel.deleteMany({ where: { cardId } });
        if (dropAssignees.length) {
          await tx.cardAssignee.deleteMany({ where: { cardId, userId: { in: dropAssignees } } });
        }
      }

      return tx.card.findUniqueOrThrow({
        where: { id: cardId },
        select: { id: true, listId: true, position: true, version: true, list: { select: { boardId: true } } },
      });
    });

    // After the transaction has committed, tell everyone else, on both boards if it changed board.
    const data = {
      cardId,
      fromListId,
      listId: moved.listId,
      position: moved.position,
      version: moved.version,
      ...(crossBoard ? { fromBoardId: ctx.boardId, toBoardId: boardId } : {}),
    };
    this.events.emit({ ...ctx, type: 'card.moved', data });
    if (crossBoard) this.events.emit({ boardId, actorId: ctx.actorId, type: 'card.moved', data });
    const { list: movedList, ...rest } = moved;
    return { ...rest, boardId: movedList.boardId };
  }

  async moveList(ctx: BoardEventContext, listId: string, newIndex: number) {
    const boardId = ctx.boardId;
    const moved = await this.prisma.$transaction(async (tx) => {
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

    this.events.emit({ ...ctx, type: 'list.moved', data: { listId, position: moved.position } });
    return moved;
  }
}