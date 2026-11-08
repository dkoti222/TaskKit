import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { AssignableRole, Member, Workspace } from '@/api/types';
import {
  changeMemberRole,
  removeMember,
  revokeInvitation,
  updateWorkspace,
} from '@/api/workspaces';
import { workspaceKeys } from './use-workspaces';

/**
 * Refreshes everything under ['workspaces', id] (detail, members, invitations) and the
 * home list. Runs after every change, success or failure: a 403 usually means our role
 * changed elsewhere, so re-reading the workspace hides controls we can no longer use.
 */
function useRefreshWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() }),
    ]);
}

/** PATCH /workspaces/:id (Owner, Admin). */
export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshWorkspace(workspaceId);
  return useMutation({
    mutationFn: (body: { name?: string; description?: string }) =>
      updateWorkspace(workspaceId, body),
    onSuccess: (updated) => {
      // The response has no role/memberCount, so merge it into what we already have.
      queryClient.setQueryData<Workspace>(workspaceKeys.detail(workspaceId), (old) =>
        old ? { ...old, ...updated } : old,
      );
    },
    onSettled: refresh,
  });
}

/** PATCH /workspaces/:id/members/:userId — shown instantly, rolled back if refused. */
export function useChangeMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshWorkspace(workspaceId);
  const key = workspaceKeys.members(workspaceId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignableRole }) =>
      changeMemberRole(workspaceId, userId, role),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Member[]>(key);
      queryClient.setQueryData<Member[]>(key, (old) =>
        old?.map((m) => (m.userId === userId ? { ...m, role } : m)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: refresh,
  });
}

/** DELETE /workspaces/:id/members/:userId */
export function useRemoveMember(workspaceId: string) {
  const refresh = useRefreshWorkspace(workspaceId);
  return useMutation({
    mutationFn: (userId: string) => removeMember(workspaceId, userId),
    onSettled: refresh,
  });
}

/** DELETE /workspaces/:id/invitations/:invitationId */
export function useRevokeInvitation(workspaceId: string) {
  const refresh = useRefreshWorkspace(workspaceId);
  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(workspaceId, invitationId),
    onSettled: refresh,
  });
}
