import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { ListsService } from './lists.service';
import { CardsService } from './cards.service';
import { CardExtrasService } from './card-extras.service';
import { BoardContentController, ListsController } from './lists.controller';
import { CardsController, ListCardsController } from './cards.controller';
import {
  BoardLabelsController,
  CardExtrasController,
  ChecklistItemsController,
  LabelsController,
} from './card-extras.controller';

@Module({
  imports: [BoardsModule],
  controllers: [
    BoardContentController,
    ListsController,
    ListCardsController,
    CardsController,
    CardExtrasController,
    BoardLabelsController,
    LabelsController,
    ChecklistItemsController,
  ],
  providers: [ListsService, CardsService, CardExtrasService],
})
export class CardsModule {}