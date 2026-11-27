import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** `sessionId`: the login session (refresh token family). Missing in access tokens issued before sessions were added. */
export type AuthUser = { id: string; email: string; sessionId?: string };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);