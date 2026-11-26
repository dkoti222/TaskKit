/**
 * Domain events: "something changed" messages that services send after a successful write.
 *
 * A service doesn't know (or care) who listens. Today the realtime module turns them into
 * socket messages; later steps add listeners for activity (Step 10) and notifications (Step 11)
 * without touching the services again.
 */

/** Who did it, and on which board. Every board event carries these. */
export type BoardEventContext = { boardId: string; actorId: string };

/** Events that happen on one board. `data` holds the ids involved and what changed. */
export type BoardEvent = BoardEventContext &
  (
    | { type: 'card.created'; data: { cardId: string; listId: string } }
    | {
        type: 'card.updated';
        data: { cardId: string; version: number; fields: ('title' | 'description' | 'dueAt')[] };
      }
    | { type: 'card.archived'; data: { cardId: string; archived: boolean } }
    | {
        type: 'card.moved';
        data: {
          cardId: string;
          fromListId: string;
          listId: string;
          position: number;
          version: number;
        };
      }
    | { type: 'list.created'; data: { listId: string; name: string } }
    | { type: 'list.updated'; data: { listId: string; name: string } }
    | { type: 'list.archived'; data: { listId: string; archived: boolean } }
    | { type: 'list.moved'; data: { listId: string; position: number } }
    | { type: 'card.assignee.added' | 'card.assignee.removed'; data: { cardId: string; userId: string } }
    | { type: 'card.label.added' | 'card.label.removed'; data: { cardId: string; labelId: string } }
    | {
        type: 'checklist.changed';
        data: {
          cardId: string;
          itemId: string;
          action: 'added' | 'checked' | 'unchecked' | 'renamed' | 'deleted';
          text: string;
        };
      }
    | {
        type: 'comment.created' | 'comment.updated' | 'comment.deleted';
        data: { cardId: string; commentId: string };
      }
    | { type: 'label.created' | 'label.deleted'; data: { labelId: string; name: string } }
    | {
        type: 'card.attachment.added' | 'card.attachment.removed';
        data: { cardId: string; attachmentId: string; fileName: string };
      }
    | { type: 'board.updated'; data: { changes: Record<string, unknown> } }
    | { type: 'board.member.changed'; data: { userId: string; role: string | null } }
  );

/** Events about a whole workspace. They can change who has access to its boards. */
export type WorkspaceEvent =
  | {
      type: 'workspace.member.changed';
      workspaceId: string;
      actorId: string;
      data: { userId: string; role: string | null };
    }
  | {
      type: 'workspace.deleted';
      workspaceId: string;
      actorId: string;
      // The boards are already gone when listeners run, so their ids travel with the event.
      data: { boardIds: string[] };
    };

/** Someone was @mentioned in a comment. Not sent to the board room; Step 11 turns it into a notification. */
export type MentionEvent = BoardEventContext & {
  type: 'comment.mentioned';
  data: { cardId: string; commentId: string; userIds: string[] };
};

/** Someone was invited to a workspace by email (Step 11 notifies them if they have an account). */
export type InvitationEvent = {
  type: 'invitation.created';
  workspaceId: string;
  actorId: string;
  data: { email: string; role: string; token: string };
};

/** A notification row was written; the realtime listener sends it to the user's room. */
export type NotificationCreatedEvent = {
  type: 'notification.created';
  userId: string;
  notification: { id: string; type: string; data: unknown; readAt: Date | null; createdAt: Date };
};

export type DomainEvent =
  | BoardEvent
  | WorkspaceEvent
  | MentionEvent
  | InvitationEvent
  | NotificationCreatedEvent;

export type BoardEventType = BoardEvent['type'];

/** Every board event name, so one listener can subscribe to all of them. */
export const BOARD_EVENT_TYPES: BoardEventType[] = [
  'card.created',
  'card.updated',
  'card.archived',
  'card.moved',
  'list.created',
  'list.updated',
  'list.archived',
  'list.moved',
  'card.assignee.added',
  'card.assignee.removed',
  'card.label.added',
  'card.label.removed',
  'checklist.changed',
  'label.created',
  'label.deleted',
  'card.attachment.added',
  'card.attachment.removed',
  'comment.created',
  'comment.updated',
  'comment.deleted',
  'board.updated',
  'board.member.changed',
];

/** Board events after which someone may have lost (or gained) access to the board. */
export const ACCESS_EVENT_TYPES: BoardEventType[] = ['board.updated', 'board.member.changed'];
