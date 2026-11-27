# Workspace permissions

| Action                               | Owner | Admin | Member | Viewer |
|--------------------------------------|:-----:|:-----:|:------:|:------:|
| View workspace and its boards        |  ✅   |  ✅   |   ✅   |   ✅   |
| Rename workspace, change settings    |  ✅   |  ✅   |   ❌   |   ❌   |
| Delete workspace                     |  ✅   |  ❌   |   ❌   |   ❌   |
| Transfer ownership                   |  ✅   |  ❌   |   ❌   |   ❌   |
| Invite, remove members, change roles |  ✅   |  ✅   |   ❌   |   ❌   |
| Create boards                        |  ✅   |  ✅   |   ✅   |   ❌   |
| Leave workspace                      |  ✅*  |  ✅   |   ✅   |   ✅   |

\* The last Owner can't leave. Transfer ownership first.

## Rules
- Whoever creates a workspace becomes its Owner.
- A workspace always has exactly one Owner.
- Admins can't remove or demote the Owner.
- A user who isn't a member gets 404 (not 403), so they can't tell the workspace exists.
- The only Owner of a workspace can't delete their account.



- Any member can see the member list.
- Only the Owner can make someone an Admin, or change or remove an Admin.
- Admins can change or remove Members and Viewers.
- Nobody can change or remove the Owner here (use transfer ownership).
- You can't change or remove yourself here (use leave workspace).


- Invites expire after 7 days and work once.
- Only the Owner can invite someone as Admin.
- You can't invite someone who is already a member.
- A new invite to the same email cancels the older one.
- Only the person the invite was sent to (same email) can accept it.


# Board permissions

## Who can see a board
- You must be a member of the board's workspace.
- WORKSPACE boards: every workspace member can see them.
- PRIVATE boards: only people added to the board, plus the workspace Owner.
- Anyone who can't see a board gets 404.

## Your role on a board (effective role)
1. Workspace Owner → OWNER on every board.
2. Added to the board → your board role.
3. Otherwise, on a WORKSPACE board → your workspace role.
4. Otherwise (PRIVATE board, not added) → no access.

| Action                                | Owner | Admin | Member | Viewer |
|---------------------------------------|:-----:|:-----:|:------:|:------:|
| View board                            |  ✅   |  ✅   |   ✅   |   ✅   |
| Create board (workspace role)         |  ✅   |  ✅   |   ✅   |   ❌   |
| Rename, recolor, change visibility    |  ✅   |  ✅   |   ❌   |   ❌   |
| Archive and restore board             |  ✅   |  ✅   |   ❌   |   ❌   |
| Add/remove board members, set roles   |  ✅   |  ✅   |   ❌   |   ❌   |

- Whoever creates a board is added to it as ADMIN.
- Board roles can be ADMIN, MEMBER or VIEWER (OWNER is workspace-only).

 Only workspace members can be added to a board.
- The workspace Owner can't be given a board role (always OWNER).
- You can't change or remove your own board role.
- Removing someone from a PRIVATE board removes their access;
  on a WORKSPACE board they fall back to their workspace role.


  # Lists and cards permissions

Uses your effective board role.

| Action                                     | Owner | Admin | Member | Viewer |
|--------------------------------------------|:-----:|:-----:|:------:|:------:|
| View lists, cards, labels, checklists      |  ✅   |  ✅   |   ✅   |   ✅   |
| Create, rename, archive lists              |  ✅   |  ✅   |   ✅   |   ❌   |
| Create, edit, archive cards                |  ✅   |  ✅   |   ✅   |   ❌   |
| Assign people, add labels, edit checklist  |  ✅   |  ✅   |   ✅   |   ❌   |
| Create and delete board labels             |  ✅   |  ✅   |   ❌   |   ❌   |

- Viewers are read-only on everything.
- Only people with access to the board (and not Viewers) can be assigned to a card.
- Archived lists and cards are hidden but can be restored.

# Realtime (WebSocket) permissions

Uses the same rules as reading a board over HTTP.

| Action                                      | Owner | Admin | Member | Viewer | No access |
|---------------------------------------------|:-----:|:-----:|:------:|:------:|:---------:|
| Connect (needs a valid access token)        |  ✅   |  ✅   |   ✅   |   ✅   |    ✅     |
| `board:join` a board and get its live events |  ✅   |  ✅   |   ✅   |   ✅   |    ❌     |

- A socket without a valid access token is refused (`connect_error: unauthorized`).
- When the access token expires, the socket gets `auth:expired` and is disconnected.
- Joining a board you can't see answers `{ ok: false, error: "Not found" }`, like HTTP's 404.
- Viewers get every event: realtime is read-only, it never lets anyone change anything.
- Whenever access may have changed (board visibility, board members, workspace members, board
  or workspace deleted), everyone in the board's room is checked again. Anyone who lost access
  gets `board:access-removed` and stops getting events.


# Comments and activity permissions

Uses your effective board role.

| Action                                         | Owner | Admin | Member | Viewer |
|------------------------------------------------|:-----:|:-----:|:------:|:------:|
| Read comments, card and board activity         |  ✅   |  ✅   |   ✅   |   ✅   |
| See archived lists and cards                   |  ✅   |  ✅   |   ✅   |   ✅   |
| Write a comment                                |  ✅   |  ✅   |   ✅   |   ❌   |
| Edit a comment                                 | own   | own   |  own   |   ❌   |
| Delete a comment                               |  any  |  any  |  own   |   ❌   |
| Restore archived lists and cards               |  ✅   |  ✅   |   ✅   |   ❌   |

- Only the author can edit a comment, whatever their role.
- Deleting a comment is a soft delete: the card's activity shows "comment deleted".
- Viewers can't edit or delete comments they wrote before they became Viewers.
- Only people with access to the board count as @mentioned.
- People without access to the board get 404 on all of these.


# Notifications permissions

Notifications, push tokens and notification settings belong to one user: you can only see and
change your own. Someone else's notification id gets 404.

Who gets notified (never the person who did the action, and only people who can still see the
board):
- **Assigned to a card**: the person assigned.
- **@mentioned in a comment**: each mentioned person with access to the board.
- **New comment on a card**: everyone assigned to it, except people the comment mentions.
- **Invited to a workspace**: the invited email, if it already has a TaskKit account.
- **Card due within 24 hours**: its assignees, once per due date, unless they turned due
  reminders off.


# Attachments permissions

Uses your effective board role.

| Action                                   | Owner | Admin | Member | Viewer |
|------------------------------------------|:-----:|:-----:|:------:|:------:|
| See and download a card's files          |  ✅   |  ✅   |   ✅   |   ✅   |
| Upload a file                            |  ✅   |  ✅   |   ✅   |   ❌   |
| Finish an upload (`complete`)            | own   | own   |  own   |   ❌   |
| Delete a file                            |  any  |  any  |  own   |   ❌   |

- Allowed types: images, PDF, Office documents, plain text/CSV/Markdown. Up to 10 MB.
- Upload and download links are signed and expire after 10 minutes. Anyone holding a fresh
  link can use it, so the API only hands them out after the role checks above.
- People without access to the board get 404.


# Search permissions

| Action                                   | Owner | Admin | Member | Viewer | Not in workspace |
|------------------------------------------|:-----:|:-----:|:------:|:------:|:----------------:|
| Search a workspace's cards               |  ✅   |  ✅   |   ✅   |   ✅   |       404        |

- Results only come from boards you can see, by the same rules as opening a board: the workspace
  Owner sees every board; everyone else sees WORKSPACE boards and PRIVATE boards they were added
  to. Archived boards, lists and cards are never returned.
- Filtering by a board you can't see returns no results (not an error), so search can't be used
  to find out whether a private board exists.

- Workspace activity (`GET /workspaces/:id/activity`): any workspace member, and only entries
  from boards they can see (same rules as search). Outsiders get 404.


# Later additions (2026-11-27)

| Action                                              | Owner | Admin | Member | Viewer |
|-----------------------------------------------------|:-----:|:-----:|:------:|:------:|
| Change the workspace logo and rules                 |  ✅   |  ✅   |   ❌   |   ❌   |
| Create boards when "Members can create boards" is off |  ✅   |  ✅   |   ❌   |   ❌   |
| Sort a list's cards, archive all cards in a list    |  ✅   |  ✅   |   ✅   |   ❌   |

- Move a card to another board: you must be Owner, Admin or Member on **both** boards, and
  they must be in the same workspace.
- "Allow invite links" off: nobody can invite, and links already sent stop working.
- Decline an invite: only the person it was sent to (same email), like accepting.
- Sessions (`/me/sessions`): your own devices only. "Log out of other devices" keeps this one.
