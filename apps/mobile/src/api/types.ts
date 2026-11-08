export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string | null;
  emailVerifiedAt: string | null;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = TokenPair & { user: User };

export type MessageResponse = { message: string };

/** Shape of every API error body. `message` may be a list of validation messages. */
export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

// ---------- Workspaces ----------

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
/** Roles that can be given through invites and the members API (never OWNER). */
export type AssignableRole = Exclude<Role, 'OWNER'>;

/** A workspace as seen by the current user: includes their role and the member count. */
export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  role: Role;
  memberCount: number;
  createdAt: string;
};

export type Member = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string };
};

export type CreatedInvitation = Pick<PendingInvitation, 'id' | 'email' | 'role' | 'expiresAt'>;

/** GET /invitations/:token */
export type InvitePreview = {
  workspace: { id: string; name: string };
  role: AssignableRole;
  invitedBy: string;
  email: string;
  expiresAt: string;
  isForYou: boolean;
};

/** POST /invitations/:token/accept */
export type AcceptedInvite = { workspaceId: string; name: string; role: AssignableRole };
