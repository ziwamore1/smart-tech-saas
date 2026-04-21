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

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });

    const roleNames = userRoles.map((r) => r.role.name.toUpperCase());
    this.logger.log(`RolesGuard: userRoles from DB=${JSON.stringify(roleNames)}`);

    const hasRole = requiredRoles.some((role) => roleNames.includes(role.toUpperCase()));
    
    if (!hasRole) {
      this.logger.warn(`RolesGuard: Access denied for user ${user.id}. Has roles: ${roleNames.join(', ')}, Required: ${requiredRoles.join(', ')}`);
      throw new ForbiddenException('Access denied. Required role: ' + requiredRoles.join(' or '));
    }

    return true;
  }
}
