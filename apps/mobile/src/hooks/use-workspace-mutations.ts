import { useMutation, useQueryClient } from '@tanstack/react-query';

import { putFile } from '@/api/attachments';

import type { AssignableRole, Member, Workspace } from '@/api/types';
import {
  changeMemberRole,
  deleteWorkspace,
  leaveWorkspace,
  type LogoType,
  removeMember,
  removeWorkspaceLogo,
  requestLogoUpload,
  revokeInvitation,
  setWorkspaceLogo,
  transferOwnership,
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
    mutationFn: (body: Parameters<typeof updateWorkspace>[1]) => updateWorkspace(workspaceId, body),
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

/**
 * POST /workspaces/:id/transfer-ownership. Our role changes (Owner -> Admin), and so do our
 * effective roles on every board, so refresh all workspace and board queries.
 */
export function useTransferOwnership(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => transferOwnership(workspaceId, userId),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['boards'] }),
      ]),
  });
}

/**
 * POST /workspaces/:id/leave. The caller navigates home on success. Only the home list is
 * refreshed: removing this workspace's queries while its screens are still mounted would make
 * them refetch and flash "no access". The cache drops them on its own once they're unused.
 */
export function useLeaveWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveWorkspace(workspaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.list(), exact: true }),
  });
}

/**
 * DELETE /workspaces/:id (Owner). Like leaving: the caller goes home on success, and only the
 * home list is refreshed so the screens still open don't flash "no access".
 */
export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.list(), exact: true }),
  });
}

/**
 * Screen 24 "Change logo": PUT the picked image to the link from the API, then use it.
 * `null` removes the logo.
 */
export function useWorkspaceLogo(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshWorkspace(workspaceId);
  return useMutation({
    mutationFn: async (file: { uri: string; mimeType: LogoType } | null) => {
      if (!file) return removeWorkspaceLogo(workspaceId);
      const blob = await (await fetch(file.uri)).blob();
      const { key, upload } = await requestLogoUpload(workspaceId, file.mimeType, blob.size);
      await putFile(upload, blob, () => {});
      return setWorkspaceLogo(workspaceId, key);
    },
    onSuccess: (updated) =>
      queryClient.setQueryData<Workspace>(workspaceKeys.detail(workspaceId), (old) =>
        old ? { ...old, logoUrl: updated.logoUrl } : old,
      ),
    onSettled: refresh,
  });
}
