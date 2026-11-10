import type { AssignableRole, Role } from '@/api/types';

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export const ROLE_DESCRIPTION: Record<AssignableRole, string> = {
  ADMIN: 'Manage members, roles and all boards.',
  MEMBER: 'Create boards, lists and cards. Comment and move cards.',
  VIEWER: 'Read-only access to workspace boards.',
};

// These mirror docs/permissions.md so we can hide controls the API would refuse with 403.

/** Rename, invite, change roles, remove members. */
export const canManageWorkspace = (role: Role | undefined) => role === 'OWNER' || role === 'ADMIN';

/** Roles this user may hand out (only the Owner can make Admins). */
export function assignableRoles(role: Role | undefined): AssignableRole[] {
  if (role === 'OWNER') return ['ADMIN', 'MEMBER', 'VIEWER'];
  if (role === 'ADMIN') return ['MEMBER', 'VIEWER'];
  return [];
}

/** Whether `actor` may change or remove `target` via the members API. */
export function canManageMember(
  actor: { userId: string; role: Role | undefined },
  target: { userId: string; role: Role },
) {
  if (!canManageWorkspace(actor.role)) return false;
  if (actor.userId === target.userId) return false; // nobody changes themselves here
  if (target.role === 'OWNER') return false; // nobody changes the Owner here
  if (target.role === 'ADMIN') return actor.role === 'OWNER';
  return true;
}

// ---------- Boards ----------

/** Workspace roles that may create boards. */
export const canCreateBoard = (workspaceRole: Role | undefined) =>
  workspaceRole === 'OWNER' || workspaceRole === 'ADMIN' || workspaceRole === 'MEMBER';

/** Effective board roles that may edit, archive, restore and manage board members. */
export const canManageBoard = (boardRole: Role | undefined) =>
  boardRole === 'OWNER' || boardRole === 'ADMIN';

/** What each role can do on one board (role sheet and Add people). */
export const BOARD_ROLE_DESCRIPTION: Record<AssignableRole, string> = {
  ADMIN: 'Edit board settings, manage board members, archive.',
  MEMBER: 'Create, edit and move cards. Comment.',
  VIEWER: 'Read-only access to this board.',
};

// ---------- Lists and cards ----------

/** Create, rename, archive and move lists and cards; assign, label and tick checklists. */
export const canEditCards = (boardRole: Role | undefined) =>
  boardRole === 'OWNER' || boardRole === 'ADMIN' || boardRole === 'MEMBER';

/** Create and delete board labels. */
export const canManageLabels = (boardRole: Role | undefined) =>
  boardRole === 'OWNER' || boardRole === 'ADMIN';
