# Step 12: Attachments

## What was built
Images and files on cards: upload with progress (photos or any allowed file, up to 10 MB), image
thumbnails, tap to open, delete, and a paperclip count on board cards. Files live on this
computer's disk (`STORAGE_DRIVER=local`, in `apps/api/uploads/`, git-ignored). An S3 driver
(Cloudflare R2 or AWS S3) is ready for later: set `STORAGE_DRIVER=s3` and the `S3_*` keys.

Migration `attachments` (table `attachments`). New packages: `@aws-sdk/client-s3`,
`@aws-sdk/s3-request-presigner` (only used by the S3 driver).

## New concepts

**Not sending files through JSON.** A 10 MB photo inside a JSON request would need base64 (a
third bigger), and the whole thing would sit in the API's memory. Instead there are three
steps. The API checks role, type and size and hands out a link (`upload-url`). The phone sends
the raw bytes to that link with a plain `PUT`. Then the phone says it's done (`complete`), and
the API checks the file arrived with the promised size before showing it. Until then the row is
*pending* (`completedAt` is null) and invisible.

**Pre-signed URLs.** With S3, the API never touches the bytes. It signs a URL with its secret
key that says "PUT this key, this type, for 10 minutes", and the phone uploads straight to the
bucket. Downloads work the same way. The `local` driver copies the idea: the link contains a
small JSON payload (`{ op, key, size, exp }`) plus an HMAC-SHA256 signature
(`signed-link.ts`). `FilesController` has no login check (`@Public()`). The valid, unexpired
signature *is* the permission, and changing any byte of the link breaks it. Download links last
10 minutes, so a forwarded link soon stops working.

**One interface, two drivers.** `AttachmentsService` only talks to `StorageDriver`
(`uploadTarget`, `downloadUrl`, `size`, `remove`). `StorageModule` picks the implementation
once at startup from `STORAGE_DRIVER`, and Nest injects it with `@Inject(STORAGE_DRIVER)`.
Switching to R2 later is a config change, not a code change.

**Trust nothing from the client.** The type must be on an allowlist (DTO `@IsIn`) and the size
at most 10 MB (`@Max`). The stored name is never the user's file name (`cards/<cardId>/<uuid>.ext`),
so `../../etc/passwd` can't escape the folder, and `LocalStorageDriver.pathFor` refuses any key
that would anyway. The upload streams to a `.part` file while counting bytes, and stops at the
announced size (413). If the byte count is wrong at the end, the file is thrown away.
`complete` checks the stored size again.

## Files touched and why
| File | Why |
|---|---|
| `prisma/schema.prisma`, migration `…_attachments` | `Attachment` (pending until `completedAt`, soft delete) |
| `src/modules/storage/storage.driver.ts` | The `StorageDriver` interface and its injection token |
| `…/local.driver.ts`, `…/signed-link.ts`, `…/files.controller.ts` | Local disk, signed links, PUT/GET of the bytes |
| `…/s3.driver.ts` | S3/R2 with pre-signed URLs |
| `…/storage.module.ts` | Picks the driver from `STORAGE_DRIVER` |
| `src/modules/attachments/*` | DTO (allowlist, 10 MB), service (3 steps, list, download, delete), controllers |
| `src/modules/boards/guards/board-role.guard.ts` | Finds the board from `:attachmentId` |
| `src/common/events/domain-events.ts` | `card.attachment.added` / `removed` (realtime and activity pick them up) |
| `src/modules/activity/activity.listener.ts` | "attached invite-flow.png to Invite flow" |
| `src/modules/cards/lists.service.ts` | `attachmentCount` on board content |
| `.env.example`, `.gitignore` | Storage keys; `uploads/` |

## How an upload flows
1. Sana picks a photo. The app reads it and asks `POST /cards/:id/attachments/upload-url`
   `{ fileName: "invite-flow.png", mimeType: "image/png", size: 245760 }`.
2. `BoardRoleGuard` checks she's Owner, Admin or Member, and the DTO checks type and size.
   The service saves a pending row with key `cards/<card>/<uuid>.png` and asks the driver for an
   upload target. The local driver signs `{ op: "put", key, size, exp }` and returns
   `http://<host>/api/v1/files/<signed>`.
3. The app `PUT`s the bytes there, showing progress. `FilesController` checks the signature and
   expiry, streams to `<key>.part` (stopping past 245760 bytes), then renames it.
4. The app calls `POST /attachments/:id/complete`. The service checks the stored size, sets
   `completedAt`, bumps the card's version, and emits `card.attachment.added`.
5. Listeners: the realtime one tells everyone on the board (their card refetches its files), and
   the activity one writes "Sana attached invite-flow.png to Invite flow".
