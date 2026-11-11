import { useEffect } from 'react';

import { joinBoard, leaveBoard } from '@/realtime/socket';

/** Live updates for a board while this screen is open (joins and leaves its socket room). */
export function useBoardRoom(boardId: string | undefined) {
  useEffect(() => {
    if (!boardId) return;
    joinBoard(boardId);
    return () => leaveBoard(boardId);
  }, [boardId]);
}
