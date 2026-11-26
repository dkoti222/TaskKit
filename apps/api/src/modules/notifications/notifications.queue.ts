import type { ConnectionOptions } from 'bullmq';

/** The BullMQ queue every notification job goes through. */
export const NOTIFICATIONS_QUEUE = 'notifications';

/** What listeners put on the queue. The worker turns each job into Notification rows + pushes. */
export type NotificationJob =
  | { name: 'card.assigned'; data: { boardId: string; actorId: string; cardId: string; userId: string } }
  | {
      name: 'comment.mentioned';
      data: { boardId: string; actorId: string; cardId: string; commentId: string; userIds: string[] };
    }
  | { name: 'comment.created'; data: { boardId: string; actorId: string; cardId: string; commentId: string } }
  | {
      name: 'workspace.invited';
      data: { workspaceId: string; actorId: string; email: string; role: string; token: string };
    }
  /** Repeatable: every 15 minutes, look for cards due within 24 hours. */
  | { name: 'due.check'; data: Record<string, never> };

/** `redis://user:pass@host:port/db` (or `rediss://` for TLS) → BullMQ connection options. */
export function redisConnection(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    // Required by BullMQ workers: wait for Redis instead of failing a blocked command.
    maxRetriesPerRequest: null,
  };
}
