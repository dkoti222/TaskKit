# Step 10: Comments, activity and archived items

## What was built
- **Comments** on cards, with @mentions. Edit your own; delete your own, or anyone's if you're
  a board Owner or Admin.
- **Activity**: a history row for every change on a board ("Sana moved *Login bug* from *To do* to
  *Doing*"), shown for the whole board (screen 20) and per card (screen 15).
- **Archived items**: one call that lists a board's archived lists and cards, and who archived
  them, so they can be restored (screen 18).
- Board content now includes a `commentCount` per card.

Migration: `comments_and_activity` (tables `comments` and `activities`).

## New concepts

**Soft delete.** Deleting a comment doesn't remove the row: it sets `deletedAt`. Queries that list
comments add `deletedAt: null`. The row stays, so the card's history can still say "comment
deleted" in the right place, and an accidental delete could be undone by hand. Lists, cards and
boards already worked this way with `archivedAt`. Users too (`deletedAt`), which is why the new
foreign keys to `users` (ON DELETE RESTRICT) don't block deleting an account.

**Cursor pagination.** Activity grows forever, so it comes in pages. With `OFFSET`
("skip 40, take 20"), a new row arriving at the top shifts everything down by one, and you see
an item twice. With a cursor, the client sends the id of the last item it has, and Prisma
continues from that row (`cursor: { id }, skip: 1`). Rows are sorted by `createdAt` and then
`id`, so two rows with the same timestamp always come in the same order. We ask for one more
row than the page size: if it comes back, there's a next page. See
`src/common/utils/pagination.ts`.

**JSON columns.** Each activity type needs different details: a move needs two list names, an
assignee change needs a person's name. Instead of a column for every possible detail,
`Activity.data` is a `Json` column (`jsonb` in Postgres). The names are copied in when the row is
written, a *snapshot*, so renaming a list later doesn't rewrite history. Postgres can still
filter on a JSON field: the archived-items query uses `data: { path: ['archived'], equals: true }`.

**Event listeners as an audit log.** No service writes activity. `ActivityListener` subscribes
to the same domain events as the realtime listener (Step 9) and writes one row per event. Adding
history needed no changes to `MoveService`, `CardsService` and the rest, apart from adding a few
details to their events (the list a card came from, which fields changed, what happened to a
checklist item). Step 11's notifications will be one more listener. A listener runs after the
request has succeeded, and a failure is only logged, so a history problem can never fail a
user's change.

**Mentions.** The app sends `@[<userId>]` when you pick someone from the @ list: an id can't be
misspelled or match two people. Typing `@Ravi Kumar` (or `@Ravi`, if only one person on the
board is called Ravi) works too. `parseMentions` keeps only people with board access
(`BoardAccessService.peopleWithAccess`, the same four rules as `resolve`). It emits
`comment.mentioned`, which nobody listens to yet. Step 11 will.

## Files touched and why
| File | Why |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/…_comments_and_activity` | `Comment` and `Activity` models |
| `src/common/utils/pagination.ts` | `PageQueryDto`, `pageArgs`, `toPage` |
| `src/common/events/domain-events.ts` | Comment events, `comment.mentioned`, and more details on `card.moved`, `card.updated`, `checklist.changed`, `label.*` |
| `src/modules/comments/*` | Comments controller, service, DTO and the mention parser |
| `src/modules/activity/activity.listener.ts` | Domain events → `Activity` rows with name snapshots |
| `src/modules/activity/activity.service.ts`, `activity.controller.ts` | Board and card activity, archived items |
| `src/modules/boards/board-access.service.ts` | `peopleWithAccess(boardId)` |
| `src/modules/boards/guards/board-role.guard.ts` | Finds the board from `:commentId` |
| `src/modules/cards/lists.service.ts` | `commentCount` on board content (`_count` with a filter) |
| `src/modules/cards/{move,cards,card-extras}.service.ts` | The extra event details |
| `src/app.module.ts` | Registers `CommentsModule` and `ActivityModule` |

## How a comment flows
1. Sana picks Ravi from the @ list and sends `POST /cards/:id/comments`
   `{ "body": "@[ravi-id] 7 days or 48 hours?" }`.
2. `BoardRoleGuard` finds the board from `:cardId` and checks she's Owner, Admin or Member.
   `CommentBodyDto` trims the body and checks its length.
3. `CommentsService.create` saves the row, then emits `comment.created`, plus `comment.mentioned`
   with Ravi's id, because he has access and isn't the author.
4. Three listeners hear `comment.created`:
   - the realtime listener sends `board:event` to the board's room, so other phones refetch
   - the activity listener writes an Activity row with the card's title and the comment id
   - (Step 11's notification listener will hear `comment.mentioned`)
5. When John opens the card, `GET /cards/:id/activity` returns that row with the comment
   attached as it is *now*. If Sana edits it later, he sees the new text with "edited". If it's
   deleted, he sees "Comment deleted".
