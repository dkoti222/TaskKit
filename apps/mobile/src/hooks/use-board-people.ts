import { useMemo } from 'react';

import type { Board, CardPerson, Role } from '@/api/types';
import { useBoardMembers } from './use-boards';
import { useMembers } from './use-workspaces';

export type BoardPerson = CardPerson & { role: Role };

/**
 * Everyone with access to the board, with their effective role (same rules as the API's
 * BoardAccessService):
 *   workspace Owner → OWNER; added to the board → board role;
 *   otherwise on a WORKSPACE board → workspace role; otherwise no access.
 *
 * GET /boards/:id/members only lists people *added* to the board, so on its own it misses
 * the workspace Owner and everyone who sees a WORKSPACE board through their workspace role.
 * We combine it with the workspace member list to get the full picture.
 */
export function useBoardPeople(board: Board | undefined) {
  const boardMembers = useBoardMembers(board?.id ?? '', !!board);
  const wsMembers = useMembers(board?.workspaceId ?? '');

  const people = useMemo<BoardPerson[] | undefined>(() => {
    if (!board || !boardMembers.data || !wsMembers.data) return undefined;
    const onBoard = new Map(boardMembers.data.map((m) => [m.userId, m.role]));
    const result: BoardPerson[] = [];
    for (const m of wsMembers.data) {
      const role: Role | undefined =
        m.role === 'OWNER'
          ? 'OWNER'
          : (onBoard.get(m.userId) ?? (board.visibility === 'WORKSPACE' ? m.role : undefined));
      if (role)
        result.push({ id: m.userId, name: m.name, email: m.email, avatarUrl: m.avatarUrl, role });
    }
    return result;
  }, [board, boardMembers.data, wsMembers.data]);

  return {
    people,
    /** Viewers can't be assigned (the API returns 400). */
    assignable: people?.filter((p) => p.role !== 'VIEWER'),
    isPending: boardMembers.isPending || wsMembers.isPending,
    error: boardMembers.error ?? wsMembers.error,
    refetch: () => Promise.all([boardMembers.refetch(), wsMembers.refetch()]),
  };
}
