import { api } from './client';
import type { Attachment, UploadTarget } from './types';

// Step 12 · attachments. Writing needs board Owner, Admin or Member; reading, any access.

export async function listAttachments(cardId: string) {
  const { data } = await api.get<Attachment[]>(`/cards/${cardId}/attachments`);
  return data;
}

/** Step 1: 400 for a type outside the allowlist or a file over 10 MB. */
export async function requestUpload(
  cardId: string,
  body: { fileName: string; mimeType: string; size: number },
) {
  const { data } = await api.post<{ attachmentId: string; upload: UploadTarget }>(
    `/cards/${cardId}/attachments/upload-url`,
    body,
  );
  return data;
}

/**
 * Step 2: PUT the bytes to the link from step 1 (the API's /files or an S3 bucket). Uses XHR
 * because fetch can't report upload progress. No login token: the link itself is the permission.
 */
export function putFile(
  target: UploadTarget,
  file: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [key, value] of Object.entries(target.headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). Try again.`));
    xhr.onerror = () =>
      reject(new Error("Can't reach the server. Check your connection and try again."));
    xhr.send(file);
  });
}

/** Step 3: the API checks the file arrived and shows it on the card. */
export async function completeUpload(attachmentId: string) {
  const { data } = await api.post<Attachment>(`/attachments/${attachmentId}/complete`);
  return data;
}

/** A link valid for 10 minutes. */
export async function getDownloadUrl(attachmentId: string) {
  const { data } = await api.get<{ url: string; expiresAt: string }>(
    `/attachments/${attachmentId}/download`,
  );
  return data.url;
}

/** The uploader, or a board Owner or Admin. */
export async function deleteAttachment(attachmentId: string) {
  await api.delete(`/attachments/${attachmentId}`);
}
