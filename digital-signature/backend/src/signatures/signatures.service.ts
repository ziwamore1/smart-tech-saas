import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptoService } from '../crypto.service';

export interface SignInput {
  documentName: string;
  documentType?: string;
  documentId?: string;
  signerRole?: string;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  /** Pre-computed canonical payload hash (hex). When supplied, content is ignored
   *  and the caller's hash is signed as-is — used by the internal stamp-engine bridge. */
  canonicalHash?: string;
  signedBy: string;
}

@Injectable()
export class SignaturesService {
  constructor(private prisma: PrismaService, private crypto: CryptoService) {}

  // ──────────────────────────────────────────────
  // KEY LIFECYCLE — generate / activate / rotate / revoke
  // ──────────────────────────────────────────────

  /** Returns the ACTIVE key for the org, creating (or migrating legacy) one if absent. */
  async ensureActiveKey(orgId: string) {
    let key = await this.prisma.signingKey.findFirst({
      where: { organisationId: orgId, status: 'ACTIVE' },
    });
    if (key) return key;

    const org = await this.prisma.organisation.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organisation not found');

    // One-time migration of the legacy embedded org key into the lifecycle table.
    if (org.publicKey && org.privateKeyEnc) {
      const legacyFp = org.keyFingerprint || this.crypto.generateKeyPair().fingerprint;
      const existing = await this.prisma.signingKey.findUnique({ where: { fingerprint: legacyFp } });
      key = existing ?? (await this.prisma.signingKey.create({
        data: {
          organisationId: orgId,
          publicKey: org.publicKey,
          privateKeyEnc: org.privateKeyEnc,
          fingerprint: legacyFp,
          activatedAt: org.createdAt,
        },
      }));
      return key;
    }

    return this.createKey(orgId);
  }

  async createKey(orgId: string) {
    const kp = this.crypto.generateKeyPair();
    const clash = await this.prisma.signingKey.findUnique({ where: { fingerprint: kp.fingerprint } });
    if (clash) throw new ConflictException('Key fingerprint collision — regenerate');
    const key = await this.prisma.signingKey.create({
      data: {
        organisationId: orgId,
        publicKey: kp.publicKey,
        privateKeyEnc: this.crypto.encryptPrivate(kp.privateKey),
        fingerprint: kp.fingerprint,
      },
    });
    // Keep legacy columns in sync for older readers.
    await this.prisma.organisation.update({
      where: { id: orgId },
      data: { publicKey: kp.publicKey, privateKeyEnc: key.privateKeyEnc, keyFingerprint: kp.fingerprint },
    });
    await this.audit(orgId, null, 'KEY_GENERATED', `fp:${kp.fingerprint}`);
    return key;
  }

  /** Rotate: current ACTIVE → ROTATED; fresh key becomes the single ACTIVE. */
  async rotateKey(orgId: string) {
    const current = await this.ensureActiveKey(orgId);
    await this.prisma.signingKey.update({
      where: { id: current.id },
      data: { status: 'ROTATED', rotatedAt: new Date() },
    });
    const next = await this.createKey(orgId);
    await this.audit(orgId, null, 'KEY_ROTATED', `${current.fingerprint} → ${next.fingerprint}`);
    return { rotatedFrom: current.id, activeKey: this.publicView(next) };
  }

  async revokeKey(orgId: string, keyId: string, reason: string) {
    const key = await this.prisma.signingKey.findFirst({ where: { id: keyId, organisationId: orgId } });
    if (!key) throw new NotFoundException('Signing key not found');
    if (key.status === 'REVOKED') throw new BadRequestException('Key already revoked');
    const updated = await this.prisma.signingKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason || 'Revoked by organisation' },
    });
    await this.audit(orgId, null, 'KEY_REVOKED', `fp:${key.fingerprint} ${reason}`);
    return this.publicView(updated);
  }

  async listKeys(orgId: string) {
    const keys = await this.prisma.signingKey.findMany({
      where: { organisationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(k => this.publicView(k));
  }

  private publicView(k: any) {
    return {
      id: k.id,
      fingerprint: k.fingerprint,
      algorithm: k.algorithm,
      status: k.status,
      activatedAt: k.activatedAt,
      rotatedAt: k.rotatedAt,
      revokedAt: k.revokedAt,
      revokedReason: k.revokedReason ?? undefined,
      publicKey: k.publicKey,
    };
  }

  // ──────────────────────────────────────────────
  // SIGNING
  // ──────────────────────────────────────────────

  async sign(orgId: string, input: SignInput) {
    if (!input.documentName || !input.signedBy) {
      throw new BadRequestException('documentName and signedBy are required');
    }
    const key = await this.ensureActiveKey(orgId);
    const org = await this.prisma.organisation.findUniqueOrThrow({ where: { id: orgId } });

    const canonicalHash = input.canonicalHash ?? this.canonicalHashFromContent(org, input);

    const signature = this.crypto.sign(key.privateKeyEnc ? this.decryptForSigning(key.privateKeyEnc) : '', canonicalHash)
    ;
    const record = await this.prisma.signature.create({
      data: {
        organisationId: orgId,
        documentName: input.documentName,
        documentType: input.documentType ?? null,
        documentId: input.documentId ?? null,
        signerRole: input.signerRole ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        canonicalHash,
        signature,
        publicKey: key.publicKey,
        keyId: key.id,
        signedBy: input.signedBy,
      },
    });
    await this.audit(orgId, record.id, 'DOCUMENT_SIGNED',
      `${input.documentName}${input.signerRole ? ` as ${input.signerRole}` : ''} hash:${canonicalHash.slice(0, 16)}…`,
      input.metadata?.correlationId as string | undefined);
    return {
      id: record.id,
      documentName: record.documentName,
      documentId: record.documentId,
      signerRole: record.signerRole,
      canonicalHash,
      signature,
      keyId: key.id,
      keyFingerprint: key.fingerprint,
      publicKey: key.publicKey,
      algorithm: record.algorithm,
      signedBy: record.signedBy,
      signedAt: record.createdAt,
      verificationCode: canonicalHash.slice(0, 12).toUpperCase(),
    };
  }

  private decryptForSigning(privateKeyEnc: string): string {
    return this.crypto.decryptPrivate(privateKeyEnc);
  }

  private canonicalHashFromContent(org: { id: string; slug: string }, input: SignInput): string {
    if (!input.content) throw new BadRequestException('Either content or canonicalHash is required');
    const payload = {
      documentName: input.documentName,
      documentType: input.documentType ?? null,
      documentId: input.documentId ?? null,
      content: input.content,
      signedBy: input.signedBy,
      organisationId: org.id,
      organisationSlug: org.slug,
    };
    return this.crypto.canonicalHash(payload);
  }

  // ──────────────────────────────────────────────
  // VERIFICATION — authority for cryptographic checks
  // ──────────────────────────────────────────────

  async verify(idOrHash: string, ctx?: { ip?: string; userAgent?: string; channel?: string }) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrHash);
    const record = await this.prisma.signature.findFirst({
      where: isUuid ? { id: idOrHash } : { canonicalHash: idOrHash },
      include: { organisation: { select: { name: true, slug: true } } },
    });

    const trackEvent = async (signatureId: string | null, outcome: string) => {
      await this.prisma.verificationEvent.create({
        data: {
          signatureId,
          identifier: idOrHash.slice(0, 120),
          outcome,
          ip: ctx?.ip,
          userAgent: ctx?.userAgent?.slice(0, 300),
          channel: ctx?.channel || 'PUBLIC',
        },
      });
    };

    if (!record) {
      await trackEvent(null, 'NOT_FOUND');
      return { valid: false, status: 'NOT_FOUND', reason: 'NOT_FOUND', message: 'No signature record matches the supplied identifier.' };
    }

    // Verification always uses the public key pinned on the record — rotation
    // and revocation of keys never invalidate historical signatures.
    const cryptoOk = this.crypto.verify(record.publicKey, record.canonicalHash, record.signature);
    const docStatus = record.status;
    const valid = cryptoOk && docStatus === 'ACTIVE';

    const key = record.keyId
      ? await this.prisma.signingKey.findUnique({ where: { id: record.keyId } })
      : null;

    await trackEvent(record.id, valid ? 'VALID' : cryptoOk ? docStatus : 'SIGNATURE_MISMATCH');
    await this.prisma.auditLog.create({
      data: {
        organisationId: record.organisationId,
        signatureId: record.id,
        action: 'SIGNATURE_VERIFIED',
        detail: valid ? 'VALID' : cryptoOk ? String(docStatus) : 'SIGNATURE_MISMATCH',
        ip: ctx?.ip,
      },
    });

    return {
      valid,
      status: docStatus,
      reason: cryptoOk ? undefined : 'SIGNATURE_MISMATCH',
      keyStatus: key?.status ?? 'UNKNOWN',
      signature: {
        id: record.id,
        documentName: record.documentName,
        documentType: record.documentType,
        documentId: record.documentId,
        canonicalHash: record.canonicalHash,
        algorithm: record.algorithm,
        signerRole: record.signerRole,
        signedBy: record.signedBy,
        signedAt: record.createdAt,
      },
      organisation: {
        name: record.organisation.name,
        slug: record.organisation.slug,
      },
    };
  }

  // ──────────────────────────────────────────────
  // LIFECYCLE — revoke / supersede / list / audit
  // ──────────────────────────────────────────────

  async revoke(orgId: string, id: string, reason: string, actor?: string) {
    const record = await this.prisma.signature.findFirst({ where: { id, organisationId: orgId } });
    if (!record) throw new NotFoundException('Signature not found in your organisation');
    if (record.status !== 'ACTIVE') throw new BadRequestException(`Cannot revoke a ${record.status.toLowerCase()} signature`);
    const updated = await this.prisma.signature.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedReason: reason || 'Revoked by organisation' },
    });
    await this.audit(orgId, id, 'SIGNATURE_REVOKED', reason, undefined, actor);
    return { id: updated.id, status: updated.status, revokedAt: updated.revokedAt };
  }

  async supersede(orgId: string, id: string, replacementId: string, actor?: string) {
    const [record, replacement] = await Promise.all([
      this.prisma.signature.findFirst({ where: { id, organisationId: orgId } }),
      this.prisma.signature.findFirst({ where: { id: replacementId, organisationId: orgId } }),
    ]);
    if (!record || !replacement) throw new NotFoundException('Both signatures must exist within your organisation');
    if (record.id === replacement.id) throw new BadRequestException('A signature cannot supersede itself');
    const updated = await this.prisma.signature.update({
      where: { id: record.id },
      data: { status: 'SUPERSEDED', supersededById: replacement.id },
    });
    await this.audit(orgId, id, 'SIGNATURE_SUPERSEDED', `by:${replacement.id}`, undefined, actor);
    return { id: updated.id, status: updated.status, supersededById: replacement.id };
  }

  async list(orgId: string, status?: string) {
    return this.prisma.signature.findMany({
      where: { organisationId: orgId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, documentName: true, documentType: true, documentId: true,
        signerRole: true, canonicalHash: true, keyId: true,
        status: true, signedBy: true, createdAt: true, revokedAt: true, revokedReason: true,
      },
    });
  }

  auditTrail(orgId: string, signatureId: string) {
    return this.prisma.auditLog.findMany({
      where: { signatureId, organisationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
  }

  verificationEvents(orgId: string, signatureId: string) {
    void orgId; // ownership enforced by caller route
    return this.prisma.verificationEvent.findMany({
      where: { signatureId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async audit(
    orgId: string | null,
    signatureId: string | null,
    action: string,
    detail?: string,
    correlationId?: string,
    actor?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organisationId: orgId,
        signatureId,
        action,
        detail,
        actor,
        correlationId,
      },
    });
  }
}
