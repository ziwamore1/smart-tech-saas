import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard';
import { SignaturesService } from './signatures.service';

export class SignDto {
  @IsString() documentName!: string;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() documentId?: string;
  @IsOptional() @IsString() signerRole?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
  @IsString() signedBy!: string;
}

export class RevokeDto {
  @IsString() reason!: string;
}

export class SupersedeDto {
  @IsString() replacementId!: string;
}

const STATUSES = ['ACTIVE', 'REVOKED', 'SUPERSEDED'] as const;

@Controller('signatures')
@UseGuards(JwtGuard)
export class SignaturesController {
  constructor(private signatures: SignaturesService) {}

  // ── Signing-key lifecycle ──

  @Post('keys')
  ensureKeys(@Req() req: any) {
    return this.signatures.ensureActiveKey(req.org.id).then(k => ({
      keyId: k.id,
      fingerprint: k.fingerprint,
      algorithm: k.algorithm,
      status: k.status,
      publicKey: k.publicKey,
    }));
  }

  @Post('keys/rotate')
  rotate(@Req() req: any) {
    return this.signatures.rotateKey(req.org.id);
  }

  @Get('keys')
  async listKeys(@Req() req: any) {
    return { keys: await this.signatures.listKeys(req.org.id) };
  }

  @Patch('keys/:keyId/revoke')
  revokeKey(@Req() req: any, @Param('keyId') keyId: string, @Body() dto: RevokeDto) {
    return this.signatures.revokeKey(req.org.id, keyId, dto.reason);
  }

  // ── Signatures ──

  @Post()
  sign(@Req() req: any, @Body() dto: SignDto) {
    return this.signatures.sign(req.org.id, dto);
  }

  @Get('verify/:idOrHash')
  verify(@Req() req: any, @Param('idOrHash') idOrHash: string) {
    return this.signatures.verify(idOrHash, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      channel: 'PORTAL',
    });
  }

  @Get()
  async list(@Req() req: any, @Query('status') status?: string) {
    const valid = STATUSES.find(x => x === status);
    return { signatures: await this.signatures.list(req.org.id, valid) };
  }

  @Get(':id/audit-trail')
  async auditTrail(@Req() req: any, @Param('id') id: string) {
    return { entries: await this.signatures.auditTrail(req.org.id, id) };
  }

  @Get(':id/verification-events')
  async verificationEvents(@Req() req: any, @Param('id') id: string) {
    return { events: await this.signatures.verificationEvents(req.org.id, id) };
  }

  @Patch(':id/revoke')
  revoke(@Req() req: any, @Param('id') id: string, @Body() dto: RevokeDto) {
    return this.signatures.revoke(req.org.id, id, dto.reason, req.org?.email);
  }

  @Patch(':id/supersede')
  supersede(@Req() req: any, @Param('id') id: string, @Body() dto: SupersedeDto) {
    return this.signatures.supersede(req.org.id, id, dto.replacementId, req.org?.email);
  }
}
