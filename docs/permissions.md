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