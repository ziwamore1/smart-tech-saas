import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_STAMP_PERMISSIONS,
  DocumentStampPermission,
  STAMP_ADMIN_ROLES,
  defaultPermissionsForRoles,
} from './stamp-engine.types';

export interface ActorContext {
  userId: string;
  schoolId?: string | null;
  roles: string[];
  isSuperAdmin?: boolean;
}

/**
 * Normalize the JWT guard's req.user ({id, roles, schoolId, isSuperAdmin})
 * into the ActorContext shape the stamp-engine services expect.
 * Prevents silent `userId: undefined` reaching required DB relations.
 */
export function actorFromRequestUser(u: any): ActorContext {
  if (!u) return { userId: '', roles: [] };
  return {
    ...u,
    userId: u.userId ?? u.id ?? '',
    roles: u.roles || [],
    schoolId: u.schoolId ?? null,
    isSuperAdmin: !!u.isSuperAdmin,
  };
}

/**
 * DOCUMENT_STAMP_* permission resolution.
 *
 * Order of authority (matches the existing platform model):
 *   1. Super admin bypass
 *   2. Explicit per-membership overrides in UserPermissionOverride (Director-controlled)
 *   3. Role defaults (Director / Head Teacher / Admin hold everything;
 *      ordinary teachers only get VIEW + VERIFY)
 */
@Injectable()
export class StampPermissionService {
  private readonly logger = new Logger(StampPermissionService.name);

  constructor(private prisma: PrismaService) {}

  async assert(
    actor: ActorContext,
    permission: DocumentStampPermission,
    options: { schoolId?: string; auditDenied?: boolean } = {},
  ): Promise<void> {
    const allowed = await this.hasPermission(actor, permission, options.schoolId);
    if (!allowed) {
      this.logger.warn(
        `DENIED ${permission} user=${actor.userId} school=${options.schoolId || actor.schoolId}`,
      );
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
  }

  async hasPermission(
    actor: ActorContext,
    permission: DocumentStampPermission,
    scopeSchoolId?: string,
  ): Promise<boolean> {
    if (actor.isSuperAdmin) return true;

    const schoolId = scopeSchoolId || actor.schoolId;
    if (!schoolId) return false;
    if (!DOCUMENT_STAMP_PERMISSIONS.includes(permission)) return false;

    // Role defaults first (fast path).
    const roleDefaults = defaultPermissionsForRoles(actor.roles || []);
    if (roleDefaults.has(permission)) return true;

    // Explicit overrides via school membership.
    const membership = await this.prisma.schoolUser.findFirst({
      where: { userId: actor.userId, schoolId },
      select: { id: true },
    });
    if (!membership) return false;

    const override = await this.prisma.userPermissionOverride.findFirst({
      where: { schoolMembershipId: membership.id, permission },
      select: { granted: true },
    });

    return override?.granted === true;
  }

  /** Permission list for UI gating (frontend should mirror, backend enforces). */
  async listForActor(actor: ActorContext, scopeSchoolId?: string): Promise<string[]> {
    if (actor.isSuperAdmin) return [...DOCUMENT_STAMP_PERMISSIONS];
    const results = await Promise.all(
      DOCUMENT_STAMP_PERMISSIONS.map(async p => ({
        p,
        ok: await this.hasPermission(actor, p, scopeSchoolId),
      })),
    );
    return results.filter(r => r.ok).map(r => r.p);
  }

  isAdminRoles(roles: string[]): boolean {
    return (roles || []).some(r => STAMP_ADMIN_ROLES.includes(r));
  }
}
