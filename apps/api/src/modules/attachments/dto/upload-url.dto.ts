import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** 10 MB. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Images, PDF, Office documents and plain text. */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
] as const;

export class UploadUrlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @IsIn(ALLOWED_MIME_TYPES, {
    message: 'This file type isn’t allowed. Use an image, PDF, Office document or text file.',
  })
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_ATTACHMENT_BYTES, { message: 'Files can be up to 10 MB.' })
  size!: number;
}
