import { IsInt, IsUUID, Min } from 'class-validator';

export class MoveCardDto {
  @IsUUID()
  listId!: string;

  @IsInt()
  @Min(0)
  index!: number;

  @IsInt()
  @Min(0)
  version!: number;
}