import { BoardAccessService } from './board-access.service';
import type { PrismaService } from '../../prisma/prisma.service';

type WsRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
type BoardRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * A fake Prisma with one board. `workspaceRole` undefined = not in the workspace;
 * `boardRole` undefined = not added to the board.
 */
function setup(opts: {
  visibility: 'WORKSPACE' | 'PRIVATE';
  workspaceRole?: WsRole;
  boardRole?: BoardRole;
  boardExists?: boolean;
}) {
  const board = { id: 'b1', workspaceId: 'w1', visibility: opts.visibility };
  const prisma = {
    board: { findUnique: jest.fn().mockResolvedValue(opts.boardExists === false ? null : board) },
    workspaceMember: {
      findUnique: jest.fn().mockResolvedValue(opts.workspaceRole ? { role: opts.workspaceRole } : null),
      findMany: jest.fn(),
    },
    boardMember: {
      findUnique: jest.fn().mockResolvedValue(opts.boardRole ? { role: opts.boardRole } : null),
    },
  };
  return new BoardAccessService(prisma as unknown as PrismaService);
}

const roleOf = async (opts: Parameters<typeof setup>[0]) =>
  (await setup(opts).resolve('b1', 'u1'))?.role ?? null;

describe('BoardAccessService.resolve', () => {
  it('returns null when the board does not exist', async () => {
    expect(await roleOf({ visibility: 'WORKSPACE', workspaceRole: 'OWNER', boardExists: false })).toBeNull();
  });

  it('returns null for people outside the workspace, even if a board row says otherwise', async () => {
    expect(await roleOf({ visibility: 'WORKSPACE' })).toBeNull();
    expect(await roleOf({ visibility: 'PRIVATE', boardRole: 'ADMIN' })).toBeNull();
  });

  describe('rule 1: the workspace Owner is OWNER everywhere', () => {
    it.each(['WORKSPACE', 'PRIVATE'] as const)('on a %s board, added or not', async (visibility) => {
      expect(await roleOf({ visibility, workspaceRole: 'OWNER' })).toBe('OWNER');
      expect(await roleOf({ visibility, workspaceRole: 'OWNER', boardRole: 'VIEWER' })).toBe('OWNER');
    });
  });

  describe('rule 2: added to the board → the board role (overrides the workspace role)', () => {
    it.each([
      ['ADMIN', 'VIEWER'],
      ['MEMBER', 'ADMIN'],
      ['VIEWER', 'MEMBER'],
      ['MEMBER', 'VIEWER'],
    ] as const)('workspace %s added as %s', async (workspaceRole, boardRole) => {
      for (const visibility of ['WORKSPACE', 'PRIVATE'] as const) {
        expect(await roleOf({ visibility, workspaceRole, boardRole })).toBe(boardRole);
      }
    });
  });

  describe('rule 3: WORKSPACE board, not added → the workspace role', () => {
    it.each(['ADMIN', 'MEMBER', 'VIEWER'] as const)('%s', async (workspaceRole) => {
      expect(await roleOf({ visibility: 'WORKSPACE', workspaceRole })).toBe(workspaceRole);
    });
  });

  describe('rule 4: PRIVATE board, not added → no access', () => {
    it.each(['ADMIN', 'MEMBER', 'VIEWER'] as const)('%s', async (workspaceRole) => {
      expect(await roleOf({ visibility: 'PRIVATE', workspaceRole })).toBeNull();
    });
  });
});
