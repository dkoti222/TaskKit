import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AttachmentsService } from './attachments.service';
import { UploadUrlDto } from './dto/upload-url.dto';
import { BoardRoleGuard } from '../boards/guards/board-role.guard';
import { BoardRoles } from '../boards/decorators/board-roles.decorator';
import { CurrentActor } from '../boards/decorators/current-actor.decorator';
import { CurrentBoard } from '../boards/decorators/current-board.decorator';
import type { BoardAccess } from '../boards/board-access.service';
import type { BoardEventContext } from '../../common/events/domain-events';

/**
 * "http://192.168.1.24:3000/api/v1": links for the local storage driver must point at the
 * address the phone used to reach us, so we build them from this request.
 */
const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}/api/v1`;

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('cards/:cardId/attachments')
export class CardAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /** Anyone with access. Ready files only, newest first. */
  @Get()
  list(@Param('cardId', ParseUUIDPipe) cardId: string, @Req() req: Request) {
    return this.attachments.list(cardId, baseUrl(req));
  }

  /** Step 1 of 3: checks role, type (allowlist) and size (≤ 10 MB); returns where to PUT. */
  @Post('upload-url')
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  uploadUrl(
    @CurrentActor() actor: BoardEventContext,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: UploadUrlDto,
    @Req() req: Request,
  ) {
    return this.attachments.uploadUrl(actor, cardId, dto, baseUrl(req));
  }
}

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(BoardRoleGuard)
@Controller('attachments/:attachmentId')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /** Step 3 of 3: the uploader confirms; the file must be there with the announced size. */
  @Post('complete')
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  complete(
    @CurrentActor() actor: BoardEventContext,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() req: Request,
  ) {
    return this.attachments.complete(actor, attachmentId, baseUrl(req));
  }

  /** Anyone with access: a link valid for 10 minutes. */
  @Get('download')
  download(@Param('attachmentId', ParseUUIDPipe) attachmentId: string, @Req() req: Request) {
    return this.attachments.downloadUrl(attachmentId, baseUrl(req));
  }

  /** The uploader, or a board Owner or Admin. */
  @Delete()
  @HttpCode(200)
  @BoardRoles('OWNER', 'ADMIN', 'MEMBER')
  async remove(
    @CurrentActor() actor: BoardEventContext,
    @CurrentBoard() access: BoardAccess,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    await this.attachments.remove(actor, access.role, attachmentId);
    return { message: 'Attachment deleted' };
  }
}
