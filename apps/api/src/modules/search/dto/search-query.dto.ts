import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  /** What to look for in card titles and descriptions. 1–2 characters: plain "contains". */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsUUID()
  boardId?: string;

  @IsOptional()
  @IsUUID()
  labelId?: string;

  /** "My cards": the app sends your own id. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /** overdue: due date passed · week: due in the next 7 days. */
  @IsOptional()
  @IsIn(['overdue', 'week'])
  due?: 'overdue' | 'week';

  /** From the previous page's `nextCursor`. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
