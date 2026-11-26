import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [BoardsModule], // BoardAccessService.visibleBoardIds
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
