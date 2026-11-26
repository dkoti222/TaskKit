import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { StorageModule } from '../storage/storage.module';
import { AttachmentsController, CardAttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [BoardsModule, StorageModule],
  controllers: [CardAttachmentsController, AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
