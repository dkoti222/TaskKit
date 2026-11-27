import { IsIn } from 'class-validator';

export class SortCardsDto {
  @IsIn(['dueAt', 'title', 'newest', 'oldest'])
  by!: 'dueAt' | 'title' | 'newest' | 'oldest';
}
