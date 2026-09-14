import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const FILE_PATH = /(\.html|\.pdf(\/view)?|\.xlsx|\.csv)$/i;

@Injectable()
export class BusinessCalendarAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.headerToken(request) || this.queryToken(request);

    if (!token) throw new UnauthorizedException('Missing authentication token');

    try {
      const payload = this.jwtService.verify(token);
      request.user = {
        id: payload.sub,
        type: payload.type || 'user',
        roles: payload.roles || [],
        platformRoles: payload.platformRoles || [],
        schoolRoles: payload.schoolRoles || [],
        isSuperAdmin: payload.type === 'super_admin',
        schoolId: payload.type === 'super_admin' ? null : payload.schoolId || null,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private headerToken(request: any): string | null {
    const auth = request.headers?.authorization;
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return parts[1];
  }

  private queryToken(request: any): string | null {
    if (String(request.method || 'GET').toUpperCase() !== 'GET') return null;
    const token = request.query?.token;
    if (typeof token !== 'string' || !token) return null;
    const path = String(request.path || request.url || '').split('?')[0];
    if (!FILE_PATH.test(path)) return null;
    return token;
  }
}