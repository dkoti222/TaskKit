/**
 * Limits from the PDF (Non-functional rules · Limits, version 2.0). Going over one returns
 * 400 { code: "LIMIT_REACHED" }. Text lengths and the 10 MB file size are checked in the DTOs.
 */
export const LIMITS = {
  workspacesOwned: 10,
  membersPerWorkspace: 50,
  pendingInvitesPerWorkspace: 50,
  boardsPerWorkspace: 50,
  listsPerBoard: 30,
  cardsPerList: 500,
  attachmentsPerCard: 20,
} as const;
