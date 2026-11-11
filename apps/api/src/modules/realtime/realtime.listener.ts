import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ACCESS_EVENT_TYPES,
  BOARD_EVENT_TYPES,
  type BoardEvent,
  type WorkspaceEvent,
} from '../../common/events/domain-events';
import { boardRoom, RealtimeGateway } from './realtime.gateway';

/**
 * Turns domain events into socket messages:
 * - every board event → `board:event { type, boardId, actorId, data }` to `board:<id>`
 * - events that can change access → run the access rules again for that room
 */
@Injectable()
export class RealtimeListener implements OnModuleInit {
  private readonly logger = new Logger(RealtimeListener.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
    private readonly emitter: EventEmitter2,
  ) {}

  onModuleInit() {
    // One listener per board event name. (Passing an array to @OnEvent doesn't do this:
    // EventEmitter2 reads an array as ONE namespaced name, like 'card' → 'created'.)
    for (const type of BOARD_EVENT_TYPES) {
      this.emitter.on(type, (event: BoardEvent) => this.onBoardEvent(event));
    }
  }

  async onBoardEvent(event: BoardEvent) {
    const { type, boardId, actorId, data } = event;
    this.gateway.server.to(boardRoom(boardId)).emit('board:event', { type, boardId, actorId, data });

    if (ACCESS_EVENT_TYPES.includes(type)) {
      await this.safely(() => this.gateway.recheckRoom(boardId));
    }
  }

  @OnEvent('workspace.member.changed')
  async onWorkspaceMemberChanged(event: Extract<WorkspaceEvent, { type: 'workspace.member.changed' }>) {
    await this.safely(async () => {
      // Only boards someone is looking at right now matter.
      const active = this.gateway.activeBoardIds();
      if (active.length === 0) return;
      const boards = await this.prisma.board.findMany({
        where: { id: { in: active }, workspaceId: event.workspaceId },
        select: { id: true },
      });
      for (const { id } of boards) {
        // Roles may have changed for people still on the board, so tell the room too.
        this.gateway.server.to(boardRoom(id)).emit('board:event', {
          type: event.type,
          boardId: id,
          actorId: event.actorId,
          data: event.data,
        });
        await this.gateway.recheckRoom(id);
      }
    });
  }

  @OnEvent('workspace.deleted')
  onWorkspaceDeleted(event: Extract<WorkspaceEvent, { type: 'workspace.deleted' }>) {
    for (const boardId of event.data.boardIds) this.gateway.closeRoom(boardId);
  }

  /** A listener must never crash the request that emitted the event. */
  private async safely(work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      this.logger.error('Realtime listener failed', error instanceof Error ? error.stack : error);
    }
  }
}
