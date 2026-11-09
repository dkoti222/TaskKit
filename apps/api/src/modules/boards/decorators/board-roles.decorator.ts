import { SetMetadata } from '@nestjs/common';
import type { BoardRole } from '../board-access.service';

export const BOARD_ROLES_KEY = 'boardRoles';
export const BoardRoles = (...roles: BoardRole[]) => SetMetadata(BOARD_ROLES_KEY, roles);