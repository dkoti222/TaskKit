import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { sha256 } from '../../common/utils/hash';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import type { WorkspaceMember } from '../../generated/prisma/client';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(actor: WorkspaceMember, workspaceId: string, dto: CreateInvitationDto) {
    if (dto.role === 'ADMIN' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Only the Owner can invite Admins');
    }

    const alreadyMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, user: { email: dto.email } },
    });
    if (alreadyMember) {
      throw new ConflictException('This person is already a member');
    }

    await this.prisma.invitation.updateMany({
      where: { workspaceId, email: dto.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const invitation = await this.prisma.invitation.create({
      data: {
        workspaceId,
        email: dto.email,
        role: dto.role,
        tokenHash: sha256(token),
        invitedById: actor.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      include: { workspace: { select: { name: true } } },
    });

    const base = this.config.get<string>('INVITE_URL') ?? 'taskkit://invite';
    await this.mail.sendInvitation(dto.email, invitation.workspace.name, `${base}/${token}`);

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  listPending(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
    });
  }

  async revoke(workspaceId: string, invitationId: string) {
    const result = await this.prisma.invitation.updateMany({
      where: { id: invitationId, workspaceId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Invitation not found');
    }
  }

  async preview(user: AuthUser, token: string) {
    const invitation = await this.findValid(token);
    return {
      workspace: invitation.workspace,
      role: invitation.role,
      invitedBy: invitation.invitedBy.name,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      isForYou: invitation.email === user.email,
    };
  }

  async accept(user: AuthUser, token: string) {
    const invitation = await this.findValid(token);
    if (invitation.email !== user.email) {
      throw new ForbiddenException('This invite was sent to a different email address');
    }

    await this.prisma.$transaction([
      this.prisma.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
        create: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
        update: {},
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return {
      workspaceId: invitation.workspaceId,
      name: invitation.workspace.name,
      role: invitation.role,
    };
  }

  private async findValid(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        workspace: { select: { id: true, name: true } },
        invitedBy: { select: { name: true } },
      },
    });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt < new Date()
    ) {
      throw new BadRequestException('This invite is invalid or has expired');
    }
    return invitation;
  }
}