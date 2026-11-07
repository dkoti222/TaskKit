import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { EmailOnlyDto } from './dto/email-only.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { generateCode, sha256 } from '../../common/utils/hash';
import { toPublicUser } from '../users/user.mapper';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_WAIT_MS = 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  // ---------- Register ----------
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

  // ---------- Verify email ----------
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
    return { ...tokens, user: toPublicUser(verifiedUser) };
  }

  // ---------- Login ----------
  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || user.deletedAt || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email before logging in');
    }

    const tokens = await this.tokens.issueTokens(user);
    return { ...tokens, user: toPublicUser(user) };
  }

  // ---------- Resend verification code ----------
  async resendCode(dto: EmailOnlyDto) {
    const user = await this.users.findByEmail(dto.email);

    if (user && !user.emailVerifiedAt && !user.deletedAt) {
      const last = await this.prisma.emailVerification.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (last && Date.now() - last.createdAt.getTime() < RESEND_WAIT_MS) {
        throw new HttpException(
          'Please wait a minute before requesting a new code',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.prisma.emailVerification.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.sendVerificationCode(user.id, user.email);
    }

    return { message: 'If that account needs verifying, a new code has been sent.' };
  }

  // ---------- Forgot password ----------
  async forgotPassword(dto: EmailOnlyDto) {
    const user = await this.users.findByEmail(dto.email);

    if (user && !user.deletedAt) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      const base = this.config.get<string>('RESET_PASSWORD_URL') ?? 'taskkit://reset-password';
      await this.mail.sendPasswordReset(user.email, `${base}?token=${token}`);
    }

    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  // ---------- Reset password ----------
  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: sha256(dto.token) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated. Please log in again.' };
  }

  // ---------- Helper ----------
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