import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Signed links for the local driver: a small JSON payload plus an HMAC signature, both
 * base64url. Like a pre-signed S3 URL, whoever has the link can use it until it expires,
 * and nobody can change what it allows without the secret.
 */
export type LinkPayload =
  | { op: 'put'; key: string; size: number; mimeType: string; exp: number }
  | { op: 'get'; key: string; fileName: string; mimeType: string; exp: number };

export function signLink(payload: LinkPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** The payload, or null if the signature is wrong or the link has expired. */
export function verifyLink(token: string, secret: string): LinkPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as LinkPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
