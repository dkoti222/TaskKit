import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Used for both creating and editing a comment. */
export class CommentBodyDto {
  // Trim first, so a comment of only spaces fails MinLength.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
