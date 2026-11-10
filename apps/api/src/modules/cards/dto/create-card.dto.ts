import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCardDto {
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