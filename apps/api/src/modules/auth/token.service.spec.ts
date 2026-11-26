import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import type { PrismaService } from '../../prisma/prisma.service';

type Row = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

/** An in-memory stand-in for the refresh_tokens table, enough for TokenService. */
function fakePrisma(user = { id: 'u1', email: 'ravi@taskkit.test', deletedAt: null as Date | null }) {
  const rows: Row[] = [];
  const matches = (row: Row, where: Partial<Row>) =>
    Object.entries(where).every(([k, v]) => row[k as keyof Row] === v);
  const prisma = {
    rows,
    refreshToken: {
      create: jest.fn(async ({ data }: { data: Omit<Row, 'id' | 'revokedAt'> }) => {
        const row = { ...data, id: `r${rows.length + 1}`, revokedAt: null };
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const row = rows.find((r) => r.tokenHash === where.tokenHash);
        return row ? { ...row, user } : null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
  };
  return { prisma, user };
}

function service(prisma: ReturnType<typeof fakePrisma>['prisma']) {
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: 900 } });
  const config = new ConfigService({ REFRESH_TTL_DAYS: 7 });
  return { tokens: new TokenService(prisma as unknown as PrismaService, jwt, config), jwt };
}

describe('TokenService', () => {
  it('issues a signed access token and stores only a hash of the refresh token', async () => {
    const { prisma, user } = fakePrisma();
    const { tokens, jwt } = service(prisma);
    const pair = await tokens.issueTokens(user);

    expect(jwt.verify<{ sub: string }>(pair.accessToken).sub).toBe('u1');
    expect(prisma.rows).toHaveLength(1);
    expect(prisma.rows[0].tokenHash).not.toBe(pair.refreshToken);
    expect(prisma.rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rotates: the old refresh token is revoked and a new pair in the same family is issued', async () => {
    const { prisma, user } = fakePrisma();
    const { tokens } = service(prisma);
    const first = await tokens.issueTokens(user);
    const second = await tokens.rotate(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(prisma.rows).toHaveLength(2);
    expect(prisma.rows[0].revokedAt).not.toBeNull();
    expect(prisma.rows[1].revokedAt).toBeNull();
    expect(prisma.rows[1].familyId).toBe(prisma.rows[0].familyId);
  });

  it('detects reuse: an already-rotated token revokes the whole family', async () => {
    const { prisma, user } = fakePrisma();
    const { tokens } = service(prisma);
    const first = await tokens.issueTokens(user);
    const second = await tokens.rotate(first.refreshToken);

    // Someone replays the first (stolen) token.
    await expect(tokens.rotate(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    expect(prisma.rows.every((r) => r.revokedAt !== null)).toBe(true);
    // So the legitimate newer token is dead too: everyone has to log in again.
    await expect(tokens.rotate(second.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('leaves other sessions (families) alone on reuse', async () => {
    const { prisma, user } = fakePrisma();
    const { tokens } = service(prisma);
    const phone = await tokens.issueTokens(user);
    const laptop = await tokens.issueTokens(user);
    await tokens.rotate(phone.refreshToken);
    await expect(tokens.rotate(phone.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(tokens.rotate(laptop.refreshToken)).resolves.toHaveProperty('accessToken');
  });

  it('refuses unknown and expired tokens, and deleted users', async () => {
    const { prisma, user } = fakePrisma();
    const { tokens } = service(prisma);
    await expect(tokens.rotate('not-a-real-token')).rejects.toThrow(UnauthorizedException);

    const pair = await tokens.issueTokens(user);
    prisma.rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(tokens.rotate(pair.refreshToken)).rejects.toThrow(UnauthorizedException);

    const other = fakePrisma({ id: 'u2', email: 'gone@taskkit.test', deletedAt: new Date() });
    const s2 = service(other.prisma);
    const p2 = await s2.tokens.issueTokens(other.user);
    await expect(s2.tokens.rotate(p2.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('revoke() makes a refresh token unusable', async () => {
    const { prisma, user } = fakePrisma();
    const { tokens } = service(prisma);
    const pair = await tokens.issueTokens(user);
    await tokens.revoke(pair.refreshToken);
    await expect(tokens.rotate(pair.refreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
