import { api } from './client';
import type {
  AcceptedInvite,
  AssignableRole,
  CreatedInvitation,
  InvitePreview,
  Member,
  MessageResponse,
  PendingInvitation,
  Workspace,
} from './types';

// ---------- Workspaces ----------

export async function listWorkspaces() {
  const { data } = await api.get<Workspace[]>('/workspaces');
  return data;
}

/** 404 if the user isn't a member. */
export async function getWorkspace(id: string) {
  const { data } = await api.get<Workspace>(`/workspaces/${id}`);
  return data;
}

/** The creator becomes Owner. */
export async function createWorkspace(body: { name: string; description?: string }) {
  const { data } = await api.post<Workspace>('/workspaces', body);
  return data;
}

/** Owner and Admin. Returns the workspace without `role` / `memberCount`. */
export async function updateWorkspace(id: string, body: { name?: string; description?: string }) {
  const { data } = await api.patch<Omit<Workspace, 'role' | 'memberCount'>>(
    `/workspaces/${id}`,
    body,
  );
  return data;
}

// ---------- Members ----------

export async function listMembers(workspaceId: string) {
  const { data } = await api.get<Member[]>(`/workspaces/${workspaceId}/members`);
  return data;
}

export async function changeMemberRole(workspaceId: string, userId: string, role: AssignableRole) {
  const { data } = await api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role });
  return data;
}

export async function removeMember(workspaceId: string, userId: string) {
  const { data } = await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
  return data;
}

// ---------- Invitations ----------

/** Owner and Admin (only the Owner can invite Admins). 409 if already a member. */
export async function createInvitation(
  workspaceId: string,
  body: { email: string; role: AssignableRole },
) {
  const { data } = await api.post<CreatedInvitation>(
    `/workspaces/${workspaceId}/invitations`,
    body,
  );
  return data;
}

export async function listInvitations(workspaceId: string) {
  const { data } = await api.get<PendingInvitation[]>(`/workspaces/${workspaceId}/invitations`);
  return data;
}

export async function revokeInvitation(workspaceId: string, invitationId: string) {
  const { data } = await api.delete<MessageResponse>(
    `/workspaces/${workspaceId}/invitations/${invitationId}`,
  );
  return data;
}

/** 400 if the invite is invalid, used or expired. */
export async function previewInvitation(token: string) {
  const { data } = await api.get<InvitePreview>(`/invitations/${encodeURIComponent(token)}`);
  return data;
}

/** 403 if the invite was sent to a different email. */
export async function acceptInvitation(token: string) {
  const { data } = await api.post<AcceptedInvite>(
    `/invitations/${encodeURIComponent(token)}/accept`,
  );
  return data;
}

// ---------- Ownership ----------

/** Owner only. The new Owner must be a member; the old Owner becomes Admin. */
export async function transferOwnership(workspaceId: string, userId: string) {
  const { data } = await api.post<MessageResponse>(
    `/workspaces/${workspaceId}/transfer-ownership`,
    { userId },
  );
  return data;
}

/** Anyone but the Owner (400 for the Owner: transfer first). */
export async function leaveWorkspace(workspaceId: string) {
  const { data } = await api.post<MessageResponse>(`/workspaces/${workspaceId}/leave`);
  return data;
}
