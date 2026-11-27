import { IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export class LogoUploadDto {
  @IsIn(['image/png', 'image/jpeg', 'image/webp'], { message: 'Use a PNG, JPEG or WebP image.' })
  mimeType!: 'image/png' | 'image/jpeg' | 'image/webp';

  @IsInt()
  @Min(1)
  @Max(MAX_LOGO_BYTES, { message: 'Logos can be up to 2 MB.' })
  size!: number;
}

export class SetLogoDto {
  /** The `key` from the upload step. */
  @IsString()
  @Matches(/^workspaces\/[0-9a-f-]{36}\/logo-[0-9a-f-]{36}\.(png|jpg|webp)$/)
  key!: string;
}
