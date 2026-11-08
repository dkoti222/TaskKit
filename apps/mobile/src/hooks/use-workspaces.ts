import { useQuery } from '@tanstack/react-query';

import {
  getWorkspace,
  listInvitations,
  listMembers,
  listWorkspaces,
  previewInvitation,
} from '@/api/workspaces';

/**
 * Every workspace query starts with ['workspaces'], so invalidating that prefix
 * refreshes the home list and any open workspace screens at once.
 */
export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  detail: (id: string) => [...workspaceKeys.all, id] as const,
  members: (id: string) => [...workspaceKeys.all, id, 'members'] as const,
  invitations: (id: string) => [...workspaceKeys.all, id, 'invitations'] as const,
};

export function useWorkspaces() {
  return useQuery({ queryKey: workspaceKeys.list(), queryFn: listWorkspaces });
}

export function useWorkspace(id: string) {
  return useQuery({ queryKey: workspaceKeys.detail(id), queryFn: () => getWorkspace(id) });
}

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => listMembers(workspaceId),
  });
}

/** Only call with enabled=true for Owner/Admin; others get 403. */
export function useInvitations(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: workspaceKeys.invitations(workspaceId),
    queryFn: () => listInvitations(workspaceId),
    enabled,
  });
}

export const inviteKey = (token: string) => ['invitation', token] as const;

/** GET /invitations/:token — 400 when invalid, used or expired. */
export function useInvitePreview(token: string | null) {
  return useQuery({
    queryKey: inviteKey(token ?? ''),
    queryFn: () => previewInvitation(token!),
    enabled: !!token,
  });
}
