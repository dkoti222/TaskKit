import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { WorkspaceMember } from '../../generated/prisma/client';

const userFields = { id: true, name: true, email: true, avatarUrl: true } as const;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

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