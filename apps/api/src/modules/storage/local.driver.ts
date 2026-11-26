import { mkdir, rm, stat } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import type { StorageDriver } from './storage.driver';
import { signLink } from './signed-link';

const UPLOAD_LINK_MS = 10 * 60 * 1000;

/**
 * Files on this computer's disk, under UPLOADS_DIR (default apps/api/uploads, git-ignored).
 * Upload and download links point back at the API (FilesController), signed so only the
 * holder of a fresh link can use them.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly root: string;

  constructor(
    root: string,
    private readonly secret: string,
  ) {
    this.root = resolve(root);
  }

  /** The file's path on disk. Refuses keys that would escape the uploads folder ("../"). */
  pathFor(key: string) {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep)) throw new Error('Bad storage key');
    return path;
  }

  async ensureDir(key: string) {
    await mkdir(dirname(this.pathFor(key)), { recursive: true });
  }

  async uploadTarget({ key, mimeType, size, baseUrl }: Parameters<StorageDriver['uploadTarget']>[0]) {
    const token = signLink({ op: 'put', key, size, mimeType, exp: Date.now() + UPLOAD_LINK_MS }, this.secret);
    return { url: `${baseUrl}/files/${token}`, method: 'PUT' as const, headers: { 'Content-Type': mimeType } };
  }

  async downloadUrl({ key, fileName, mimeType, baseUrl, expiresIn }: Parameters<StorageDriver['downloadUrl']>[0]) {
    const token = signLink({ op: 'get', key, fileName, mimeType, exp: Date.now() + expiresIn * 1000 }, this.secret);
    return `${baseUrl}/files/${token}`;
  }

  async size(key: string) {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await rm(this.pathFor(key), { force: true });
  }
}
