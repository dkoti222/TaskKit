import { ValidationPipe, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { corsOrigins } from './common/env.validation';
import { validationFailed } from './common/errors/api-errors';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';

/**
 * Settings every copy of the app needs: the real server (main.ts) and the e2e tests. Keeping
 * them in one place means the tests run exactly the same prefix and validation as production.
 */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  // Security headers. No content-security policy: this API returns JSON (and Swagger's page
  // needs inline scripts). Files are served cross-origin so the web app can show images.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // Browsers only: phone apps send no Origin. CORS_ORIGINS empty = any origin (development).
  const origins = corsOrigins();
  app.enableCors(origins ? { origin: origins } : undefined);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationFailed,
    }),
  );
  // Every error as { statusCode, code, message, details? }.
  app.useGlobalFilters(new ApiExceptionFilter());
  return app;
}
