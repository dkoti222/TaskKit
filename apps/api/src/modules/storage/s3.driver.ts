import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageDriver } from './storage.driver';

const UPLOAD_LINK_SECONDS = 10 * 60;

/**
 * Any S3-compatible bucket: AWS S3, or Cloudflare R2 (set S3_ENDPOINT to
 * https://<account-id>.r2.cloudflarestorage.com and S3_REGION=auto).
 * Links are *pre-signed*: the phone uploads and downloads straight from the bucket.
 */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    options: { region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string },
  ) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint || undefined,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      // R2 and most non-AWS providers want bucket/key in the path, not in the host name.
      forcePathStyle: !!options.endpoint,
    });
  }

  async uploadTarget({ key, mimeType, size }: Parameters<StorageDriver['uploadTarget']>[0]) {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType, ContentLength: size }),
      { expiresIn: UPLOAD_LINK_SECONDS },
    );
    return { url, method: 'PUT' as const, headers: { 'Content-Type': mimeType } };
  }

  async downloadUrl({ key, fileName, mimeType, expiresIn }: Parameters<StorageDriver['downloadUrl']>[0]) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: mimeType,
        ResponseContentDisposition: contentDisposition(fileName),
      }),
      { expiresIn },
    );
  }

  async size(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return head.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/** `inline; filename="…"` with a UTF-8 fallback, so names like "résumé.pdf" survive. */
export function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
