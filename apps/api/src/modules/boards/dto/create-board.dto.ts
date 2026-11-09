import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #2F5BEA' })
  color?: string;

  @IsOptional()
  @IsIn(['WORKSPACE', 'PRIVATE'])
  visibility?: 'WORKSPACE' | 'PRIVATE';
}