import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { WorkspaceMember } from '../../generated/prisma/client';
import { DomainEvents } from '../../common/events/domain-events.service';
import { AuditService } from './audit.service';

const userFields = { id: true, name: true, email: true, avatarUrl: true } as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly audit: AuditService,
  ) {}

  /** A workspace role change or removal can change what someone sees on its boards. */
  private memberChanged(actorId: string, workspaceId: string, userId: string, role: string | null) {
    this.events.emit({
      type: 'workspace.member.changed',
      workspaceId,
      actorId,
      data: { userId, role },
    });
  }

  async list(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: userFields } },
    });
    return members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async changeRole(
    actor: WorkspaceMember,
    workspaceId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER',
  ) {
    const target = await this.getTarget(workspaceId, userId);
    this.checkCanManage(actor, target);

    if (role === 'ADMIN' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Only the Owner can make someone an Admin');
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role },
      include: { user: { select: userFields } },
    });
    this.memberChanged(actor.userId, workspaceId, userId, role);
    await this.audit.record(workspaceId, actor.userId, 'ROLE_CHANGED', userId, { from: target.role, to: role });
    return {
      userId: updated.userId,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
    };
  }

  async remove(actor: WorkspaceMember, workspaceId: string, userId: string) {
    const target = await this.getTarget(workspaceId, userId);
    this.checkCanManage(actor, target);

    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    this.memberChanged(actor.userId, workspaceId, userId, null);
    await this.audit.record(workspaceId, actor.userId, 'MEMBER_REMOVED', userId, { role: target.role });
  }

    async transferOwnership(actor: WorkspaceMember, workspaceId: string, newOwnerId: string) {
    if (actor.userId === newOwnerId) {
      throw new BadRequestException('You are already the Owner');
    }
    await this.getTarget(workspaceId, newOwnerId);

    await this.prisma.$transaction([
      this.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
        data: { role: 'OWNER' },
      }),
      this.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
        data: { role: 'ADMIN' },
      }),
    ]);
    this.memberChanged(actor.userId, workspaceId, newOwnerId, 'OWNER');
    this.memberChanged(actor.userId, workspaceId, actor.userId, 'ADMIN');
    await this.audit.record(workspaceId, actor.userId, 'OWNERSHIP_TRANSFERRED', newOwnerId);

    return { message: 'Ownership transferred. You are now an Admin.' };
  }

  async leave(actor: WorkspaceMember, workspaceId: string) {
    if (actor.role === 'OWNER') {
      throw new BadRequestException('Transfer ownership before leaving this workspace');
    }
    await this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
    });
    this.memberChanged(actor.userId, workspaceId, actor.userId, null);
    await this.audit.record(workspaceId, actor.userId, 'MEMBER_LEFT', actor.userId, { role: actor.role });
  }

  private async getTarget(workspaceId: string, userId: string) {
    const target = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }
    return target;
  }

  private checkCanManage(actor: WorkspaceMember, target: WorkspaceMember) {
    if (actor.userId === target.userId) {
      throw new BadRequestException("You can't change or remove yourself here");
    }
    if (target.role === 'OWNER') {
      throw new ForbiddenException("The Owner can't be changed or removed");
    }
    if (target.role === 'ADMIN' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Only the Owner can manage Admins');
    }
  }
}