import { SetMetadata } from '@nestjs/common';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export const WORKSPACE_ROLES_KEY = 'workspaceRoles';
export const WorkspaceRoles = (...roles: Role[]) => SetMetadata(WORKSPACE_ROLES_KEY, roles);