import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext) {
    console.error('[JwtAuthGuard] canActivate called');

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      console.error('[JwtAuthGuard] no token found, returning false');
      return false;
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = {
        id: payload.sub,
        type: payload.type || 'user',
        roles: payload.roles || [],
        isSuperAdmin: payload.type === 'super_admin',
        schoolId: payload.type === 'super_admin' ? null : (payload.schoolId || null),
      };
      return true;
    } catch (err: any) {
      console.error('[JwtAuthGuard] token invalid:', err.message);
      return false;
    }
  }

  private extractToken(request: any): string | null {
    const auth = request.headers?.authorization;
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return parts[1];
  }
}
