import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class MoveCardDto {
  @IsUUID()
  listId!: string;

  @IsInt()
  @Min(0)
  index!: number;

  @IsInt()
  @Min(0)
  version!: number;

  /**
   * Optional id made by the app for this move. If the card's last move had the same id, the move
   * already happened (a retry): the API answers with the card as it is instead of 409.
   */
  @IsOptional()
  @IsUUID()
  moveId?: string;
}