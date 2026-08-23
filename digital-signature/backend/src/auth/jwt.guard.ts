import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';

export interface AuthedOrg {
  id: string;
  sub: string;
}

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(header.slice(7));
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const org = await this.prisma.organisation.findUnique({ where: { id: payload.sub } });
    if (!org) throw new UnauthorizedException('Organisation not found');
    req.org = { id: org.id, email: org.email, name: org.name } as AuthedOrg & { email: string; name: string };
    return true;
  }
}
