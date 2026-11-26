import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { getErrorStatus } from '@/api/errors';
import { AccessRemoved } from '@/components/access-removed';
import { boardKeys } from '@/hooks/use-boards';
import { useMe } from '@/hooks/use-me';
import { useMembers, useWorkspace } from '@/hooks/use-workspaces';

/**
 * True when a board request came back 404 (no access, or the board is gone).
 * Also refreshes the workspace's board grid so the board disappears from it.
 */
export function useBoardAccessLost(error: unknown, workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const lost = getErrorStatus(error) === 404;
  useEffect(() => {
    if (lost && workspaceId) {
      void queryClient.invalidateQueries({ queryKey: boardKeys.lists(workspaceId) });
    }
  }, [lost, workspaceId, queryClient]);
  return lost;
}

/** 31 · Access removed, for a board. Offers the way back to the board's workspace if we know it. */
export function BoardAccessRemoved({
  boardName,
  workspaceId,
}: {
  boardName?: string;
  workspaceId?: string;
}) {
  const workspace = useWorkspace(workspaceId ?? '');
  const wsName = workspace.data?.name;
  // Someone to ask: a workspace Admin, else the Owner (not yourself). Only if you're still in
  // the workspace; otherwise the member list is 404 and there's no card.
  const members = useMembers(workspaceId ?? '');
  const me = useMe();
  const others = (members.data ?? []).filter((m) => m.userId !== me.data?.id);
  const admin = others.find((m) => m.role === 'ADMIN') ?? others.find((m) => m.role === 'OWNER');
  const allWorkspaces = { title: 'Go to all workspaces', onPress: () => router.dismissTo('/') };

  return (
    <AccessRemoved
      title={`You no longer have access to ${boardName ?? 'this board'}`}
      message={
        wsName
          ? `An Admin removed you from this board, made it private, or it was deleted. Your other boards in ${wsName} aren’t affected.`
          : 'An Admin removed you from this board, made it private, or it was deleted.'
      }
      primary={
        workspaceId && wsName
          ? {
              title: `Back to ${wsName}`,
              onPress: () =>
                router.dismissTo({ pathname: '/workspace/[id]', params: { id: workspaceId } }),
            }
          : allWorkspaces
      }
      secondary={workspaceId && wsName ? allWorkspaces : undefined}
      contact={admin ? { id: admin.userId, name: admin.name, role: admin.role } : undefined}
    />
  );
}
