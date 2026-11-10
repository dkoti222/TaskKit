import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateLabelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #D9465A' })
  color!: string;
}