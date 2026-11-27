import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { pageArgs, toPage, type PageQueryDto } from '../../common/utils/pagination';

export type AuditAction =
  | 'ROLE_CHANGED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_LEFT'
  | 'MEMBER_JOINED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'INVITATION_SENT'
  | 'INVITATION_REVOKED'
  | 'SETTINGS_CHANGED'
  | 'LOGO_CHANGED';

/**
 * The workspace audit log (PDF data model: audit_logs): who changed membership, roles, ownership
 * and settings. Board and card changes are in Activity instead. Writing never fails a request:
 * a problem is only logged.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    workspaceId: string,
    actorId: string,
    action: AuditAction,
    targetId: string | null,
    payload: Record<string, unknown> = {},
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { workspaceId, actorId, action, targetId, payload: payload as Prisma.InputJsonValue },
      });
    } catch {
      // The change itself already happened; the log is secondary.
    }
  }

  /** Newest first. Includes the actor's name and, for people, the target's name. */
  async list(workspaceId: string, query: PageQueryDto) {
    const rows = await this.prisma.auditLog.findMany({
      where: { workspaceId },
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
      ...pageArgs(query),
    });
    const page = toPage(rows, query);
    const targetIds = [...new Set(page.items.map((r) => r.targetId).filter((id): id is string => !!id))];
    const people = targetIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true } })
      : [];
    const names = new Map(people.map((p) => [p.id, p.name]));
    return {
      nextCursor: page.nextCursor,
      items: page.items.map((r) => ({
        id: r.id,
        action: r.action,
        createdAt: r.createdAt,
        actor: r.actor,
        targetId: r.targetId,
        targetName: r.targetId ? (names.get(r.targetId) ?? null) : null,
        payload: r.payload,
      })),
    };
  }
}
