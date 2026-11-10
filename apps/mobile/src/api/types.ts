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

// ---------- Boards ----------

export type BoardVisibility = 'WORKSPACE' | 'PRIVATE';

/** A board row as PATCH / archive / restore return it (no `role`). */
export type BoardFields = {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  visibility: BoardVisibility;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A board as seen by the current user: `role` is their effective board role. */
export type Board = BoardFields & { role: Role };

export type BoardMember = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  addedAt: string;
};

// ---------- Lists and cards ----------

/** A person as cards show them (assignees). */
export type CardPerson = { id: string; name: string; avatarUrl: string | null; email?: string };

export type Label = {
  id: string;
  boardId: string;
  name: string;
  color: string;
  createdAt?: string;
};

/** A card as GET /boards/:id/content returns it (enough for the card face). */
export type CardSummary = {
  id: string;
  title: string;
  dueAt: string | null;
  position: number;
  /** Bumped on every change. Moves send it back; a mismatch is 409. */
  version: number;
  assignees: CardPerson[];
  labels: Label[];
  checklist: { total: number; done: number };
};

export type BoardList = { id: string; name: string; position: number; cards: CardSummary[] };

/** GET /boards/:id/content — `board.role` is the current user's effective role. */
export type BoardContent = { board: Board; lists: BoardList[] };

/** A list row as POST/PATCH /lists return it. */
export type ListFields = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  archivedAt: string | null;
};

/** A card row as POST/PATCH /cards and archive return it. */
export type CardFields = {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  position: number;
  version: number;
  archivedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistItem = {
  id: string;
  cardId: string;
  text: string;
  done: boolean;
  position: number;
};

/** GET /cards/:id */
export type CardDetail = CardFields & {
  list: { id: string; name: string; boardId: string };
  createdBy: CardPerson;
  assignees: CardPerson[];
  labels: Label[];
  checklistItems: ChecklistItem[];
};

/** PATCH /cards/:id/move */
export type MovedCard = { id: string; listId: string; position: number; version: number };
/** PATCH /lists/:id/move */
export type MovedList = { id: string; position: number };
