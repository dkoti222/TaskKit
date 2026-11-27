import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { MAX_LOGO_BYTES } from './dto/logo.dto';
import { DomainEvents } from '../../common/events/domain-events.service';
import { STORAGE_DRIVER, type StorageDriver } from '../storage/storage.driver';
import type { Workspace } from '../../generated/prisma/client';

/** How long a logo link works. The app refetches workspaces well within this. */
const LOGO_LINK_SECONDS = 60 * 60;

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /**
   * What the app gets for a workspace: everything but the storage key, plus `logoUrl` as a
   * fresh signed link to the uploaded logo (or null).
   */
  private async present<T extends Workspace>(workspace: T, baseUrl: string) {
    const { logoKey, logoUrl: _unused, ...rest } = workspace;
    return {
      ...rest,
      logoUrl: logoKey
        ? await this.storage.downloadUrl({
            key: logoKey,
            fileName: `logo.${logoKey.split('.').pop()}`,
            mimeType: logoKey.endsWith('.png')
              ? 'image/png'
              : logoKey.endsWith('.webp')
                ? 'image/webp'
                : 'image/jpeg',
            baseUrl,
            expiresIn: LOGO_LINK_SECONDS,
          })
        : null,
    };
  }

  async create(userId: string, dto: CreateWorkspaceDto, baseUrl: string) {
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
    return { ...(await this.present(workspace, baseUrl)), role: 'OWNER', memberCount: 1 };
  }

  async listMine(userId: string, baseUrl: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: {
        workspace: {
          include: { _count: { select: { members: true } } },
        },
      },
    });

    return Promise.all(
      memberships.map(async (m) => {
        const { _count, ...workspace } = m.workspace;
        const shown = await this.present(workspace, baseUrl);
        return {
          id: shown.id,
          name: shown.name,
          description: shown.description,
          logoUrl: shown.logoUrl,
          role: m.role,
          memberCount: _count.members,
          createdAt: shown.createdAt,
        };
      }),
    );
  }

  async getOne(userId: string, workspaceId: string, baseUrl: string) {
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
    return {
      ...(await this.present(workspace, baseUrl)),
      role: membership.role,
      memberCount: _count.members,
    };
  }

  /** Name, description and the rules (membersCanCreateBoards, allowInviteLinks). */
  async update(workspaceId: string, dto: UpdateWorkspaceDto, baseUrl: string) {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
    return this.present(workspace, baseUrl);
  }

  // ---------- Logo (screen 24: "Change logo") ----------

  /**
   * Step 1 of 2: where to PUT the image. The key is made here (never by the app), inside this
   * workspace's folder, so step 2 can check it belongs to this workspace.
   */
  async logoUploadUrl(workspaceId: string, mimeType: keyof typeof EXT, size: number, baseUrl: string) {
    const key = `workspaces/${workspaceId}/logo-${randomUUID()}.${EXT[mimeType]}`;
    const upload = await this.storage.uploadTarget({ key, mimeType, size, baseUrl });
    return { key, upload };
  }

  /** Step 2 of 2: use the uploaded image as the logo (the old one is deleted). */
  async setLogo(workspaceId: string, key: string, baseUrl: string) {
    if (!key.startsWith(`workspaces/${workspaceId}/`)) {
      throw new BadRequestException('That image belongs to another workspace');
    }
    const size = await this.storage.size(key);
    if (size === null) throw new BadRequestException('The image hasn’t been uploaded yet');
    if (size > MAX_LOGO_BYTES) {
      await this.storage.remove(key);
      throw new BadRequestException('Logos can be up to 2 MB.');
    }
    const old = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { logoKey: true },
    });
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { logoKey: key },
    });
    if (old.logoKey && old.logoKey !== key) await this.storage.remove(old.logoKey).catch(() => undefined);
    return this.present(workspace, baseUrl);
  }

  async removeLogo(workspaceId: string, baseUrl: string) {
    const old = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { logoKey: true },
    });
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { logoKey: null },
    });
    if (old.logoKey) await this.storage.remove(old.logoKey).catch(() => undefined);
    return this.present(workspace, baseUrl);
  }

  async remove(actorId: string, workspaceId: string) {
    const [boards, workspace] = await Promise.all([
      this.prisma.board.findMany({ where: { workspaceId }, select: { id: true } }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { logoKey: true } }),
    ]);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    if (workspace?.logoKey) await this.storage.remove(workspace.logoKey).catch(() => undefined);
    this.events.emit({
      type: 'workspace.deleted',
      workspaceId,
      actorId,
      data: { boardIds: boards.map((b) => b.id) },
    });
  }
}
