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

## Mobile stack (apps/mobile)

- Expo + TypeScript, **Expo Router** (file-based routes in `apps/mobile/app/`)
- **axios** client in `src/api/client.ts` (base URL from `EXPO_PUBLIC_API_URL`)
- **@tanstack/react-query** for server data (queries and mutations)
- **zustand** for session state (`src/store/`)
- **expo-secure-store** for tokens — never AsyncStorage for tokens
- Folders: `app/` screens · `src/api/` API functions · `src/components/` shared UI ·
  `src/store/` state · `src/theme/` colors and spacing · `src/hooks/` hooks
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

### Board content, lists and cards (Bearer token)
| Method & path | Body | Who |
|---|---|---|
| GET `/boards/:boardId/content` | — | anyone with access · lists (by position) with their cards (by position), each card with labels, assignees and `checklist: { total, done }` |
| POST `/boards/:boardId/lists` | `{ name }` | Owner, Admin, Member |
| PATCH `/lists/:listId` | `{ name }` | Owner, Admin, Member |
| archive / restore a list | see `lists.controller.ts` | Owner, Admin, Member |
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

### Moving (drag and drop)
| Method & path | Body | Success |
|---|---|---|
| PATCH `/cards/:cardId/move` | `{ listId, index, version }` | 200 `{ id, listId, position, version }` |
| PATCH `/lists/:listId/move` | `{ index }` | 200 `{ id, position }` |

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

`board:event` types and their `data`:
| type | data |
|---|---|
| `card.created` | `{ cardId, listId }` |
| `card.updated` | `{ cardId, version }` |
| `card.archived` | `{ cardId, archived }` (false = restored) |
| `card.moved` | `{ cardId, listId, position, version }` |
| `list.created` / `list.updated` | `{ listId, name }` |
| `list.archived` | `{ listId, archived }` |
| `list.moved` | `{ listId, position }` |
| `card.assignee.added` / `card.assignee.removed` | `{ cardId, userId }` |
| `card.label.added` / `card.label.removed` | `{ cardId, labelId }` |
| `checklist.changed` | `{ cardId, itemId }` |
| `label.created` / `label.deleted` | `{ labelId }` |
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
