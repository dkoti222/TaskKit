import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { generateCode, sha256 } from '../../common/utils/hash';
import type { User } from '../../generated/prisma/client';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
    constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('This email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    await this.sendVerificationCode(user.id, user.email);

    return {
      message: 'Account created. Check your email for the verification code.',
    };
  }
    async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Invalid or expired code');
    if (user.emailVerifiedAt) throw new BadRequestException('Email is already verified');

    const record = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (record.attempts >= MAX_CODE_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Request a new code.');
    }
    if (record.codeHash !== sha256(dto.code)) {
      await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired code');
    }

    const [verifiedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    const tokens = await this.tokens.issueTokens(verifiedUser);
    return { ...tokens, user: this.toPublicUser(verifiedUser) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || user.deletedAt || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email before logging in');
    }

    const tokens = await this.tokens.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  private async sendVerificationCode(userId: string, email: string) {
    const code = generateCode();
    await this.prisma.emailVerification.create({
      data: {
        userId,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    await this.mail.sendVerificationCode(email, code);
  }
}