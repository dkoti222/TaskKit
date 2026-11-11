# TaskKit build plan: Steps 9–14 (backend + mobile)

This plan is for Claude Code. Read `CLAUDE.md` first; everything there still applies, except that
for the steps in this file you **may edit `apps/api`**.

The owner is learning backend development. So for every backend change:
- Follow the patterns that already exist in `apps/api` (module per feature, DTOs with
  class-validator, `BoardRoleGuard` + `@BoardRoles`, `WorkspaceRoleGuard` + `@WorkspaceRoles`,
  `@CurrentUser()`, `@CurrentBoard()`, soft delete with `archivedAt`, Float `position`). Don't
  restructure existing code unless the step needs it.
- Keep `docs/permissions.md` true. Every new endpoint gets a role rule, and the rule is added there.
- After each step, write `docs/learning/step-NN-<name>.md` (plain English, short): what was built,
  the new concepts (one paragraph each), the files touched and why, and how the request flows
  through the code. The owner will read it to learn.

## How to work (important)
1. Do **one step at a time**, in order. Each step has an API part, then a mobile part.
2. Before starting a step, show a short plan (files to add or change, new packages, migrations)
   and wait for "go".
3. Prisma is pinned to **7.10.1**. Don't upgrade it. After `npx prisma migrate dev --name <name>`,
   always run `npx prisma generate`. Migration names are snake_case.
4. Any new package: say why, then install it (`npm i` in apps/api, `npx expo install` in apps/mobile).
5. Every new controller must be listed in its module's `controllers` array, and every new service
   in `providers`. Check the startup log shows the new routes as "Mapped {…}".
6. At the end of each step:
   - `npm run build` in apps/api shows 0 errors, and existing endpoints still work.
   - Update `CLAUDE.md` (the API tables) and add the new requests to `docs/postman/`.
   - Give the owner a numbered Postman test table (token, method, URL, body, expected status),
     including at least one **permission** case (a Viewer or an outsider gets 403/404).
   - Give phone test steps for the screens.
   - Commit on `dev`, one commit for the API part and one for the mobile part:
     `feat(api): …` / `feat(mobile): …`. Don't push.
   - **Stop** and wait for the owner to say "continue".
7. If something needs an account, a key or a decision from the owner (Redis, storage, push),
   stop and ask. Never invent secrets. Put new env keys in `.env.example` with a comment.

---

## Step 9: Realtime (WebSockets)
**Goal:** when someone changes a board, every other phone looking at that board updates
within a second, without pull-to-refresh.

API
- Add `@nestjs/event-emitter`. Create a small **domain events** layer: the services emit typed
  events after a successful write, e.g. `card.created`, `card.updated`, `card.moved`,
  `card.archived`, `list.created`, `list.updated`, `list.moved`, `list.archived`,
  `card.assignee.added/removed`, `card.label.added/removed`, `checklist.changed`,
  `board.updated`, `board.member.changed`. Each payload has `boardId`, `actorId`, the ids
  involved, and the changed data. (Steps 10 and 11 reuse these same events. That's the point
  of the layer.)
- Add a Socket.IO gateway (`@nestjs/websockets`, `@nestjs/platform-socket.io`) in a `realtime`
  module:
  - Authenticate on connect with the access token from `handshake.auth.token` (same JWT secret).
    Disconnect bad or expired tokens.
  - `board:join { boardId }` checks access with `BoardAccessService.resolve`. If allowed, the
    socket joins room `board:<id>`. Otherwise it replies with an error. `board:leave` leaves the room.
  - A listener turns domain events into `board:event { type, boardId, actorId, data }` sent
    to the room.
  - When a user's board access is removed, send them `board:access-removed` and remove their
    socket from the room.
- Document the socket protocol in `CLAUDE.md`.

Mobile
- Add `socket.io-client`. Create a `src/realtime/socket.ts` connection that sends the current
  access token, reconnects after a token refresh, and joins or leaves the board room when the
  Board or Card detail screen opens or closes.
- On `board:event`, update the TanStack Query cache (or invalidate the board content and card
  detail queries). Ignore events where `actorId` is the current user, because those changes are
  already applied optimistically.
- On `board:access-removed`, go to screen 31 (Access removed).
- Show a small "Reconnecting…" indicator when the socket drops (screen 30 Offline when the
  network is gone).

Test: two phones, or a phone plus Postman, on the same board. A change on one shows up on the
other.

---

## Step 10: Comments, activity and archived items
**Goal:** discuss on cards, see who did what on a board, and restore archived things.

API
- Prisma models:
  - `Comment` (id, cardId, authorId, body, createdAt, editedAt, deletedAt)
  - `Activity` (id, boardId, cardId?, actorId, type, data Json, createdAt), with an index on
    (boardId, createdAt)
- Comments:
  - `GET /cards/:cardId/comments` (anyone with access, cursor pagination: `?cursor=&limit=20`)
  - `POST /cards/:cardId/comments` (Owner, Admin, Member)
  - `PATCH /comments/:commentId` (author only)
  - `DELETE /comments/:commentId` (author, or a board Owner or Admin; soft delete)
  - Teach `BoardRoleGuard.findBoardId` about `commentId`.
- `@mentions`: parse `@Name` or `@[userId]` in comment bodies, keep only users with board
  access, and emit `comment.mentioned` (Step 11 uses it).
- Activity: one listener writes an `Activity` row for every domain event, plus
  `comment.created`. `GET /boards/:boardId/activity` and `GET /cards/:cardId/activity`, both
  with cursor pagination, newest first, including the actor's name and avatar.
- Archived items: `GET /boards/:boardId/archived` returns archived lists and cards, so they
  can be restored with the existing restore endpoints.
- Comment and activity events are also sent over the Step 9 socket.

Mobile
- Card detail (15): comments section with a composer, @-mention picker from board members,
  edit and delete your own comments, and a card activity tab.
- Screen 20 Board activity: infinite scroll ("Ashok moved *Login bug* to *Doing*").
- Screen 18 Archived items: tabs for lists and cards, with a Restore button
  (Owner, Admin, Member).

---

## Step 11: Notifications (queues and push)
**Goal:** people find out when something needs them, even when the app is closed.

Ask the owner first: Redis through **Homebrew** (`brew install redis`, `brew services start redis`)
or **Upstash** (free cloud Redis). Docker is not available on this Mac.

API
- Prisma models:
  - `Notification` (id, userId, type, data Json, readAt, createdAt)
  - `PushToken` (id, userId, token unique, platform, createdAt)
  - Notification settings on User, or a `NotificationPreference` table
- Use BullMQ (`@nestjs/bullmq`) with `REDIS_URL`:
  - Domain-event listeners add jobs to a `notifications` queue. They never send directly, so
    a slow push service can't slow down the API.
  - A worker creates the `Notification` rows and sends Expo push messages with
    `expo-server-sdk`, in batches. Invalid tokens get deleted.
- Triggers:
  - Assigned to a card
  - Mentioned in a comment
  - Comment on a card you're assigned to
  - Invited to a workspace
  - Card due within 24 hours: a repeatable job checks due dates every 15 minutes, with no
    duplicate reminders
- Never notify the person who did the action. Respect the user's notification settings.
- Endpoints:
  - `GET /notifications` (cursor, `?unread=true`) and `GET /notifications/unread-count`
  - `POST /notifications/:id/read` and `POST /notifications/read-all`
  - `POST /me/push-tokens` and `DELETE /me/push-tokens/:token`
  - `GET` and `PATCH /me/notification-settings`
- Send `notification:new` to the user over the socket, using a `user:<id>` room that each socket
  joins on connect.

Mobile
- `expo-notifications`: ask permission after login, register the Expo push token with the
  API, and remove it on logout.
  - Note: push notifications may not work in **Expo Go**, depending on the platform and SDK. If
    they don't, keep in-app notifications working, explain to the owner what a development
    build needs, and stop there.
- Screen 19 Notifications: list, unread dots, mark all read. Tapping a notification opens the
  card or the invitation.
- Unread badge on the tab or header. Live updates from `notification:new`.
- Notification settings in screen 22 (Profile and settings).

---

## Step 12: Attachments
**Goal:** add images and files to cards.

API
- Prisma model `Attachment` (id, cardId, uploaderId, fileName, mimeType, size, storageKey,
  createdAt, deletedAt).
- A `StorageService` interface with two drivers, chosen by `STORAGE_DRIVER`:
  - `local` (the dev default): files saved under `apps/api/uploads/` (add it to .gitignore) and
    served through an authorised download endpoint.
  - `s3`: any S3-compatible storage (Cloudflare R2 or AWS S3) with **pre-signed** upload and
    download URLs. Ask the owner before setting it up.
- Flow:
  1. `POST /cards/:cardId/attachments/upload-url` with `{ fileName, mimeType, size }` checks
     the role (Owner, Admin, Member), the type allowlist (images, pdf, office docs, txt) and the
     max size (10 MB). It returns an upload URL and a pending id.
  2. The app uploads the file.
  3. `POST /attachments/:id/complete` marks it ready and bumps the card version.
- `GET /cards/:cardId/attachments`, `GET /attachments/:id/download` (a short-lived URL, anyone
  with access) and `DELETE /attachments/:id` (the uploader, or a board Owner or Admin).
- Teach the guard about `attachmentId`. Emit `card.attachment.added` and `card.attachment.removed`.

Mobile
- Card detail: an attachments section with `expo-image-picker` and `expo-document-picker`,
  upload progress, image thumbnails, tap to open, and delete. Attachment count on board cards.

---

## Step 13: Search
**Goal:** find any card in a workspace quickly.

API
- PostgreSQL full-text search on cards (title, description):
  - Add a `tsvector` column (`Unsupported("tsvector")` in Prisma, kept up to date with a
    generated column or a trigger) and a **GIN index**.
  - Use `prisma migrate dev --create-only`, then edit the SQL by hand. Explain this in the
    learning doc.
- `GET /workspaces/:workspaceId/search?q=&boardId=&labelId=&assigneeId=&due=overdue|week&cursor=`
  - Only searches boards the user can access (the same effective-role rules; private boards
    only for their members). Never leak cards from other boards.
  - Ranked by `ts_rank`, with a highlighted snippet.
  - Use `$queryRaw` with tagged-template parameters (never string concatenation, to avoid
    SQL injection).
- Fall back to `ILIKE` for 1–2 character queries.

Mobile
- Screen 21 Search: a debounced input (300 ms), filter chips (board, label, assignee, due),
  results grouped by board, recent searches (kept on the device), and empty or no-results
  states. Tapping a result opens the card.

---

## Step 14: Testing and CI
**Goal:** prove it works, automatically, on every push.

API
- A test database: `taskkit_test` in Postgres.app, set as `DATABASE_URL` in `apps/api/.env.test`
  (add `.env.test.example`). A script resets it with `prisma migrate reset --force`.
- **Unit tests** (Jest): `positionAt`, `BoardAccessService.resolve` (every effective-role case),
  token rotation and reuse detection, and the mention parser.
- **e2e tests** (supertest): auth flow, workspace role rules, board access (Owner, Admin,
  Member, Viewer and outsider on WORKSPACE and PRIVATE boards), card move including the 409,
  comments, and search not leaking private boards.
- Add the scripts `npm run test`, `npm run test:e2e` and `npm run test:cov`.

Mobile
- Jest with `jest-expo` and React Native Testing Library: tests for the auth store, the axios
  refresh interceptor (one shared refresh, then retry) and the board cache update after a move.

CI
- `.github/workflows/ci.yml`: on push and on pull requests to `dev` and `main`, with two jobs:
  - **api:** Node LTS, a Postgres service container, `npm ci`, `prisma generate`,
    `prisma migrate deploy`, lint, build, unit tests and e2e tests.
  - **mobile:** `npm ci`, type check (`tsc --noEmit`), lint and tests.
- Add a CI status badge to the README.

---

## Not in this plan
**Step 15 (deploy)** comes after this. The owner will do it separately.
