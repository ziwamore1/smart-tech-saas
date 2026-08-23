import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Service-to-service authentication for /internal/* endpoints.
 *
 * Credentials are configured server-side only:
 *   INTERNAL_SERVICE_KEYS="stamp-engine:<secret1>,report-queue:<secret2>"
 *
 * Rotation: append the new `id:secret` pair, deploy, then remove the old one.
 * Comparison is constant-time to prevent timing oracles. User JWTs are never
 * accepted on internal endpoints.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const presented = req.headers['x-service-key'];
    if (!presented || typeof presented !== 'string') {
      throw new UnauthorizedException('Missing x-service-key header');
    }
    const configured = this.parseConfiguredKeys();
    // Accepted header forms: "<secret>" or "<id>:<secret>" (self-identifying).
    const match = configured.find(
      k => this.safeEqual(k.secret, presented) || this.safeEqual(`${k.id}:${k.secret}`, presented),
    );
    if (!match) throw new UnauthorizedException('Invalid service credential');
    req.serviceIdentity = { id: match.id };
    return true;
  }

  private parseConfiguredKeys(): { id: string; secret: string }[] {
    const raw = process.env.INTERNAL_SERVICE_KEYS || '';
    return raw
      .split(',')
      .map(pair => pair.trim())
      .filter(Boolean)
      .map(pair => {
        const idx = pair.indexOf(':');
        return idx === -1
          ? { id: 'unknown', secret: pair }
          : { id: pair.slice(0, idx), secret: pair.slice(idx + 1) };
      });
  }

  private safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // still burn comparable time before failing
      let burn = 0;
      for (let i = 0; i < b.length; i++) burn |= a.charCodeAt(i % Math.max(a.length, 1)) ^ b.charCodeAt(i);
      void burn;
      return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
}
