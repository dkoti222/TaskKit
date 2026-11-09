import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { BoardAccess } from '../board-access.service';

export const CurrentBoard = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BoardAccess =>
    ctx.switchToHttp().getRequest().boardAccess,
);