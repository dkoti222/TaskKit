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
import { DomainEvents } from '../../common/events/domain-events.service';
import { AuditService } from './audit.service';
import { LIMITS } from '../../common/limits';
import { limitReached } from '../../common/errors/api-errors';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly events: DomainEvents,
    private readonly audit: AuditService,
  ) {}

  async create(actor: WorkspaceMember, workspaceId: string, dto: CreateInvitationDto) {
    if (dto.role === 'ADMIN' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Only the Owner can invite Admins');
    }
    const rules = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { allowInviteLinks: true },
    });
    if (!rules.allowInviteLinks) {
      throw new ForbiddenException('Invite links are turned off for this workspace');
    }
    const [members, pending] = await Promise.all([
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.invitation.count({
        where: {
          workspaceId,
          acceptedAt: null,
          revokedAt: null,
          declinedAt: null,
          expiresAt: { gt: new Date() },
          email: { not: dto.email }, // re-inviting replaces the old invite
        },
      }),
    ]);
    if (members >= LIMITS.membersPerWorkspace) {
      throw limitReached(`A workspace can have up to ${LIMITS.membersPerWorkspace} members.`);
    }
    if (pending >= LIMITS.pendingInvitesPerWorkspace) {
      throw limitReached(
        `A workspace can have up to ${LIMITS.pendingInvitesPerWorkspace} pending invites. Revoke some first.`,
      );
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
    const link = `${base}/${token}`;
    await this.mail.sendInvitation(dto.email, invitation.workspace.name, link);
    // If this email already has an account, they also get an in-app notification (Step 11).
    this.events.emit({
      type: 'invitation.created',
      workspaceId,
      actorId: actor.userId,
      data: { email: dto.email, role: dto.role, token },
    });
    await this.audit.record(workspaceId, actor.userId, 'INVITATION_SENT', null, {
      email: dto.email,
      role: dto.role,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      // Only now: the token is stored hashed, so this is the inviter's one chance to copy it.
      link,
    };
  }

  listPending(workspaceId: string) {
    return this.prisma.invitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
      },
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

  async revoke(actorId: string, workspaceId: string, invitationId: string) {
    const result = await this.prisma.invitation.updateMany({
      where: { id: invitationId, workspaceId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Invitation not found');
    }
    await this.audit.record(workspaceId, actorId, 'INVITATION_REVOKED', null, { invitationId });
  }

  async preview(user: AuthUser, token: string) {
    const invitation = await this.findValid(token);
    return {
      workspace: { id: invitation.workspace.id, name: invitation.workspace.name },
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
    const members = await this.prisma.workspaceMember.count({
      where: { workspaceId: invitation.workspaceId },
    });
    if (members >= LIMITS.membersPerWorkspace) {
      throw limitReached('This workspace is full. Ask an Admin to make room.');
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

    await this.audit.record(invitation.workspaceId, user.id, 'MEMBER_JOINED', user.id, {
      role: invitation.role,
    });
    return {
      workspaceId: invitation.workspaceId,
      name: invitation.workspace.name,
      role: invitation.role,
    };
  }

  /** The invited person says no. Only the invited email can decline, like accepting. */
  async decline(user: AuthUser, token: string) {
    const invitation = await this.findValid(token);
    if (invitation.email !== user.email) {
      throw new ForbiddenException('This invite was sent to a different email address');
    }
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { declinedAt: new Date() },
    });
    return { message: 'Invite declined' };
  }

  private async findValid(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        workspace: { select: { id: true, name: true, allowInviteLinks: true } },
        invitedBy: { select: { name: true } },
      },
    });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.declinedAt ||
      invitation.expiresAt < new Date()
    ) {
      throw new BadRequestException('This invite is invalid or has expired');
    }
    if (!invitation.workspace.allowInviteLinks) {
      throw new BadRequestException('Invite links are turned off for this workspace');
    }
    return invitation;
  }
}