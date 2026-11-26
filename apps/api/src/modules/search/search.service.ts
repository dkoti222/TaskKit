import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { WorkspaceMember } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SearchQueryDto } from './dto/search-query.dto';

/** Marks around matches inside ts_headline output. Control characters can't appear in cards. */
const START = '\u0002';
const STOP = '\u0003';

type Row = {
  id: string;
  title: string;
  description: string | null;
  due_at: Date | null;
  list_id: string;
  list_name: string;
  board_id: string;
  board_name: string;
  board_color: string;
  title_hl: string | null;
  snippet_hl: string | null;
};

/** Text split into pieces; `match` pieces are what the search found (shown highlighted). */
export type Highlighted = { text: string; match: boolean }[];

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(member: WorkspaceMember, workspaceId: string, query: SearchQueryDto) {
    const q = query.q ?? '';
    const hasFilter = !!(query.boardId || query.labelId || query.assigneeId || query.due);
    if (!q && !hasFilter) throw new BadRequestException('Type something to search, or pick a filter');

    const boardIds = await this.visibleBoardIds(member, workspaceId);
    // Asking for a board you can't see gives the same empty answer as a board with no matches.
    const boards = query.boardId ? boardIds.filter((id) => id === query.boardId) : boardIds;
    if (boards.length === 0) return { items: [], nextCursor: null };

    const take = query.limit ?? 20;
    const offset = decodeCursor(query.cursor);

    // Every value goes in as a query parameter (${…} in Prisma.sql), never pasted into the SQL
    // text, so nothing a user types can change the query (no SQL injection).
    const filters: Prisma.Sql[] = [
      Prisma.sql`b.id IN (${Prisma.join(boards)})`,
      Prisma.sql`c.archived_at IS NULL AND l.archived_at IS NULL AND b.archived_at IS NULL`,
    ];
    if (query.labelId) {
      filters.push(Prisma.sql`EXISTS (SELECT 1 FROM card_labels cl WHERE cl.card_id = c.id AND cl.label_id = ${query.labelId})`);
    }
    if (query.assigneeId) {
      filters.push(Prisma.sql`EXISTS (SELECT 1 FROM card_assignees ca WHERE ca.card_id = c.id AND ca.user_id = ${query.assigneeId})`);
    }
    if (query.due === 'overdue') filters.push(Prisma.sql`c.due_at < now()`);
    if (query.due === 'week') filters.push(Prisma.sql`c.due_at >= now() AND c.due_at < now() + interval '7 days'`);

    const words = q.match(/[\p{L}\p{N}]+/gu) ?? [];
    let rows: Row[];

    if (q.length >= 3 && words.length) {
      // Full-text: every word must match, the last ones as prefixes ("logi" finds "login").
      const tsquery = words.map((w) => `${w}:*`).join(' & ');
      const where = Prisma.join([...filters, Prisma.sql`c.search @@ query`], ' AND ');
      rows = await this.prisma.$queryRaw<Row[]>`
        SELECT c.id, c.title, c.description, c.due_at,
               l.id AS list_id, l.name AS list_name,
               b.id AS board_id, b.name AS board_name, b.color AS board_color,
               ts_headline('english', c.title, query,
                 ${`StartSel=${START}, StopSel=${STOP}, HighlightAll=true`}) AS title_hl,
               CASE WHEN to_tsvector('english', coalesce(c.description, '')) @@ query
                 THEN ts_headline('english', c.description, query,
                   ${`StartSel=${START}, StopSel=${STOP}, MaxWords=16, MinWords=6, ShortWord=2, MaxFragments=1`})
               END AS snippet_hl
        FROM cards c
        JOIN lists l ON l.id = c.list_id
        JOIN boards b ON b.id = l.board_id,
             to_tsquery('english', ${tsquery}) query
        WHERE ${where}
        ORDER BY ts_rank(c.search, query) DESC, c.updated_at DESC, c.id
        LIMIT ${take + 1} OFFSET ${offset}`;
    } else {
      // 1–2 characters (or only filters): plain "contains", most recently changed first.
      if (q) {
        const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        filters.push(Prisma.sql`(c.title ILIKE ${pattern} OR c.description ILIKE ${pattern})`);
      }
      rows = await this.prisma.$queryRaw<Row[]>`
        SELECT c.id, c.title, c.description, c.due_at,
               l.id AS list_id, l.name AS list_name,
               b.id AS board_id, b.name AS board_name, b.color AS board_color,
               NULL AS title_hl, NULL AS snippet_hl
        FROM cards c
        JOIN lists l ON l.id = c.list_id
        JOIN boards b ON b.id = l.board_id
        WHERE ${Prisma.join(filters, ' AND ')}
        ORDER BY c.updated_at DESC, c.id
        LIMIT ${take + 1} OFFSET ${offset}`;
    }

    const page = rows.slice(0, take);
    return {
      items: page.map((r) => ({
        id: r.id,
        title: r.title,
        titleParts: r.title_hl ? fromHeadline(r.title_hl) : markPlain(r.title, q),
        snippetParts: r.snippet_hl
          ? fromHeadline(r.snippet_hl)
          : q && r.description && !r.title_hl
            ? excerpt(r.description, q)
            : null,
        dueAt: r.due_at,
        list: { id: r.list_id, name: r.list_name },
        board: { id: r.board_id, name: r.board_name, color: r.board_color },
      })),
      nextCursor: rows.length > take ? encodeCursor(offset + take) : null,
    };
  }

  /**
   * The boards this member can see, by the same rules as BoardAccessService.resolve:
   * the workspace Owner sees all; others see WORKSPACE boards and boards they were added to.
   * Archived boards aren't searched.
   */
  async visibleBoardIds(member: WorkspaceMember, workspaceId: string) {
    const boards = await this.prisma.board.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        ...(member.role === 'OWNER'
          ? {}
          : { OR: [{ visibility: 'WORKSPACE' }, { members: { some: { userId: member.userId } } }] }),
      },
      select: { id: true },
    });
    return boards.map((b) => b.id);
  }
}

/** Ranked results can't use "after this id", so the cursor is the position (base64). */
const encodeCursor = (offset: number) => Buffer.from(`o:${offset}`).toString('base64url');
function decodeCursor(cursor?: string) {
  if (!cursor) return 0;
  const match = /^o:(\d{1,6})$/.exec(Buffer.from(cursor, 'base64url').toString());
  if (!match) throw new BadRequestException('Invalid cursor');
  return Number(match[1]);
}

/** "…rotate on every \u0002login\u0003 and…" → pieces with `match` flags. */
function fromHeadline(text: string): Highlighted {
  const parts: Highlighted = [];
  for (const [i, piece] of text.split(new RegExp(`[${START}${STOP}]`)).entries()) {
    if (piece) parts.push({ text: piece, match: i % 2 === 1 });
  }
  return parts;
}

/** Case-insensitive "contains" highlighting, for the 1–2 character search. */
function markPlain(text: string, q: string): Highlighted {
  if (!q) return [{ text, match: false }];
  const parts: Highlighted = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}

/** About 80 characters of the description around the first match. */
function excerpt(description: string, q: string): Highlighted | null {
  const at = description.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return null;
  const start = Math.max(0, at - 40);
  const end = Math.min(description.length, at + q.length + 40);
  const parts = markPlain(description.slice(start, end), q);
  if (start > 0) parts.unshift({ text: '…', match: false });
  if (end < description.length) parts.push({ text: '…', match: false });
  return parts;
}
