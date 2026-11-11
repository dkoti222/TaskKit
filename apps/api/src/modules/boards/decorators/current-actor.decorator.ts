import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { BoardEventContext } from '../../../common/events/domain-events';

/**
 * `{ boardId, actorId }` for the current request: the board found by BoardRoleGuard and the
 * logged-in user. Services pass it on to their domain events. Only use it on routes that have
 * BoardRoleGuard.
 */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BoardEventContext => {
    const req = ctx.switchToHttp().getRequest();
    return { boardId: req.boardAccess.board.id, actorId: req.user.id };
  },
);
