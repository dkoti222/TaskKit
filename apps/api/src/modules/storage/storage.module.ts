import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { FilesController } from './files.controller';
import { LocalStorageDriver } from './local.driver';
import { S3StorageDriver } from './s3.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';

/** Picks the storage driver from STORAGE_DRIVER (`local` or `s3`) once, at startup. */
@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageDriver => {
        if (config.get<string>('STORAGE_DRIVER') === 's3') {
          return new S3StorageDriver(config.getOrThrow<string>('S3_BUCKET'), {
            region: config.get<string>('S3_REGION') ?? 'auto',
            endpoint: config.get<string>('S3_ENDPOINT'),
            accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY_ID'),
            secretAccessKey: config.getOrThrow<string>('S3_SECRET_ACCESS_KEY'),
          });
        }
        return new LocalStorageDriver(
          config.get<string>('UPLOADS_DIR') || join(process.cwd(), 'uploads'),
          config.get<string>('STORAGE_SIGNING_SECRET') || config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        );
      },
    },
  ],
  exports: [STORAGE_DRIVER],
})
export class StorageModule {}
