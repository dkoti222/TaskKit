import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainEvents } from '../../common/events/domain-events.service';
import type { BoardEventContext } from '../../common/events/domain-events';
import type { BoardRole } from '../boards/board-access.service';
import { STORAGE_DRIVER, type StorageDriver } from '../storage/storage.driver';
import type { UploadUrlDto } from './dto/upload-url.dto';

/** How long a download link works. Short, so a forwarded link soon stops working. */
const DOWNLOAD_SECONDS = 10 * 60;

const uploaderFields = { id: true, name: true, avatarUrl: true } as const;

/**
 * Attachments in three steps, so file bytes never go through a JSON request:
 *   1. uploadUrl(): checks role, type and size, saves a *pending* row, returns where to PUT the file
 *   2. the app PUTs the bytes there (to the API's /files, or straight to the S3 bucket)
 *   3. complete(): checks the file arrived with the right size, marks it ready, bumps the card
 * Pending rows (step 3 never happened) are invisible everywhere.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  async uploadUrl(ctx: BoardEventContext, cardId: string, dto: UploadUrlDto, baseUrl: string) {
    const id = randomUUID();
    // The stored name never comes from the user: no "../", no clashes. The extension is kept
    // only for people looking in the folder.
    const ext = extname(dto.fileName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    const storageKey = `cards/${cardId}/${id}${ext}`;
    await this.prisma.attachment.create({
      data: {
        id,
        cardId,
        uploaderId: ctx.actorId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        size: dto.size,
        storageKey,
      },
    });
    const target = await this.storage.uploadTarget({
      key: storageKey,
      mimeType: dto.mimeType,
      size: dto.size,
      baseUrl,
    });
    return { attachmentId: id, upload: target };
  }

  async complete(ctx: BoardEventContext, attachmentId: string, baseUrl: string) {
    const row = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!row || row.deletedAt) throw new NotFoundException('Attachment not found');
    if (row.uploaderId !== ctx.actorId) throw new ForbiddenException('Only the uploader can finish this upload');
    if (row.completedAt) return this.present([row], baseUrl).then((a) => a[0]); // already done

    const stored = await this.storage.size(row.storageKey);
    if (stored === null) throw new BadRequestException('The file hasn’t been uploaded yet');
    if (stored !== row.size) {
      await this.storage.remove(row.storageKey);
      throw new BadRequestException('The uploaded file doesn’t match the announced size');
    }

    const [attachment] = await this.prisma.$transaction([
      this.prisma.attachment.update({
        where: { id: attachmentId },
        data: { completedAt: new Date() },
        include: { uploader: { select: uploaderFields } },
      }),
      this.prisma.card.update({ where: { id: row.cardId }, data: { version: { increment: 1 } } }),
    ]);
    this.events.emit({
      ...ctx,
      type: 'card.attachment.added',
      data: { cardId: row.cardId, attachmentId, fileName: row.fileName },
    });
    return (await this.present([attachment], baseUrl))[0];
  }

  async list(cardId: string, baseUrl: string) {
    const rows = await this.prisma.attachment.findMany({
      where: { cardId, completedAt: { not: null }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { uploader: { select: uploaderFields } },
    });
    return this.present(rows, baseUrl);
  }

  async downloadUrl(attachmentId: string, baseUrl: string) {
    const row = await this.findReady(attachmentId);
    const url = await this.storage.downloadUrl({
      key: row.storageKey,
      fileName: row.fileName,
      mimeType: row.mimeType,
      baseUrl,
      expiresIn: DOWNLOAD_SECONDS,
    });
    return { url, expiresAt: new Date(Date.now() + DOWNLOAD_SECONDS * 1000) };
  }

  /** The uploader, or a board Owner or Admin. Soft delete for the row; the file itself goes. */
  async remove(ctx: BoardEventContext, role: BoardRole, attachmentId: string) {
    const row = await this.findReady(attachmentId);
    if (row.uploaderId !== ctx.actorId && role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only the uploader or a board Admin can delete this file');
    }
    await this.prisma.$transaction([
      this.prisma.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } }),
      this.prisma.card.update({ where: { id: row.cardId }, data: { version: { increment: 1 } } }),
    ]);
    await this.storage.remove(row.storageKey).catch(() => undefined);
    this.events.emit({
      ...ctx,
      type: 'card.attachment.removed',
      data: { cardId: row.cardId, attachmentId, fileName: row.fileName },
    });
  }

  private async findReady(attachmentId: string) {
    const row = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!row || row.deletedAt || !row.completedAt) throw new NotFoundException('Attachment not found');
    return row;
  }

  /**
   * What the app gets. Images also carry a short-lived `previewUrl` for the thumbnail, so the
   * card screen doesn't need a request per image.
   */
  private async present(
    rows: {
      id: string;
      cardId: string;
      fileName: string;
      mimeType: string;
      size: number;
      storageKey: string;
      createdAt: Date;
      uploader?: { id: string; name: string; avatarUrl: string | null };
    }[],
    baseUrl: string,
  ) {
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        cardId: r.cardId,
        fileName: r.fileName,
        mimeType: r.mimeType,
        size: r.size,
        createdAt: r.createdAt,
        uploader: r.uploader ?? null,
        previewUrl: r.mimeType.startsWith('image/')
          ? await this.storage.downloadUrl({
              key: r.storageKey,
              fileName: r.fileName,
              mimeType: r.mimeType,
              baseUrl,
              expiresIn: DOWNLOAD_SECONDS,
            })
          : null,
      })),
    );
  }
}
