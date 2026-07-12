// src/auth/guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    this.logger.log(`RolesGuard: user=${user.id}, schoolId=${user.schoolId}, roles=${JSON.stringify(user.roles)}`);
    this.logger.log(`RolesGuard: requiredRoles=${JSON.stringify(requiredRoles)}`);

    if (user.isSuperAdmin) {
      this.logger.log(`RolesGuard: SuperAdmin user bypass`);
      return true;
    }

    // Collect all roles from multiple sources
    const allRoleNames = new Set<string>();

    // 1. Legacy UserRole table (backward compatibility)
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    for (const ur of userRoles) {
      allRoleNames.add(ur.role.name.toUpperCase());
    }

    // 2. Platform roles
    if (user.platformRoles && Array.isArray(user.platformRoles)) {
      for (const pr of user.platformRoles) {
        allRoleNames.add(pr.toUpperCase());
      }
    }

    // 3. School roles (from JWT)
    if (user.schoolRoles && Array.isArray(user.schoolRoles)) {
      for (const sr of user.schoolRoles) {
        allRoleNames.add(sr.toUpperCase());
      }
    }

    // 4. School roles (from database, for cases where JWT is stale)
    if (user.schoolId) {
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId: user.id, schoolId: user.schoolId },
      });
      if (membership) {
        const schoolRoleAssignments = await this.prisma.schoolRoleAssignment.findMany({
          where: { schoolMembershipId: membership.id, isActive: true },
          select: { role: true },
        });
        for (const sra of schoolRoleAssignments) {
          allRoleNames.add(sra.role.toUpperCase());
        }
      }
    }

    const roleNames = Array.from(allRoleNames);
    this.logger.log(`RolesGuard: allRoles from DB+JWT=${JSON.stringify(roleNames)}`);

    const hasRole = requiredRoles.some((role) => roleNames.includes(role.toUpperCase()));
    
    if (!hasRole) {
      this.logger.warn(`RolesGuard: Access denied for user ${user.id}. Has roles: ${roleNames.join(', ')}, Required: ${requiredRoles.join(', ')}`);
      throw new ForbiddenException('Access denied. Required role: ' + requiredRoles.join(' or '));
    }

    return true;
  }
}
