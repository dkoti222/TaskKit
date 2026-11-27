# TaskKit

TaskKit is a Trello-style team task app with role-based access (Owner, Admin, Member, Viewer).
The owner is learning **backend** development by writing `apps/api` himself. Frontend work in
`apps/mobile` can be done by Claude, following the rules below.

## Repo layout

```
TaskKit/
├── apps/api/        NestJS 12 + Prisma 7 + PostgreSQL + Socket.IO (written by the owner; do not edit unless asked,
│                    except for the steps in docs/plan-steps-9-14.md)
├── apps/mobile/     Expo (React Native) app with Expo Router — Claude's area
└── docs/
    ├── designs/     Screen designs, named by screen number (01-welcome.png, 02-login.png, …)
    ├── postman/     Postman collection for the API
    ├── learning/    What each backend step built and why (written after each step)
    ├── plan-steps-9-14.md  Build plan for Steps 9–14
    └── decisions.md Architecture decisions
```

- Git: work on the `dev` branch. Commit messages use Conventional Commits with a scope:
  `feat(mobile): add login screen`, `fix(mobile): …`. Don't commit to `main`. Don't push unless asked.
- Never commit `.env` files. Keep `.env.example` up to date.
- Tests (Step 14): `apps/api`: `npm test` (unit), `npm run test:e2e` (needs `.env.test` pointing at
  a `*_test` database; empties it), `npm run test:db:reset`. `apps/mobile`: `npm test`.
  CI runs both apps on every push (`.github/workflows/ci.yml`).
- Without Redis, set `NOTIFICATIONS_ENABLED="false"` in `apps/api/.env`.

## Mobile stack (apps/mobile)

- Expo + TypeScript, **Expo Router** (file-based routes in `apps/mobile/app/`)
- **axios** client in `src/api/client.ts` (base URL from `EXPO_PUBLIC_API_URL`)
- **@tanstack/react-query** for server data (queries and mutations)
- **zustand** for session state (`src/store/`)
- **expo-secure-store** for tokens — never AsyncStorage for tokens
- Folders: `app/` screens · `src/api/` API functions · `src/components/` shared UI ·
  `src/store/` state · `src/theme/` colors and spacing · `src/hooks/` hooks ·
  `src/notifications/` push registration ·
  `src/realtime/` the Socket.IO connection (live board updates; screens use `useBoardRoom(boardId)`)
- Install Expo packages with `npx expo install <pkg>`; ask before adding any other large library.
- Test on a real phone with Expo Go. The phone reaches the API through the Mac's LAN IP,
  set in `apps/mobile/.env` as `EXPO_PUBLIC_API_URL=http://<mac-ip>:3000/api/v1`.

## Design rules

- Match the screenshots in `docs/designs/` closely (layout, spacing, copy).
- Colors (`src/theme/colors.ts`): primary `#2F5BEA`, ink `#16181D`, muted `#5B616E`,
  background `#F5F6F8`, surface `#FFFFFF`, border `#D5D8DE`, danger `#B42335`, success `#12936A`.
- Font: Inter if available, else system. Inputs and buttons 10px radius; cards 14px.
  Primary buttons 52px tall; every touch target at least 44px.
- Sentence-case labels. Show API error messages to the user in plain text under the form.
- Every screen handles loading, error and empty states.

## API (base: `/api/v1`)

All errors return JSON like `{ "statusCode": 400, "message": "…" | ["…"], "error": "Bad Request" }`.
`message` can be a string or an array of validation messages — show the first one.

### Auth (public, no token)
| Method & path | Body | Success |
|---|---|---|
| POST `/auth/register` | `{ name, email, password }` (password ≥ 8 chars with a number) | 201 `{ message }` — a 6-digit code is "emailed" (printed in the API terminal in dev) |
| POST `/auth/verify-email` | `{ email, code }` (6 digits) | 200 `{ accessToken, refreshToken, user }` |
| POST `/auth/resend-code` | `{ email }` | 200 `{ message }` · 429 if asked again within 1 minute |
| POST `/auth/login` | `{ email, password }` | 200 `{ accessToken, refreshToken, user }` · 401 wrong credentials · 403 email not verified |
| POST `/auth/refresh` | `{ refreshToken }` | 200 `{ accessToken, refreshToken }` · 401 invalid/reused (log the user out) |
| POST `/auth/logout` | `{ refreshToken }` | 200 `{ message }` |
| POST `/auth/forgot-password` | `{ email }` | 200 `{ message }` (same message whether or not the email exists) |
| POST `/auth/reset-password` | `{ token, password }` | 200 `{ message }` · 400 invalid/expired token |

Rate limit: register, login, resend-code and forgot-password allow 5 requests per minute (429 after).

### Profile (needs `Authorization: Bearer <accessToken>`)
| Method & path | Body | Success |
|---|---|---|
| GET `/me` | — | 200 `user` |
| PATCH `/me` | any of `{ name, avatarUrl, timezone }` | 200 `user` |
| DELETE `/me` | `{ password }` | 200 `{ message }` · 400 wrong password |

`user` = `{ id, name, email, avatarUrl, timezone, emailVerifiedAt }`

### Sessions (screen 22: active devices)
| Method & path | Success |
|---|---|
| GET `/me/sessions` | `[{ id, deviceName, signedInAt, lastActiveAt, current }]`, one per signed-in device |
| POST `/me/sessions/logout-others` | `{ message, count }`: every other device is signed out at its next refresh (≤ 15 min). 400 "Log in again…" for access tokens from before sessions existed |

- The app sends `X-Device-Name: iPhone 15 · iOS 18.1` on every request; login and verify-email
  store it with the session. Access tokens carry the session id as `sid`.

### Token rules for the app
- Access token: JWT, expires in 15 minutes. Send it as a Bearer header on protected calls.
- Refresh token: random string, 7 days. Store both tokens in SecureStore.
- On a 401 from a protected call: call `/auth/refresh` once (share one in-flight refresh across
  parallel requests), save the new pair, retry the original request. If refresh fails, clear
  tokens and go to Log in with "Your session expired. Log in again."
- Refresh tokens rotate: always save the new refreshToken; reusing an old one logs out every device.
- Reset-password links arrive as `taskkit://reset-password?token=…` (app scheme `taskkit`).

### Where the exact API shapes live
The tables below are a map. **The source of truth is the API code**: before calling an endpoint,
read its controller and DTO in `apps/api/src/modules/**` (or Swagger at `http://localhost:3000/api/docs`)
to confirm the path, body and response shape. Outside the steps in `docs/plan-steps-9-14.md`, read
only — don't edit `apps/api`. If something the app needs is missing from the API (for example the
user's role on a board), stop and tell the owner.

### Workspaces, members, invitations, boards (screens 06–12 are already built)
`/workspaces`, `/workspaces/:id`, `/workspaces/:id/members`, `/workspaces/:id/invitations`,
`/invitations/:token`, `/workspaces/:workspaceId/boards`, `/boards/:boardId`,
`/boards/:boardId/members/:userId` — see `modules/workspaces` and `modules/boards`.
- GET `/workspaces/:workspaceId/boards` also returns `listCount`, `cardCount` (not archived) and
  `memberCount` (people added to the board) per board, for the tiles on screen 08.
- DELETE `/workspaces/:id` (Owner only) deletes the workspace and everything in it.
- Workspaces have `logoUrl` (a signed link, valid 1 hour, or null) and, on GET `/workspaces/:id`,
  the rules `membersCanCreateBoards` and `allowInviteLinks` (both default true). PATCH
  `/workspaces/:id` (Owner, Admin) accepts both rules. `membersCanCreateBoards: false` → Members
  get 403 creating boards. `allowInviteLinks: false` → 403 creating invitations and 400 on
  preview/accept/decline of links already sent.
- Logo (Owner, Admin): POST `/workspaces/:id/logo/upload-url` `{ mimeType: image/png|jpeg|webp, size ≤ 2 MB }`
  → `{ key, upload: { url, method, headers } }`; PUT the bytes; then PUT `/workspaces/:id/logo`
  `{ key }` → the workspace. DELETE `/workspaces/:id/logo` removes it.
- POST `/invitations/:token/decline` (the invited email only, like accept) → the link stops working.

### Board content, lists and cards (Bearer token)
| Method & path | Body | Who |
|---|---|---|
| GET `/boards/:boardId/content` | — | anyone with access · lists (by position) with their cards (by position), each card with labels, assignees, `checklist: { total, done }`, `commentCount` and `attachmentCount` |
| POST `/boards/:boardId/lists` | `{ name }` | Owner, Admin, Member |
| PATCH `/lists/:listId` | `{ name }` | Owner, Admin, Member |
| archive / restore a list | see `lists.controller.ts` | Owner, Admin, Member |
| POST `/lists/:listId/sort` | `{ by: "dueAt" \| "title" \| "newest" \| "oldest" }` | Owner, Admin, Member · reorders the cards once (due date: soonest first, none last) |
| POST `/lists/:listId/archive-cards` | — | Owner, Admin, Member · archives every card in the list → `{ count }` |
| POST `/lists/:listId/cards` | `{ title, … }` see `create-card.dto.ts` | Owner, Admin, Member |
| GET `/cards/:cardId` | — | anyone with access · full card detail |
| PATCH `/cards/:cardId` | see `update-card.dto.ts` | Owner, Admin, Member |
| archive / restore a card | see `cards.controller.ts` | Owner, Admin, Member |

### Card details
| Method & path | Body | Who |
|---|---|---|
| PUT / DELETE `/cards/:cardId/assignees/:userId` | — | Owner, Admin, Member · returns the card's assignees · 400 if the person is a Viewer or has no access |
| GET `/boards/:boardId/labels` | — | anyone with access |
| POST `/boards/:boardId/labels` | `{ name, color }` (`#RRGGBB`) | Owner, Admin |
| DELETE `/labels/:labelId` | — | Owner, Admin |
| PUT / DELETE `/cards/:cardId/labels/:labelId` | — | Owner, Admin, Member · returns the card's labels · 400 if the label is from another board |
| POST `/cards/:cardId/checklist` | `{ text }` | Owner, Admin, Member |
| PATCH `/checklist-items/:itemId` | `{ text?, done? }` | Owner, Admin, Member |
| DELETE `/checklist-items/:itemId` | — | Owner, Admin, Member |

### Comments (Step 10)
| Method & path | Body | Who |
|---|---|---|
| GET `/cards/:cardId/comments?cursor=&limit=20` | — | anyone with access · newest first, deleted ones left out |
| POST `/cards/:cardId/comments` | `{ body }` (1–5000 chars, trimmed) | Owner, Admin, Member |
| PATCH `/comments/:commentId` | `{ body }` | the author only (403 otherwise) · Viewers can't |
| DELETE `/comments/:commentId` | — | the author, or a board Owner/Admin · soft delete · 404 if already deleted |

`comment` = `{ id, cardId, body, createdAt, editedAt, deleted, author: { id, name, avatarUrl }, mentions: [{ id, name }] }`
- **Mentions:** send `@[<userId>]` for someone picked from the @ list. The API also understands a
  typed `@Full Name` (or `@FirstName` when only one person on the board has it). `mentions`
  names everyone written as `@[<userId>]`: show those tokens as `@Name`.
- Only people with board access count as mentioned (used for notifications in Step 11).

### Activity and archived items (Step 10)
| Method & path | Who |
|---|---|
| GET `/boards/:boardId/activity?kind=all\|cards\|members&cursor=&limit=20` | anyone with access · screen 20 |
| GET `/cards/:cardId/activity?cursor=&limit=20` | anyone with access · screen 15's "Comments and activity" |
| GET `/workspaces/:workspaceId/activity?cursor=&limit=20` | any workspace member · screen 08 "Recent activity" · only boards you can see; items also have `board: { id, name, color }` |
| GET `/boards/:boardId/archived` | anyone with access · screen 18 · restore with the existing `POST /lists/:id/restore` and `POST /cards/:id/restore` |

- Paginated lists return `{ items, nextCursor }`, newest first. Pass `nextCursor` as `cursor` for
  the next page; `null` means the end. `limit` is 1–50 (default 20).
- Activity item = `{ id, type, boardId, cardId, createdAt, actor: { id, name, avatarUrl }, data }`.
  `type` is a domain event name (see Realtime). `data` keeps names as they were then:
  `cardTitle`, `listName`, `fromListName`/`toListName` (moves), `fields` (card.updated),
  `archived`, `userName`/`role` (assignees, board members), `labelName`/`labelColor`,
  `action`/`text` (checklist), `changes` (board.updated). Any name can be `null`.
- `comment.created` items also have `comment` (as above, its current state: edited or `deleted`).
- Not recorded: comment edits/deletes (the comment.created item shows them) and a card moved
  within the same list.
- Archived = `{ lists: [{ id, name, archivedAt, cardCount, archivedBy }], cards: [{ id, title,
  archivedAt, list: { id, name, archived }, archivedBy }] }`. `archivedBy` is
  `{ id, name, avatarUrl }` or `null` (archived before Step 10). A card whose `list.archived` is
  true stays hidden until its list is restored.

### Notifications (Step 11)
Your own notifications only (no board roles). Written by a background worker (BullMQ on Redis),
so they appear a moment after the change.

| Method & path | Body | Success |
|---|---|---|
| GET `/notifications?unread=true&cursor=&limit=20` | — | `{ items, nextCursor }`, newest first |
| GET `/notifications/unread-count` | — | `{ count }` |
| POST `/notifications/:id/read` | — | 200 · 404 if it isn't yours |
| POST `/notifications/read-all` | — | `{ updated }` |
| POST `/me/push-tokens` | `{ token, platform: "ios" \| "android" \| "web" }` | 200 · re-saving a token moves it to you |
| DELETE `/me/push-tokens/:token` | — (URL-encode the token) | 200 |
| GET `/me/notification-settings` | — | `{ push, mentionEmail, dueReminders }` (all default true) |
| PATCH `/me/notification-settings` | any of those three booleans | the new settings |

`notification` = `{ id, type, data, readAt, createdAt }`. `type` and when it's sent:
| type | Sent to | `data` |
|---|---|---|
| `card.assigned` | the person assigned (not if you assigned yourself) | actor, board, card |
| `comment.mentioned` | people @mentioned who can see the board | actor, board, card, `commentId`, `preview` |
| `comment.created` | people assigned to the card (minus those mentioned in it) | same as above |
| `workspace.invited` | the invited email, if it already has an account | actor, `workspaceId`/`workspaceName`, `invitationToken`, `role` |
| `card.due` | assignees, once per due date, when it's due within 24 h (checked every 15 min) | board, card, `dueAt` (no actor) |

`data` fields: `actorId`, `actorName`, `workspaceId`, `workspaceName`, `boardId`, `boardName`,
`cardId`, `cardTitle`, `commentId`, `preview` (mentions already written as `@Name`, ≤140 chars),
`invitationToken`, `role`, `dueAt`.
- Nobody is notified about their own action. `dueReminders: false` turns off `card.due`;
  `push: false` keeps notifications in the app only; `mentionEmail` emails mentions (logged to
  the API console in dev).
- Push messages carry `data: { type, boardId, cardId, token }` so a tap can open the card or invite.
- Socket: every socket joins `user:<id>` on connect and gets `notification:new` (the notification).

### Attachments (Step 12)
Upload in three steps, so file bytes never go through a JSON request:
1. POST `/cards/:cardId/attachments/upload-url` `{ fileName, mimeType, size }` (Owner, Admin, Member)
   → 201 `{ attachmentId, upload: { url, method: "PUT", headers } }`. 400 if `mimeType` isn't
   allowed (images: jpeg, png, gif, webp, heic/heif · pdf · Word, Excel, PowerPoint (old and new) ·
   text/plain, csv, markdown) or `size` is over 10 MB (10485760 bytes).
2. `PUT` the raw bytes to `upload.url` with `upload.headers`, no Authorization header (the link is
   signed and lasts 10 minutes). 413 if more bytes than `size` arrive.
3. POST `/attachments/:id/complete` (the uploader) → 200 `attachment`. 400 if the file hasn't
   arrived or its size differs. Bumps the card's `version`.

| Method & path | Who |
|---|---|
| GET `/cards/:cardId/attachments` | anyone with access · ready files, newest first |
| GET `/attachments/:id/download` | anyone with access · `{ url, expiresAt }`, valid 10 minutes, no login needed for the url |
| DELETE `/attachments/:id` | the uploader, or a board Owner/Admin · Viewers never · bumps the card's `version` |

`attachment` = `{ id, cardId, fileName, mimeType, size, createdAt, uploader: { id, name, avatarUrl }, previewUrl }`
(`previewUrl`: images only, a 10-minute link for the thumbnail).
- `STORAGE_DRIVER=local` (default): links point at the API (`/api/v1/files/<signed>`), built from
  the host the request came in on, so the phone gets a LAN-IP link. `s3`: pre-signed bucket URLs.

### Search (Step 13)
GET `/workspaces/:workspaceId/search?q=&boardId=&labelId=&assigneeId=&due=overdue|week&cursor=&limit=20`
- Any workspace member. Only boards they can see are searched (workspace Owner: all; others:
  WORKSPACE boards and boards they were added to). Archived boards, lists and cards are left out.
  A `boardId` you can't see just gives no results.
- Needs `q` or at least one filter (400 otherwise). `q` of 3+ characters: full-text over title
  and description (English stemming, every word must match, words also match as prefixes,
  ranked, title above description). 1–2 characters: plain "contains" (case-insensitive).
- `assigneeId`: "My cards" (send your own id). `due=overdue`: due date passed;
  `due=week`: due in the next 7 days.
- → `{ items, nextCursor }`, item = `{ id, title, titleParts, snippetParts, dueAt, list: { id, name },
  board: { id, name, color } }`. `titleParts` / `snippetParts` are `[{ text, match }]` pieces:
  show `match: true` pieces highlighted. `snippetParts` is a bit of the description, or `null`.

### Moving (drag and drop)
| Method & path | Body | Success |
|---|---|---|
| PATCH `/cards/:cardId/move` | `{ listId, index, version }` | 200 `{ id, listId, position, version }` |
| PATCH `/lists/:listId/move` | `{ index }` | 200 `{ id, position }` |

- `listId` may be on **another board of the same workspace** if you're Owner, Admin or Member
  there (403 otherwise). The card then loses its labels and any assignee who can't edit that
  board; the response includes `boardId`, and `card.moved` goes to both boards' rooms with
  `fromBoardId` / `toBoardId`.
- `index` is where the item was dropped among the **other** items (0 = top). The server works out
  `position`; the app never sends positions. An index past the end means "at the end".
- `version` is the card's current version from the last fetch. Every card change bumps it.
- **409** = someone else changed the card first. Undo the optimistic move, refetch the board
  content, and show "This card was changed by someone else."

### Realtime (Socket.IO, Step 9)
Same host and port as the API, default path `/socket.io` (no `/api/v1` prefix). Use
`socket.io-client` v4.

**Connect:** `io('http://<mac-ip>:3000', { auth: { token: <accessToken> } })`
- Missing, bad or expired token → `connect_error` with `message: "unauthorized"`.
  Refresh the token, then connect again.
- When the access token expires while connected, the server sends `auth:expired` and
  disconnects (reason `io server disconnect`, which does **not** auto-reconnect). Refresh, set
  the new token in `socket.auth`, and call `socket.connect()`.

**Client → server (use acknowledgements: `socket.emitWithAck(...)`)**
| Event | Payload | Reply |
|---|---|---|
| `board:join` | `{ boardId }` | `{ ok: true, role }` · `{ ok: false, error: "Not found" }` (no access) · `{ ok: false, error: "boardId must be a UUID" }` |
| `board:leave` | `{ boardId }` | `{ ok: true }` |

Rooms are lost when the socket reconnects: join again after every `connect`.

**Server → client**
| Event | Payload | Meaning |
|---|---|---|
| `board:event` | `{ type, boardId, actorId, data }` | Something changed on a board you joined |
| `board:access-removed` | `{ boardId }` | You lost access (or the board/workspace was deleted). You're out of the room. Go to screen 31 |
| `auth:expired` | — | Token expired; the server disconnects right after |
| `notification:new` | notification (see Notifications) | A new notification for you (Step 11) |

`board:event` types and their `data`:
| type | data |
|---|---|
| `card.created` | `{ cardId, listId }` |
| `card.updated` | `{ cardId, version, fields }` (`fields`: which of title, description, dueAt changed) |
| `card.archived` | `{ cardId, archived }` (false = restored) |
| `card.moved` | `{ cardId, fromListId, listId, position, version }` |
| `list.created` / `list.updated` | `{ listId, name }` |
| `list.archived` | `{ listId, archived }` |
| `list.moved` | `{ listId, position }` |
| `card.assignee.added` / `card.assignee.removed` | `{ cardId, userId }` |
| `card.label.added` / `card.label.removed` | `{ cardId, labelId }` |
| `checklist.changed` | `{ cardId, itemId, action, text }` (`action`: added, checked, unchecked, renamed, deleted) |
| `label.created` / `label.deleted` | `{ labelId, name }` |
| `comment.created` / `comment.updated` / `comment.deleted` | `{ cardId, commentId }` |
| `card.attachment.added` / `card.attachment.removed` | `{ cardId, attachmentId, fileName }` |
| `board.created` | `{ name }` |
| `list.sorted` | `{ listId, by }` |
| `list.cards.archived` | `{ listId, count }` |
| `board.updated` | `{ changes }` (fields from PATCH, or `{ archived }`) |
| `board.member.changed` | `{ userId, role }` (role `null` = removed from the board) |
| `workspace.member.changed` | `{ userId, role }` (role `null` = left or removed). Sent to every board room of that workspace; roles may have changed |

- Events are sent to everyone in the room, **including the person who made the change**.
  Ignore events whose `actorId` is the current user (already applied optimistically).
- Events are sent only after the write succeeded. A refused write (403, 409…) sends nothing.

### Errors and roles in the app
- **403** wrong role → show "You don't have permission to do that." and refetch.
- **404** on a board, list or card → it was removed or access was lost → screen 31 Access removed.
- Viewers (screen 14) see the same board with **no** add, edit, drag or move controls.
- Lists and cards are always shown sorted by `position` (ascending).

## Screens (numbers match docs/designs)
01 Welcome · 02 Log in · 03 Sign up · 04 Verify email · 05 Forgot password · 06 Your workspaces ·
07 Create workspace · 08 Workspace boards · 09 Create board · 10 Members and roles ·
11 Invite members · 12 Accept invite · 13 Board · 14 Board (Viewer) · 15 Card detail ·
16 New card · 17 Board settings · 18 Archived items · 19 Notifications · 20 Board activity ·
21 Search · 22 Profile and settings · 23 Set new password · 24 Workspace settings ·
25 List actions · 26 Move card · 27 Confirm dialog · 28 Empty: first run · 29 Empty: new board ·
30 Offline · 31 Access removed · 32 Delete account

Only build screens whose APIs exist (listed above). Screens 18–21 are built as part of
`docs/plan-steps-9-14.md` (Steps 10, 11 and 13), together with their APIs.
