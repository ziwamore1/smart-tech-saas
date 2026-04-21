import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class SchoolGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const schoolId = request.params.schoolId || request.body?.schoolId || request.query?.schoolId;

    if (schoolId) {
      const userSchoolIds = user.schoolIds || [];
      if (!userSchoolIds.includes(schoolId)) {
        throw new ForbiddenException('Access to this school is not permitted');
      }

      request.schoolId = schoolId;
    } else {
      request.schoolId = user.currentSchoolId;
    }

    if (!request.schoolId) {
      throw new ForbiddenException('No school context specified');
    }

    return true;
  }
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const userRoles = user.roles || [];
    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

export const Roles = (...roles: string[]) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    descriptor && (descriptor.value = target[key]);
    return Reflector.defineMetadata('roles', roles, descriptor?.value || target);
  };
};

@Injectable()
export class SchoolMiddleware {
  use(req: any, res: any, next: (err?: any) => void) {
    const user = req.user;

    if (user && user.currentSchoolId) {
      req.schoolId = user.currentSchoolId;
    }

    next();
  }
}

export function attachSchoolContext(req: any, res: any, next: () => void) {
  if (req.user) {
    req.schoolId = req.user.currentSchoolId || req.headers['x-school-id'];
  }
  next();
}

export { SchoolGuard as Guard, RoleGuard as RGuard };