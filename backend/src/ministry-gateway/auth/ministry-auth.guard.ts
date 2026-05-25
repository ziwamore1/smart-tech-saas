import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class MinistryAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-ministry-signature'];
    const timestamp = request.headers['x-ministry-timestamp'];

    if (!signature || !timestamp) {
      throw new UnauthorizedException('Missing ministry authentication headers');
    }

    const timeDiff = Date.now() - parseInt(timestamp);
    if (timeDiff > 5 * 60 * 1000) {
      throw new UnauthorizedException('Request timestamp expired');
    }

    const secret = this.configService.get<string>('MINISTRY_WEBHOOK_SECRET');
    if (!secret) {
      return true;
    }

    const body = JSON.stringify(request.body || {});
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}${body}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid ministry signature');
    }

    return true;
  }
}
