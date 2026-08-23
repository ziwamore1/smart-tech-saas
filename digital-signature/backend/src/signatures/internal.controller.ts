import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ServiceAuthGuard } from '../auth/service-auth.guard';
import { SignaturesService } from './signatures.service';

/**
 * INTERNAL service-to-service API — consumed by the Digital Stamp Engine.
 * Guarded by x-service-key (ServiceAuthGuard); never exposed publicly and
 * never authenticated with user JWTs. See docs/AUTHENTICATION_PLATFORM.md.
 */
@Controller('internal/signatures')
@UseGuards(ServiceAuthGuard)
export class InternalController {
  constructor(private signatures: SignaturesService) {}

  @Post('sign')
  async sign(
    @Req() req: any,
    @Body()
    body: {
      organizationId: string;
      documentId?: string;
      documentName?: string;
      documentType?: string;
      documentHash: string;      // canonical SHA-256 of the final signable payload
      signerId?: string;
      signerRole?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!body?.organizationId || !body?.documentHash) {
      return this.bad('organizationId and documentHash are required');
    }
    if (!/^[a-f0-9]{64}$/i.test(body.documentHash)) {
      return this.bad('documentHash must be a 64-character hex SHA-256 digest');
    }
    const result = await this.signatures.sign(body.organizationId, {
      documentName: body.documentName || body.documentId || 'Institutional document',
      documentType: body.documentType,
      documentId: body.documentId,
      signerRole: body.signerRole,
      metadata: { ...(body.metadata || {}), correlationId: req.correlationId },
      canonicalHash: body.documentHash.toLowerCase(),
      signedBy: body.signerId || 'Authorised signatory',
    });
    return {
      signatureId: result.id,
      algorithm: result.algorithm,
      keyId: result.keyId,
      keyFingerprint: result.keyFingerprint,
      signature: result.signature,
      canonicalHash: result.canonicalHash,
      signedAt: result.signedAt,
      signedBy: result.signedBy,
      verificationCode: result.verificationCode,
    };
  }

  @Post('verify')
  async verify(
    @Req() req: any,
    @Body() body: { documentHash: string; signature: string; keyId?: string },
  ) {
    if (!body?.documentHash || !body?.signature) {
      return this.bad('documentHash and signature are required');
    }
    // Resolve candidate records by hash, then verify the exact (hash, signature, key) triple.
    const candidates = await (this.signatures as any).prisma.signature.findMany({
      where: { canonicalHash: body.documentHash.toLowerCase() },
      take: 5,
    });
    const match =
      candidates.find(c => c.signature === body.signature && (!body.keyId || c.keyId === body.keyId)) ??
      candidates.find(c => c.signature === body.signature);

    if (!match) {
      return {
        valid: false,
        reason: 'NO_MATCHING_SIGNATURE',
        keyId: body.keyId ?? null,
        algorithm: 'Ed25519',
        signedAt: null,
        signer: null,
      };
    }
    const full = await this.signatures.verify(match.id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      channel: 'INTERNAL',
    });
    return {
      valid: full.valid && Boolean(match.keyId),
      status: full.status,
      reason: full.reason,
      keyId: match.keyId,
      keyStatus: full.keyStatus,
      algorithm: full.signature?.algorithm ?? 'Ed25519',
      signedAt: full.signature?.signedAt ?? null,
      signer: full.signature?.signedBy ?? null,
      signerRole: full.signature?.signerRole ?? null,
      organisation: full.organisation?.name ?? null,
      signatureId: match.id,
    };
  }

  @Get('public-key/:keyId')
  async publicKey(@Param('keyId') keyId: string) {
    const key = await (this.signatures as any).prisma.signingKey.findUnique({
      where: { id: keyId },
      select: { id: true, publicKey: true, algorithm: true, status: true, fingerprint: true, organisationId: true },
    });
    if (!key) return this.bad('Unknown keyId');
    const org = await (this.signatures as any).prisma.organisation.findUnique({
      where: { id: key.organisationId },
      select: { name: true, slug: true },
    });
    return { keyId: key.id, publicKey: key.publicKey, algorithm: key.algorithm, status: key.status, fingerprint: key.fingerprint, organisation: org?.name };
  }

  private bad(message: string) {
    return { statusCode: 400, message };
  }
}
