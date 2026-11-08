import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { WorkspaceMember } from '../../../generated/prisma/client';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceMember =>
    ctx.switchToHttp().getRequest().membership,
);