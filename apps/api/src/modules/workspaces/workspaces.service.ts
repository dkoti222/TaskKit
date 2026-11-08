import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdById: userId,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
    });
    return { ...workspace, role: 'OWNER', memberCount: 1 };
  }

  async listMine(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: {
        workspace: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      description: m.workspace.description,
      logoUrl: m.workspace.logoUrl,
      role: m.role,
      memberCount: m.workspace._count.members,
      createdAt: m.workspace.createdAt,
    }));
  }

  async getOne(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: {
        workspace: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    const { _count, ...workspace } = membership.workspace;
    return { ...workspace, role: membership.role, memberCount: _count.members };
  }
    update(workspaceId: string, dto: UpdateWorkspaceDto) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
  }

  async remove(workspaceId: string) {
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }
}