import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type ValidationError,
} from '@nestjs/common';

/**
 * Error codes (PDF "API conventions"): every error response is
 * `{ statusCode, code, message, details? }`. `code` is stable for the app to check; `message`
 * is a sentence to show people; `details` lists field problems for VALIDATION_FAILED.
 */
export const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

/** 403 because of the person's role (board or workspace). */
export const forbiddenRole = (message: string) =>
  new ForbiddenException({ code: 'FORBIDDEN_ROLE', message });

/** 409 because someone changed the card first. */
export const versionConflict = (message: string) =>
  new ConflictException({ code: 'VERSION_CONFLICT', message });

/** 400 when one of the PDF's limits (members, boards, cards…) would be passed. */
export const limitReached = (message: string) =>
  new BadRequestException({ code: 'LIMIT_REACHED', message });

/** ValidationPipe's errors → VALIDATION_FAILED with one entry per broken field. */
export function validationFailed(errors: ValidationError[]) {
  const details: { field: string; message: string }[] = [];
  const walk = (list: ValidationError[], prefix = '') => {
    for (const e of list) {
      const field = prefix ? `${prefix}.${e.property}` : e.property;
      for (const message of Object.values(e.constraints ?? {})) details.push({ field, message });
      if (e.children?.length) walk(e.children, field);
    }
  };
  walk(errors);
  return new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: details[0]?.message ?? 'Some fields are not valid',
    details,
  });
}
