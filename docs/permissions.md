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