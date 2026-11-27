import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
  ValidateIf,
} from 'class-validator';

/**
 * The environment variables the API needs (PDF: "validates them at startup and refuses to start
 * if one is missing"). Used by ConfigModule.forRoot({ validate }). See .env.example.
 */
class Env {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(365)
  REFRESH_TTL_DAYS?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  PORT?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  NOTIFICATIONS_ENABLED?: string;

  /** Needed when notifications are on. */
  @ValidateIf((e: Env) => e.NOTIFICATIONS_ENABLED !== 'false' && e.REDIS_URL !== undefined)
  @IsString()
  @IsNotEmpty()
  REDIS_URL?: string;

  @IsOptional()
  @IsIn(['local', 's3'])
  STORAGE_DRIVER?: string;

  @ValidateIf((e: Env) => e.STORAGE_DRIVER === 's3')
  @IsString()
  @IsNotEmpty()
  S3_BUCKET?: string;

  @ValidateIf((e: Env) => e.STORAGE_DRIVER === 's3')
  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY_ID?: string;

  @ValidateIf((e: Env) => e.STORAGE_DRIVER === 's3')
  @IsString()
  @IsNotEmpty()
  S3_SECRET_ACCESS_KEY?: string;

  /** Comma-separated web origins allowed by CORS. Empty: any (fine for local development). */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(Env, config);
  const errors = validateSync(env, { skipMissingProperties: false, whitelist: false });
  if (errors.length) {
    const lines = errors.map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment (see .env.example):\n${lines.join('\n')}`);
  }
  return config; // keep the original strings; ConfigService reads them as before
}

/** CORS_ORIGINS as a list, or null for "any origin". */
export function corsOrigins(): string[] | null {
  const list = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return list.length ? list : null;
}
