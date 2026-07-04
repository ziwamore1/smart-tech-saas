import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';

const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, context.getHandler());
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No auth token');
    }

    try {
      const secret = process.env.JWT_SECRET || 'default-secret-key';
      const payload = verify(token, secret);

      request.user = {
        id: payload.sub,
        type: payload.type || 'user',
        roles: payload.roles || [],
        isSuperAdmin: payload.type === 'super_admin',
        schoolId: payload.type === 'super_admin' ? null : (payload.schoolId || null),
      };

      return true;
    } catch (err: any) {
      throw new UnauthorizedException(err.message || 'Invalid token');
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
