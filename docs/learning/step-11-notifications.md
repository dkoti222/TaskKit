# Step 11: Notifications (queues and push)

## What was built
People hear about things that need them, in the app (screen 19, live) and as push notifications:
- assigned to a card
- @mentioned in a comment
- a new comment on a card they're assigned to
- invited to a workspace (if they already have an account)
- a card they're assigned to is due within 24 hours

Plus endpoints to list them, mark them read, register phones for push, and change notification
settings (screen 22).

Migration `notifications`: tables `notifications` and `push_tokens`, three settings columns on
`users` (`notify_push`, `notify_mention_email`, `notify_due_reminders`), and
`cards.due_reminder_for`. New packages: `@nestjs/bullmq`, `bullmq` (v5, it bundles the
`ioredis` client), `expo-server-sdk`. Redis runs locally through Homebrew (`REDIS_URL`).

## New concepts

**A job queue.** Sending a push means calling Expo's servers, which can take a second or fail.
If the request that assigned a card had to wait for that, assigning would feel slow and could
fail for a reason that has nothing to do with the card. So nothing is sent during the request.
The listener only adds a small *job* to a queue (`queue.add('card.assigned', {...})`, about a
millisecond) and the request finishes. A *worker* (`NotificationsProcessor`) takes jobs off the
queue in the background and does the slow part. BullMQ keeps the queue in Redis, so jobs survive
an API restart, and a job that throws is retried: 3 attempts, waiting 2 s, then 4 s
(exponential backoff).

**Redis.** An in-memory database that is very fast at small reads and writes. BullMQ uses it to
store waiting, active, finished and failed jobs, and to make sure two workers never take the
same job. We don't put any of our own data in it.

**Repeatable jobs.** "Every 15 minutes, look for cards due in the next 24 hours" is a job
scheduler (`queue.upsertJobScheduler('due-check', { every: 15 min })`). *Upsert* means
restarting the API doesn't add a second copy. To avoid reminding twice, `cards.due_reminder_for`
remembers which due date was reminded. The worker *claims* a card with
`updateMany where dueReminderFor = <old value>`, so two workers can't both send it. Changing
the due date makes a new reminder possible.

**Push notifications through Expo.** The phone asks the user for permission, then gets an *Expo
push token* (`ExponentPushToken[…]`) and sends it to `POST /me/push-tokens`. To notify someone,
we send `{ to: token, title, body, data }` to Expo, which passes it on to Apple or Google.
`expo-server-sdk` splits messages into chunks of 100. If Expo answers `DeviceNotRegistered` (app
uninstalled), we delete that token. On logout the app deletes its token first.

**Rows first, extras after.** The worker always saves the `Notification` row (what screen 19
shows), then sends it over the socket to the `user:<id>` room (screen 19 updates live), then
sends push and email if the person's settings allow. If push fails, the notification still
exists in the app.

## Files touched and why
| File | Why |
|---|---|
| `prisma/schema.prisma`, migration `…_notifications` | `Notification`, `PushToken`, settings on `User`, `Card.dueReminderFor` |
| `src/modules/notifications/notifications.queue.ts` | Queue name, job types, and `REDIS_URL` → connection options |
| `…/notifications.listener.ts` | Domain events → queue jobs; registers the 15-minute due check |
| `…/notifications.processor.ts` | The worker: who gets what (access checks, no self-notify, no double notify), due reminders |
| `…/notifications.service.ts` | `deliver()` (row → socket → push → email) and the endpoints' logic |
| `…/push.service.ts` | Expo push in chunks, removes dead tokens |
| `…/notifications.controller.ts`, `dto/notifications.dto.ts` | `/notifications…` and `/me/push-tokens`, `/me/notification-settings` |
| `src/common/events/domain-events.ts` | `invitation.created`, `notification.created` |
| `src/modules/workspaces/invitations.service.ts` | Emits `invitation.created` |
| `src/modules/mail/mail.service.ts` | `sendMention` (logged in dev, like the other emails) |
| `src/modules/realtime/*` | Each socket joins `user:<id>`; `notification:new` to that room |
| `.env.example` | `REDIS_URL`, optional `EXPO_ACCESS_TOKEN` |

## How a mention becomes a notification
1. Sana comments `@[ravi-id] can you check?`. `CommentsService.create` emits `comment.created`
   and `comment.mentioned { userIds: [ravi] }`, and the request ends.
2. `NotificationsListener` hears `comment.mentioned` and adds a `comment.mentioned` job to the
   queue in Redis. It hears `comment.created` too and adds that job.
3. In the background, `NotificationsProcessor.process` takes the `comment.mentioned` job. It
   looks up the card, board, Sana's name and a short preview with the mention written as
   "@Ravi Kumar", then calls `deliver([ravi], 'comment.mentioned', data)`.
4. `deliver` drops Sana (she did it), saves a `Notification` row for Ravi, and emits
   `notification.created`. The realtime listener sends `notification:new` to `user:ravi`, and
   his Alerts badge goes up. Then it pushes to his phones (if `push` is on), and emails him
   (if `mentionEmail` is on).
5. The `comment.created` job notifies the card's assignees, but skips Ravi, because the
   comment mentions him and he already has a notification for it.
