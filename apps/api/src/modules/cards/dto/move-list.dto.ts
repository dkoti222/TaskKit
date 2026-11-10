import { IsInt, Min } from 'class-validator';

export class MoveListDto {
  @IsInt()
  @Min(0)
  index!: number;
}