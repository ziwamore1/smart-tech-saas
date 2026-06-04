import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'default-secret-key',
    });
  }

  async validate(payload: any) {
    const user: any = {
      id: payload.sub,
      type: payload.type || 'user',
      roles: payload.roles || [],
    };

    if (payload.type === 'super_admin') {
      user.isSuperAdmin = true;
      user.schoolId = null;
    } else {
      user.isSuperAdmin = false;
      user.schoolId = payload.schoolId || null;
    }

    if (global.request) {
      global.request.user = user;
    }

    return user;
  }
}
