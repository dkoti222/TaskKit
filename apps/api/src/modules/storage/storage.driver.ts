/**
 * Where attachment files live. Two drivers, picked by STORAGE_DRIVER:
 * - `local` (default): files under apps/api/uploads/, uploaded and downloaded through the API
 *   with short-lived signed links.
 * - `s3`: any S3-compatible bucket (Cloudflare R2, AWS S3) with pre-signed URLs, so files go
 *   straight between the phone and the bucket without passing through the API.
 *
 * Either way the app does the same thing: PUT the bytes to `uploadUrl`, then GET `downloadUrl`.
 */
export interface StorageDriver {
  /** Where the app should PUT the file, valid for a few minutes. */
  uploadTarget(input: {
    key: string;
    mimeType: string;
    size: number;
    baseUrl: string;
  }): Promise<{ url: string; method: 'PUT'; headers: Record<string, string> }>;

  /** A link that downloads the file, valid for `expiresIn` seconds. */
  downloadUrl(input: {
    key: string;
    fileName: string;
    mimeType: string;
    baseUrl: string;
    expiresIn: number;
  }): Promise<string>;

  /** The stored file's size, or null if nothing was uploaded under this key. */
  size(key: string): Promise<number | null>;

  remove(key: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
