import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import { BoardAccessService } from '../boards/board-access.service';

/** What we keep on each socket after it has logged in. */
export type SocketData = { userId: string; expiryTimer?: NodeJS.Timeout };

export const boardRoom = (boardId: string) => `board:${boardId}`;
/** Every socket of one user (all their phones). Used for `notification:new` (Step 11). */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * The WebSocket entry point. It shares the HTTP server and port (3000), at path /socket.io.
 *
 * - Connect: the client sends its access token in `handshake.auth.token`. A missing, bad or
 *   expired token is refused before the connection opens (`connect_error: unauthorized`).
 *   When the token expires later, the socket gets `auth:expired` and is disconnected, so the
 *   app refreshes its token and connects again.
 * - `board:join { boardId }`: checks access with the same rules as HTTP, then joins the room
 *   `board:<id>`. Replies `{ ok: true, role }` or `{ ok: false, error }`.
 * - `board:leave { boardId }`: leaves the room.
 * - Every socket is also in `user:<id>` from the start, for `notification:new`.
 *
 * Sending events to the rooms is done by RealtimeListener.
 */
@SkipThrottle()
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly access: BoardAccessService,
  ) {}

  afterInit(server: Server) {
    // Socket.IO middleware: runs once per connection attempt, before 'connection'.
    server.use(async (socket, next) => {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('unauthorized'));
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; exp: number }>(token);
        const data = socket.data as SocketData;
        data.userId = payload.sub;
        // Don't let a socket keep listening after its token has expired.
        const msLeft = payload.exp * 1000 - Date.now();
        data.expiryTimer = setTimeout(() => {
          socket.emit('auth:expired');
          socket.disconnect(true);
        }, msLeft);
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });
  }

  /** Runs after the auth middleware let the socket in. */
  async handleConnection(socket: Socket) {
    await socket.join(userRoom((socket.data as SocketData).userId));
  }

  handleDisconnect(socket: Socket) {
    clearTimeout((socket.data as SocketData).expiryTimer);
  }

  @SubscribeMessage('board:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: { boardId?: unknown }) {
    const boardId = body?.boardId;
    if (typeof boardId !== 'string' || !isUUID(boardId)) {
      return { ok: false, error: 'boardId must be a UUID' };
    }
    const access = await this.access.resolve(boardId, (socket.data as SocketData).userId);
    // Same answer as HTTP: don't reveal whether a board you can't see exists.
    if (!access) return { ok: false, error: 'Not found' };

    await socket.join(boardRoom(boardId));
    return { ok: true, role: access.role };
  }

  @SubscribeMessage('board:leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() body: { boardId?: unknown }) {
    if (typeof body?.boardId === 'string') await socket.leave(boardRoom(body.boardId));
    return { ok: true };
  }

  /** Board ids that have at least one socket listening right now. */
  activeBoardIds(): string[] {
    const ids: string[] = [];
    for (const room of this.server.of('/').adapter.rooms.keys()) {
      if (room.startsWith('board:')) ids.push(room.slice('board:'.length));
    }
    return ids;
  }

  /**
   * Runs the access rules again for everyone in a board's room. Anyone who lost access gets
   * `board:access-removed` and is taken out of the room.
   */
  async recheckRoom(boardId: string) {
    const room = boardRoom(boardId);
    const sockets = await this.server.in(room).fetchSockets();
    for (const socket of sockets) {
      const userId = (socket.data as SocketData).userId;
      const access = await this.access.resolve(boardId, userId);
      if (!access) {
        socket.emit('board:access-removed', { boardId });
        socket.leave(room);
        this.logger.log(`Removed user ${userId} from ${room}`);
      }
    }
  }

  /** The board is gone: everyone in its room is told and removed. */
  closeRoom(boardId: string) {
    const room = boardRoom(boardId);
    this.server.to(room).emit('board:access-removed', { boardId });
    this.server.in(room).socketsLeave(room);
  }
}
