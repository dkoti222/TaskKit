import { Injectable } from '@nestjs/common';
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

  async issueTokens(user: { id: string; email: string }, familyId: string = randomUUID()) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });

    const refreshToken = randomBytes(64).toString('hex');
    const days = Number(this.config.get('REFRESH_TTL_DAYS') ?? 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + days * DAY_MS),
      },
    });

    return { accessToken, refreshToken };
  }
}