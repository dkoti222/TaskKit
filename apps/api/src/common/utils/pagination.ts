import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * `?cursor=&limit=` for lists that grow forever (comments, activity).
 *
 * Cursor pagination: instead of "page 3", the client sends the id of the last item it has, and
 * gets the items after it. New rows arriving at the top don't shift the pages, so nothing is
 * shown twice or skipped (which happens with OFFSET when the list changes while you scroll).
 */
export class PageQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number) // query strings are text: "20" → 20
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Prisma options for one page, newest first. Fetches one extra row to know whether there is
 * a next page. Ties on createdAt are broken by id, so the order is always the same.
 */
export function pageArgs(query: PageQueryDto) {
  const take = query.limit ?? 20;
  return {
    take: take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  };
}

/** Turns the rows from pageArgs() into `{ items, nextCursor }`. */
export function toPage<T extends { id: string }>(rows: T[], query: PageQueryDto): Page<T> {
  const take = query.limit ?? 20;
  const items = rows.slice(0, take);
  return { items, nextCursor: rows.length > take ? items[items.length - 1].id : null };
}
