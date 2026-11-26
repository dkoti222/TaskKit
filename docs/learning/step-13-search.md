# Step 13: Search

## What was built
`GET /workspaces/:id/search` finds cards by words in their title or description, across every board
you can see in a workspace, with filters (board, label, assignee, due) and highlighted matches. On
the phone, screen 21 is a Search tab: type, filter with chips, see results grouped by board, and
tap one to open the card. Recent searches are kept on the phone.

Migration `cards_search`: a `search` column on `cards` plus a GIN index. No new packages.

## New concepts

**Full-text search vs `LIKE`.** `title ILIKE '%login%'` reads every card and only finds that exact
spelling. Postgres full-text search turns text into a `tsvector`: a sorted list of word *stems*
with their positions ("logins", "logging" → `login`). It drops stop words ("the", "and"). A
query becomes a `tsquery` (`login:* & api:*`), and `search @@ query` asks "does this card match?".
`ts_rank` scores how well it matches, and `ts_headline` marks where.

**A generated column, and why the migration was edited by hand.** `search` must always match
the card's title and description. Instead of updating it in every service that changes a card,
Postgres computes it: `GENERATED ALWAYS AS (setweight(to_tsvector('english', title), 'A') ||
setweight(to_tsvector('english', description), 'B')) STORED`. Weight A (title) ranks above B
(description). Prisma can't describe that, so the steps were:
1. Add `search Unsupported("tsvector")?` and `@@index([search], type: Gin)` to the schema.
2. `npx prisma migrate dev --create-only --name cards_search`: Prisma writes the SQL but doesn't run it.
3. Edit `migration.sql` by hand: change the plain `ADD COLUMN "search" tsvector` into the
   `GENERATED ALWAYS AS (…) STORED` version.
4. `npx prisma migrate dev` to apply it, then `npx prisma generate`.
5. Put the same expression in the schema as `@default(dbgenerated("…"))`, written exactly as
   Postgres reports it. Otherwise Prisma thinks the column changed, and every future migration
   would try to "fix" it. `prisma migrate diff` now reports an empty migration.

`Unsupported` fields are left out of the Prisma client, so our code can never write `search` by
mistake.

**A GIN index.** A normal (B-tree) index sorts whole values, which doesn't help with "contains this
word". A GIN ("generalized inverted") index is like the index at the back of a book: for every
stem, the list of cards that contain it. Postgres uses it for `search @@ query`.

**Raw SQL without SQL injection.** Prisma's query builder can't do `@@`, `ts_rank` or
`ts_headline`, so `SearchService` uses `$queryRaw` with a *tagged template*:
``$queryRaw`… WHERE c.search @@ to_tsquery('english', ${tsquery}) …` ``. Each `${…}` is sent to
Postgres as a separate parameter (`$1`, `$2`…), never pasted into the SQL text. Text like
`'; DROP TABLE cards; --` is only ever a value to search for. Optional filters are built as
`Prisma.sql` fragments and joined with `Prisma.join`, which keeps the same guarantee. Never use
`$queryRawUnsafe` or string concatenation for this. The tests try several injection strings.

**Never leaking cards.** The query only looks at board ids from `visibleBoardIds`, which applies
the same rules as opening a board. A `boardId` filter is intersected with that list, so asking for
a private board you can't see returns nothing, the same as no matches.

**Short queries and paging.** Stems need a few letters, so 1–2 character queries use
`ILIKE '%ap%'`, with `%` and `_` escaped so they mean themselves. Ranked results have no natural
"after this id", so the cursor here is the position in the list (base64 of an offset). Results
can shift a little if cards change while you scroll, which is fine for search.

## Files touched and why
| File | Why |
|---|---|
| `prisma/schema.prisma`, migration `…_cards_search` (edited by hand) | Generated `search` column + GIN index |
| `src/modules/search/dto/search-query.dto.ts` | `q`, filters, cursor and limit validation |
| `src/modules/search/search.service.ts` | Visible boards, full-text or ILIKE query, highlights, paging |
| `src/modules/search/search.controller.ts`, `search.module.ts` | The endpoint (`WorkspaceRoleGuard`: members only) |
| `src/app.module.ts` | Registers `SearchModule` |

## How a search flows
1. Sana types "logi" on screen 21. After 300 ms without typing, the app calls
   `GET /workspaces/:id/search?q=logi`.
2. `WorkspaceRoleGuard` checks she's a member of the workspace (404 if not) and attaches her membership.
3. `visibleBoardIds` lists the boards she can see: not App v2, which is private and she isn't on it.
4. "logi" has 3+ characters, so the words become `logi:*`, and Postgres runs
   `to_tsquery('english', $1)` against the GIN index, only on those boards and only for cards
   that aren't archived.
5. Results come back ranked, with `ts_headline` marking "Login" in the title. The service turns
   the marks into `titleParts: [{ text: "Login", match: true }, { text: " API returns…", match: false }]`.
6. The app groups the results by board and highlights the `match` pieces.
