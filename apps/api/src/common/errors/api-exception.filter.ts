import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { DEFAULT_CODES } from './api-errors';

type Body = { statusCode: number; code: string; message: string; details?: unknown };

/**
 * Turns every HTTP error into `{ statusCode, code, message, details? }` (PDF "API conventions").
 * Unexpected errors become a plain 500: the real error is logged, never sent to the app.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Error');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception; // sockets handle their own errors
    const res = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      const body: Body = { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' };
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
    }

    const status = exception.getStatus();
    const raw = exception.getResponse();
    const fromObject = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    let message = typeof raw === 'string' ? raw : fromObject.message;
    if (Array.isArray(message)) message = message[0];
    if (status === 429) message = 'Too many requests. Wait a minute and try again.';

    const body: Body = {
      statusCode: status,
      code: typeof fromObject.code === 'string' ? fromObject.code : (DEFAULT_CODES[status] ?? 'ERROR'),
      message: typeof message === 'string' && message ? message : exception.message,
    };
    if (fromObject.details !== undefined) body.details = fromObject.details;
    res.status(status).json(body);
  }
}
