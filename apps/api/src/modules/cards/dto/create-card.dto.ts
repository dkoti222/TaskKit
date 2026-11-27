import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCardDto {
  /**
   * Optional id made by the app. Sending the same create twice (a retry after being offline)
   * returns the card made the first time instead of a duplicate.
   */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}