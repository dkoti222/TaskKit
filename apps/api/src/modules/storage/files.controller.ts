import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream, createWriteStream } from 'fs';
import { rename, rm } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { Public } from '../auth/decorators/public.decorator';
import { LocalStorageDriver } from './local.driver';
import { contentDisposition } from './s3.driver';
import { verifyLink } from './signed-link';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';

/**
 * Upload and download for the `local` storage driver. No login token here: the signed link in
 * the URL is the permission (made by AttachmentsService after its own access checks), exactly
 * like a pre-signed S3 URL. With the `s3` driver these routes answer 404.
 */
@ApiExcludeController()
@Public()
@Controller('files')
export class FilesController {
  private readonly secret: string;

  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('STORAGE_SIGNING_SECRET') || config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private local() {
    if (!(this.driver instanceof LocalStorageDriver)) throw new NotFoundException();
    return this.driver;
  }

  /** The raw file bytes are the request body (not JSON, not multipart). */
  @Put(':token')
  async upload(@Param('token') token: string, @Req() req: Request) {
    const local = this.local();
    const link = verifyLink(token, this.secret);
    if (!link || link.op !== 'put') throw new NotFoundException('This upload link is invalid or expired');
    if (Number(req.headers['content-length'] ?? 0) > link.size) {
      throw new PayloadTooLargeException('The file is bigger than announced');
    }

    // Write to a temporary file, counting bytes, so a cut-off or oversized upload never
    // leaves a broken file behind.
    await local.ensureDir(link.key);
    const final = local.pathFor(link.key);
    const temp = `${final}.part`;
    let received = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _enc, done) {
        received += chunk.length;
        if (received > link.size) done(new PayloadTooLargeException('The file is bigger than announced'));
        else done(null, chunk);
      },
    });
    try {
      await pipeline(req, limit, createWriteStream(temp));
    } catch (error) {
      await rm(temp, { force: true });
      throw error instanceof PayloadTooLargeException ? error : new BadRequestException('Upload failed');
    }
    if (received !== link.size) {
      await rm(temp, { force: true });
      throw new BadRequestException(`Expected ${link.size} bytes, got ${received}`);
    }
    await rename(temp, final);
    return { message: 'Uploaded' };
  }

  @Get(':token')
  async download(@Param('token') token: string, @Res() res: Response) {
    const local = this.local();
    const link = verifyLink(token, this.secret);
    if (!link || link.op !== 'get') throw new NotFoundException('This link is invalid or expired');
    const size = await local.size(link.key);
    if (size === null) throw new NotFoundException('File not found');
    res.set({
      'Content-Type': link.mimeType,
      'Content-Length': String(size),
      'Content-Disposition': contentDisposition(link.fileName),
      'Cache-Control': 'private, max-age=300',
    });
    createReadStream(local.pathFor(link.key)).pipe(res);
  }
}
