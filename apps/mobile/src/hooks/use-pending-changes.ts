import { useMutationState } from '@tanstack/react-query';

/**
 * Changes made while offline that are waiting to be sent (paused mutations, screen 30), and the
 * cards they belong to (see cardChangeKey). They go out by themselves when the phone is online.
 */
export function usePendingChanges() {
  const waiting = useMutationState({
    filters: { status: 'pending', predicate: (m) => m.state.isPaused },
    select: (m) => m.options.mutationKey,
  });
  const cardIds = new Set(
    waiting.filter((key) => key?.[0] === 'card-change').map((key) => String(key![1])),
  );
  return { count: waiting.length, cardIds };
}
