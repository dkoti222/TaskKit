import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { ListsService } from './lists.service';
import { CardsService } from './cards.service';
import { BoardContentController, ListsController } from './lists.controller';
import { CardsController, ListCardsController } from './cards.controller';

@Module({
  imports: [BoardsModule],
  controllers: [BoardContentController, ListsController, ListCardsController, CardsController],
  providers: [ListsService, CardsService],
})
export class CardsModule {}