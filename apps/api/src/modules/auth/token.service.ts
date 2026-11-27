import { Injectable,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from '../../common/utils/hash';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * A new access + refresh token pair. `familyId` is the session (one per login, kept through
   * every refresh); it goes in the access token as `sid` so the API knows which device is asking.
   */
  async issueTokens(
    user: { id: string; email: string },
    familyId: string = randomUUID(),
    deviceName?: string | null,
  ) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, sid: familyId });

    const refreshToken = randomBytes(64).toString('hex');
    const days = Number(this.config.get('REFRESH_TTL_DAYS') ?? 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId,
        deviceName: deviceName?.trim().slice(0, 100) || null,
        expiresAt: new Date(Date.now() + days * DAY_MS),
      },
    });

    return { accessToken, refreshToken };
  }
    async rotate(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (record.expiresAt < new Date() || record.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(record.user, record.familyId, record.deviceName);
  }

  async revoke(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------- Sessions (screen 22: active devices) ----------

  /**
   * One entry per signed-in device: a token family with a live (not revoked, not expired)
   * refresh token. `signedInAt` is the family's first token, `lastActiveAt` its newest
   * (every refresh makes a new token).
   */
  async listSessions(userId: string, currentSessionId?: string) {
    const live = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { familyId: true, deviceName: true, createdAt: true },
    });
    const familyIds = [...new Set(live.map((t) => t.familyId))];
    const firsts = await this.prisma.refreshToken.groupBy({
      by: ['familyId'],
      where: { familyId: { in: familyIds } },
      _min: { createdAt: true },
    });
    const signedIn = new Map(firsts.map((f) => [f.familyId, f._min.createdAt]));
    return familyIds.map((id) => {
      const newest = live.find((t) => t.familyId === id)!;
      return {
        id,
        deviceName: newest.deviceName,
        signedInAt: signedIn.get(id) ?? newest.createdAt,
        lastActiveAt: newest.createdAt,
        current: id === currentSessionId,
      };
    });
  }

  /**
   * Logs out every other device: revokes their refresh tokens, so their next refresh fails.
   * (Their current access token still works until it expires, at most 15 minutes.)
   */
  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, familyId: { not: currentSessionId } },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}
