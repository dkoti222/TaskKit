import { ValidationPipe, type INestApplication } from '@nestjs/common';

/**
 * Settings every copy of the app needs: the real server (main.ts) and the e2e tests. Keeping
 * them in one place means the tests run exactly the same prefix and validation as production.
 */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  return app;
}
