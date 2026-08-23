import { Controller, Get, NotFoundException, Param, Header, Req } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { AuthenticationPipelineService } from './authentication-pipeline.service';

/**
 * Public document verification — NO authentication required.
 * Exposes only safe metadata; never internal IDs, student PII beyond the
 * institution-configured public label, tokens, or documents themselves.
 * Every attempt is recorded as an AuthVerificationEvent (never exposed).
 */
@Controller('public/verification')
export class PublicVerificationController {
  constructor(
    private verification: VerificationService,
    private pipeline: AuthenticationPipelineService,
  ) {}

  /** Resolve by short opaque QR code OR by serial number (e.g. STS-2026-000001). */
  @Get(':code')
  @Header('Cache-Control', 'no-store')
  async verify(@Param('code') code: string, @Req() req: any) {
    const payload = await this.verification.verifyPublic(code);
    if (!payload) {
      await this.pipeline.trackPublicVerification(
        code,
        'NOT_FOUND',
        req.ip,
        req.headers['user-agent'],
      );
      throw new NotFoundException({
        status: 'INVALID',
        message: 'No verified document matches this code.',
      });
    }
    await this.pipeline.trackPublicVerification(
      code,
      payload.status,
      req.ip,
      req.headers['user-agent'],
    );
    return payload;
  }
}
