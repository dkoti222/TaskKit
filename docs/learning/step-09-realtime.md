# Step 9: Realtime (WebSockets)

## What was built
When someone changes a board, every other phone looking at that board hears about it within a
second, with no pull-to-refresh. The API now has:

- a **domain events** layer: services announce "card moved", "list renamed"… after each write
- a **Socket.IO gateway**: phones keep a WebSocket open and join a "room" per board
- a **listener** that turns each domain event into a `board:event` message for that board's room,
  and checks access again when it might have changed (`board:access-removed`)

No database changes this step.

## New concepts

**Domain events.** Before this step, a service did its write and returned. Now, after a
successful write, it also calls `this.events.emit({ type: 'card.moved', boardId, actorId, data })`.
The service doesn't know who is listening. Today only the realtime listener is; in Step 10 an
activity listener will write "Ravi moved *Login bug* to *Doing*", and in Step 11 a notifications
listener will queue push messages. They'll be added without touching the services again. This is
the main reason for the layer. Events are emitted *after* `await` (after a transaction has
committed), so nobody hears about a change that was rolled back. A refused write (403, 409)
emits nothing.

**WebSockets vs HTTP.** HTTP is "ask and get an answer": the server can't speak first. A WebSocket
is a connection that stays open, so the server can push a message whenever something happens.
Socket.IO is a library on top of WebSockets that adds automatic reconnects, named events
(`board:join`, `board:event`), replies (acknowledgements) and rooms. It runs on the same port as
the API (3000), at the path `/socket.io`.

**Rooms.** A room is a named group of sockets on the server. When a phone opens a board, it sends
`board:join`, and after an access check, its socket joins the room `board:<id>`. Sending to a
room reaches everyone in it: `server.to('board:<id>').emit(...)`. A phone looking at another
board isn't in that room, so it gets nothing. Rooms live in memory: after a reconnect the phone
must join again. (With several API servers you'd need a shared adapter, such as Redis, so rooms
work across servers. One server doesn't need it.)

**Socket auth.** Normal routes are protected by `JwtAuthGuard`, which reads the
`Authorization` header on every request. A socket connects once, so the token is checked once,
in a Socket.IO *middleware* (`server.use(...)` in `afterInit`). It reads
`handshake.auth.token` and verifies it with the same secret. A bad token never gets a
connection. Because the connection can outlive the 15-minute token, the gateway sets a timer
for the token's `exp`. When it fires, it sends `auth:expired` and disconnects, and the phone
refreshes and reconnects. `JwtAuthGuard` now skips non-HTTP contexts
(`ctx.getType() !== 'http'`), because sockets were already checked at connect.

**Access can change while you're watching.** If a board becomes PRIVATE, or someone is removed,
people already in the room must stop getting events. Working out exactly who lost access is
fiddly, so the listener re-checks: for `board.updated`, `board.member.changed` and
`workspace.member.changed`, it runs `BoardAccessService.resolve` again for every socket in the
affected rooms. That's the same function the HTTP guard uses, so the rules can't drift apart.
Anyone who fails gets `board:access-removed` and is removed from the room. When a workspace is
deleted, its boards are already gone when the listener runs, so the event carries their ids.

**A gotcha we hit.** `@OnEvent(['card.created', 'card.moved'])` looks like "listen to both", but
EventEmitter2 reads an array as *one* namespaced event name (`card` → `created`), so it
silently listened to nothing. The listener now registers each event name itself in
`onModuleInit`.

## Files touched and why
| File | Why |
|---|---|
| `src/common/events/domain-events.ts` | Event names and typed payloads (`BoardEvent`, `WorkspaceEvent`) and the list of board event names |
| `src/common/events/domain-events.service.ts` | `DomainEvents.emit()`: typed wrapper around EventEmitter2 |
| `src/common/events/events.module.ts` | Global module so every service can inject `DomainEvents` |
| `src/modules/boards/decorators/current-actor.decorator.ts` | `@CurrentActor()` gives `{ boardId, actorId }` from the guard and the logged-in user |
| `cards/*.service.ts`, `boards/*.service.ts`, `workspaces/members.service.ts`, `workspaces/workspaces.service.ts` | Emit an event after each write. Write methods now take `ctx: { boardId, actorId }` (or already had the actor) |
| `cards/*.controller.ts`, `boards/boards.controller.ts`, `workspaces/workspaces.controller.ts` | Pass `@CurrentActor()` / `@CurrentUser()` to the services |
| `src/modules/realtime/realtime.gateway.ts` | Socket auth, `board:join` / `board:leave`, room re-checks |
| `src/modules/realtime/realtime.listener.ts` | Domain events → `board:event`, plus access re-checks |
| `src/modules/realtime/realtime.module.ts` | Wires the gateway and listener; registers `JwtModule` with the same secret |
| `src/modules/auth/guards/jwt-auth.guard.ts` | Skip non-HTTP contexts |
| `src/app.module.ts` | Registers `EventsModule` and `RealtimeModule` |

New packages: `@nestjs/event-emitter`, `@nestjs/websockets`, `@nestjs/platform-socket.io`.

## How a card move flows
1. Ravi drags a card. His phone sends `PATCH /api/v1/cards/:id/move`.
2. `JwtAuthGuard` checks his token, and `BoardRoleGuard` finds the board and his role.
   `@CurrentActor()` builds `{ boardId, actorId: ravi }`.
3. `MoveService.moveCard` runs the transaction (version check, position, save).
4. After the transaction commits, it emits `card.moved` with the new list, position and version.
5. `RealtimeListener` receives it and sends
   `board:event { type: 'card.moved', boardId, actorId, data }` to the room `board:<id>`.
6. John's phone is in that room (it sent `board:join` when he opened the board). It gets the
   event and refetches the board, and the card moves on his screen.
7. Ravi's phone gets the same event too, but ignores it because `actorId` is Ravi: it already
   moved the card optimistically.
