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