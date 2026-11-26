import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import type {
  BoardEventContext,
  InvitationEvent,
  MentionEvent,
} from '../../common/events/domain-events';
import { NOTIFICATIONS_QUEUE, type NotificationJob } from './notifications.queue';

const EVERY_15_MINUTES = 15 * 60 * 1000;

type AssigneeAdded = BoardEventContext & { data: { cardId: string; userId: string } };
type CommentCreated = BoardEventContext & { data: { cardId: string; commentId: string } };

/**
 * Domain events → jobs on the `notifications` queue. It never sends anything itself: adding a
 * job takes about a millisecond, so a slow push service can never slow down the request that
 * changed something. The worker (NotificationsProcessor) does the rest.
 */
@Injectable()
export class NotificationsListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  /**
   * Registers the repeatable due-date check (once; restarts don't add copies).
   * Not awaited: if Redis is down, the API must still start. The call finishes once Redis is up.
   */
  onModuleInit() {
    this.queue
      .upsertJobScheduler('due-check', { every: EVERY_15_MINUTES }, { name: 'due.check', data: {} })
      .catch((error) =>
        this.logger.error(`Couldn't schedule due reminders (is Redis running?): ${String(error)}`),
      );
  }

  @OnEvent('card.assignee.added')
  onAssigned(e: AssigneeAdded) {
    if (e.data.userId === e.actorId) return; // you assigned yourself
    this.add({
      name: 'card.assigned',
      data: { boardId: e.boardId, actorId: e.actorId, cardId: e.data.cardId, userId: e.data.userId },
    });
  }

  @OnEvent('comment.mentioned')
  onMentioned(e: MentionEvent) {
    this.add({
      name: 'comment.mentioned',
      data: { boardId: e.boardId, actorId: e.actorId, ...e.data },
    });
  }

  @OnEvent('comment.created')
  onComment(e: CommentCreated) {
    this.add({
      name: 'comment.created',
      data: { boardId: e.boardId, actorId: e.actorId, cardId: e.data.cardId, commentId: e.data.commentId },
    });
  }

  @OnEvent('invitation.created')
  onInvited(e: InvitationEvent) {
    this.add({ name: 'workspace.invited', data: { workspaceId: e.workspaceId, actorId: e.actorId, ...e.data } });
  }

  private add(job: NotificationJob) {
    // Not awaited by the request. If Redis is down, the job waits in ioredis' offline queue.
    this.queue
      .add(job.name, job.data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000, removeOnFail: 1000 })
      .catch((error) => this.logger.error(`Couldn't queue ${job.name}: ${String(error)}`));
  }
}
