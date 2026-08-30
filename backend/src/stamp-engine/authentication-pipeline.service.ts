import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationService } from './verification.service';
import { SignatureBridgeService } from './signature-bridge.service';
import { CanonicalPayloadService } from './canonical-payload.service';
import { StampPermissionService } from './stamp-permission.service';

export interface IssueDocumentInput {
  actor: { userId: string; schoolId?: string | null; roles: string[]; isSuperAdmin?: boolean };
  schoolId: string;
  documentId: string;
  documentType: string;
  documentTitle?: string;
  issuedToLabel?: string;
  documentData?: Record<string, any>;
  stampTemplateId?: string;
  requiresSignature: boolean;
  signatureId?: string;
  signers: Array<{ signerId: string; signerRole?: string; signerName?: string }>;
  organizationRef?: string;
  serialPolicy?: Record<string, unknown>;
  timezone?: string;
  expiresAt?: string | null;
  approvals?: Array<{ order: number; approvedById: string; approvedByRoles: string[]; signed: boolean }>;
  disclaimerText?: string;
}

export interface PreparedPlan {
  capabilities: { stamp: boolean; signature: boolean; verification: boolean };
  templateResolved: boolean;
  bridgeConfigured: boolean;
  notes: string[];
}

/**
 * Unified issuance pipeline:
 *   stamp -> StampInstance -> canonical payload hash -> Ed25519 (internal API)
 *   -> DocumentAuthentication VALID.
 * The signed payload embeds the stamp instance id/hash, so visuals cannot be
 * altered after signing without invalidating the signature.
 */
@Injectable()
export class AuthenticationPipelineService {
  private readonly logger = new Logger(AuthenticationPipelineService.name);

  constructor(
    private prisma: PrismaService,
    private verification: VerificationService,
    private bridge: SignatureBridgeService,
    private canonical: CanonicalPayloadService,
    private permissions: StampPermissionService,
  ) {}

  /** Marketplace integration: requirements declared by a report template config. */
  resolveCapabilities(templateConfigJson: unknown): { stamp: boolean; signature: boolean; verification: boolean } {
    const cfg = (templateConfigJson ?? {}) as Record<string, unknown>;
    const stamp = cfg.requiresStamp === true;
    const signature = cfg.requiresSignature === true;
    return { stamp, signature, verification: cfg.requiresVerification === true || stamp || signature };
  }

  async prepare(input: IssueDocumentInput): Promise<PreparedPlan> {
    await this.verification.assertEntitlement(input.schoolId);
    await this.permissions.assert(input.actor, 'DOCUMENT_STAMP_APPLY', { schoolId: input.schoolId });

    if (input.stampTemplateId) {
      const t = await this.prisma.stampTemplate.findFirst({ where: { id: input.stampTemplateId, schoolId: input.schoolId } });
      if (!t) throw new NotFoundException('Stamp template not found in your institution');
      if (t.status !== 'PUBLISHED') throw new ConflictException('Stamp template must be published before use');
    }
    const notes: string[] = [];
    if (!input.signers?.length && input.requiresSignature) {
      throw new BadRequestException('requiresSignature=true but no signers supplied');
    }
    if (input.signatureId) {
      const signature = await this.prisma.digitalSignature.findFirst({ where: { id: input.signatureId, schoolId: input.schoolId, status: 'ACTIVE' } });
      if (!signature) throw new NotFoundException('Selected signature not found in your institution');
    }
    if (!this.bridge.configured && input.requiresSignature) {
      notes.push('Signature service not configured — issue will proceed STAMP-ONLY.');
    }
    return {
      capabilities: { stamp: true, signature: input.requiresSignature && this.bridge.configured, verification: true },
      templateResolved: Boolean(input.stampTemplateId),
      bridgeConfigured: this.bridge.configured,
      notes,
    };
  }

  async issue(input: IssueDocumentInput) {
    await this.prepare(input);

    const correlationId = `auth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const trace: Array<{ step: string; at: string; detail?: string }> = [];
    const pushTrace = (step: string, detail?: string) => {
      trace.push({ step, at: new Date().toISOString(), detail });
      this.logger.log(`[${correlationId}] ${step}${detail ? ` — ${detail}` : ''}`);
    };

    const pending = await this.prisma.documentAuthentication.create({
      data: {
        schoolId: input.schoolId,
        organizationRef: input.organizationRef ?? input.schoolId,
        documentId: input.documentId,
        documentType: input.documentType.toUpperCase(),
        status: 'PENDING',
        signerId: input.signers[0]?.signerId ?? null,
        issuedBy: input.actor.userId,
        pipelineTrace: { correlationId, steps: [] } as any,
      },
    });
    pushTrace('PENDING_CREATED', pending.id);

    try {
      pushTrace('STAMP_FINALIZE_BEGIN');
      const finalized = await this.verification.finalize({
        actor: input.actor,
        schoolId: input.schoolId,
        documentId: input.documentId,
        documentType: input.documentType,
        documentTitle: input.documentTitle,
        issuedToLabel: input.issuedToLabel,
         documentData: input.documentData,
         signatureId: input.signatureId,
        stampTemplateId: input.stampTemplateId,
        serialPolicy: input.serialPolicy as any,
        timezone: input.timezone,
        expiresAt: input.expiresAt,
        approvals: input.approvals,
        disclaimerText: input.disclaimerText,
      });
      pushTrace('STAMP_FINALIZED', `serial=${finalized.serialNumber} code=${finalized.verificationCode}`);

      const verificationRecord = await this.prisma.documentVerification.findUniqueOrThrow({
        where: { id: finalized.id },
      });

      const stampInstance = await this.prisma.stampInstance.create({
        data: {
          schoolId: input.schoolId,
          documentVerificationId: finalized.id,
          templateId: verificationRecord.templateId,
          templateVersion: verificationRecord.templateVersion,
          configSnapshot: (verificationRecord.templateSnapshot ?? undefined) as any,
          serialNumber: finalized.serialNumber,
          verificationCode: finalized.verificationCode,
          renderedSvgHash: finalized.stampSvg
            ? this.canonical.hashPdf(Buffer.from(finalized.stampSvg, 'utf8'))
            : null,
          appliedById: input.actor.userId,
        },
      });
      pushTrace('STAMP_INSTANCE_CREATED', stampInstance.id);

      const originalHash = this.canonical.hashContent({
        documentId: input.documentId,
        documentType: input.documentType,
        documentData: input.documentData,
        schoolId: input.schoolId,
      });

      const { finalHash } = this.canonical.buildAndHash({
        documentId: input.documentId,
        documentVersion: 1,
        organizationId: input.organizationRef ?? input.schoolId,
        documentType: input.documentType.toUpperCase(),
        serialNumber: finalized.serialNumber,
        verificationCode: finalized.verificationCode,
        issuedAt: finalized.stampedAt.toISOString(),
        contentHash: originalHash,
        stampInstanceId: stampInstance.id,
         signerIdentities: (input.signers || []).map(s => ({ signerId: s.signerId, signerRole: s.signerRole })),
         signatureAssetId: input.signatureId ?? null,
        templateVersion: verificationRecord.templateVersion ?? null,
      });
      pushTrace('CANONICAL_PAYLOAD_HASHED', finalHash.slice(0, 16));

      let signaturesJson: Array<Record<string, unknown>> = [];
      let primarySignatureId: string | null = null;
      let primaryKeyId: string | null = null;

      if (input.requiresSignature) {
        if (!this.bridge.configured) {
          throw new ConflictException('Digital signature required but Signature Service is not configured');
        }
        for (const signer of input.signers) {
          pushTrace('SIGNATURE_REQUEST', signer.signerRole || signer.signerId);
          const sig = await this.bridge.sign({
            organizationId: input.organizationRef ?? input.schoolId,
            documentId: input.documentId,
            documentName: input.documentTitle || input.documentId,
            documentType: input.documentType,
            canonicalHash: finalHash,
            signerId: signer.signerId,
            signerRole: signer.signerRole,
            metadata: { correlationId },
            correlationId,
          });
          signaturesJson.push({
            signatureId: sig.signatureId,
            keyId: sig.keyId,
            keyFingerprint: sig.keyFingerprint,
            signer: sig.signedBy,
            signerRole: signer.signerRole,
            algorithm: sig.algorithm,
            signedAt: sig.signedAt,
          });
          if (!primarySignatureId) {
            primarySignatureId = sig.signatureId;
            primaryKeyId = sig.keyId;
          }
        }
        pushTrace('SIGNATURES_COMPLETE', `${signaturesJson.length} signature(s)`);
      } else {
        pushTrace('SIGNATURES_SKIPPED');
      }

      const auth = await this.prisma.documentAuthentication.update({
        where: { id: pending.id },
        data: {
          documentVerificationId: finalized.id,
          stampInstanceId: stampInstance.id,
          documentSerial: finalized.serialNumber,
          verificationCode: finalized.verificationCode,
          originalHash,
          finalHash,
          signatureServiceId: primarySignatureId,
          signingKeyId: primaryKeyId,
          signaturesJson: signaturesJson.length ? (signaturesJson as any) : undefined,
          signerId: input.signers[0]?.signerId ?? null,
          issuedAt: finalized.stampedAt,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          status: 'VALID',
          pipelineTrace: { correlationId, steps: trace } as any,
        },
      });
      pushTrace('AUTHENTICATION_VALID');

      return {
        authenticationId: auth.id,
        status: auth.status,
        serialNumber: finalized.serialNumber,
        verificationCode: finalized.verificationCode,
        verificationUrl: finalized.verificationUrl,
        qrCodeDataUrl: finalized.qrCodeDataUrl,
        stampSvg: finalized.stampSvg,
        stampDate: finalized.stampDate,
        stampTime: finalized.stampTime,
        originalHash,
        finalHash,
        signatures: signaturesJson,
        correlationId,
      };
    } catch (err: any) {
      const reason = err?.message || 'Unknown pipeline failure';
      pushTrace('PIPELINE_FAILED', reason);
      await this.prisma.documentAuthentication.update({
        where: { id: pending.id },
        data: { status: 'FAILED', revocationReason: reason.slice(0, 500), pipelineTrace: { correlationId, steps: trace } as any },
      }).catch(() => undefined);
      throw err;
    }
  }

  // ── Lifecycle: read / revoke / supersede ──

  async get(schoolId: string | null, authenticationIdOrSerial: string) {
    const rec = await this.findScoped(schoolId, authenticationIdOrSerial);
    if (!rec) throw new NotFoundException('Authentication record not found');
    return this.toSafeView(rec);
  }

  async list(schoolId: string, params?: { status?: string }) {
    const rows = await this.prisma.documentAuthentication.findMany({
      where: { schoolId, ...(params?.status ? { status: params.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(r => this.toSafeView(r));
  }

  async revoke(schoolId: string | null, actorUserId: string, idOrSerial: string, reason: string) {
    const rec = await this.findScoped(schoolId, idOrSerial);
    if (!rec) throw new NotFoundException('Authentication record not found');
    if (rec.status !== 'VALID' && rec.status !== 'EXPIRED') {
      throw new ConflictException(`Cannot revoke a ${rec.status.toLowerCase()} record`);
    }
    const now = new Date();
    const updated = await this.prisma.documentAuthentication.update({
      where: { id: rec.id },
      data: { status: 'REVOKED', revokedAt: now, revocationReason: reason },
    });
    if (rec.documentVerificationId) {
      await this.prisma.documentVerification.updateMany({
        where: { id: rec.documentVerificationId, status: 'VALID' },
        data: { status: 'REVOKED', revokedAt: now, revokedById: actorUserId, revocationReason: reason },
      });
    }
    await this.auditLifecycle(rec, actorUserId, 'DOCUMENT_AUTH_REVOKED', reason);
    return { id: updated.id, status: updated.status, revokedAt: updated.revokedAt };
  }

  async supersede(schoolId: string | null, actorUserId: string, oldIdOrSerial: string, newAuthenticationId: string) {
    const rec = await this.findScoped(schoolId, oldIdOrSerial);
    if (!rec) throw new NotFoundException('Authentication record not found');
    if (rec.status !== 'VALID') throw new ConflictException(`Cannot supersede a ${rec.status.toLowerCase()} record`);
    const updated = await this.prisma.documentAuthentication.update({
      where: { id: rec.id },
      data: { status: 'SUPERSEDED', supersededById: newAuthenticationId },
    });
    if (rec.documentVerificationId) {
      await this.prisma.documentVerification.updateMany({
        where: { id: rec.documentVerificationId, status: 'VALID' },
        data: { status: 'SUPERSEDED' },
      });
    }
    await this.auditLifecycle(rec, actorUserId, 'DOCUMENT_AUTH_SUPERSEDED', `by:${newAuthenticationId}`);
    return { id: updated.id, status: updated.status, supersededById: newAuthenticationId };
  }

  /**
   * Called by the public verification portal on every lookup.
   * Appends an AuthVerificationEvent and bumps counters. Never throws —
   * analytics must not break verification.
   */
  async trackPublicVerification(codeOrSerial: string, outcome: string, ip?: string, userAgent?: string) {
    try {
      const key = codeOrSerial.trim().toUpperCase();
      const rec = await this.prisma.documentAuthentication.findFirst({
        where: { OR: [{ verificationCode: key }, { documentSerial: key }] },
        select: { id: true },
      });
      await this.prisma.authVerificationEvent.create({
        data: { authenticationId: rec?.id ?? null, code: key.slice(0, 40), outcome, ip, userAgent: userAgent?.slice(0, 300) },
      });
      if (rec) {
        await this.prisma.documentAuthentication.update({
          where: { id: rec.id },
          data: { verificationCount: { increment: 1 }, lastVerifiedAt: new Date() },
        });
      }
    } catch (err: any) {
      this.logger.warn(`trackPublicVerification failed: ${err?.message}`);
    }
  }

  async auditTrail(schoolId: string | null, idOrSerial: string) {
    const rec = await this.findScoped(schoolId, idOrSerial);
    if (!rec) throw new NotFoundException('Authentication record not found');
    return (rec.pipelineTrace as any)?.steps ?? [];
  }

  private async findScoped(schoolId: string | null, idOrSerial: string) {
    return this.prisma.documentAuthentication.findFirst({
      where: {
        OR: [{ id: idOrSerial }, { documentSerial: idOrSerial.toUpperCase() }, { verificationCode: idOrSerial.toUpperCase() }],
        ...(schoolId ? { schoolId } : {}),
      },
    });
  }

  private toSafeView(rec: any) {
    return {
      id: rec.id,
      documentId: rec.documentId,
      documentType: rec.documentType,
      documentVersion: rec.documentVersion,
      documentSerial: rec.documentSerial,
      verificationCode: rec.verificationCode,
      status: rec.status,
      originalHash: rec.originalHash,
      finalHash: rec.finalHash,
      signatureCount: Array.isArray(rec.signaturesJson) ? rec.signaturesJson.length : rec.signaturesJson ? 1 : 0,
      signatureServiceId: rec.signatureServiceId,
      signingKeyId: rec.signingKeyId,
      issuedAt: rec.issuedAt,
      expiresAt: rec.expiresAt,
      revokedAt: rec.revokedAt,
      revocationReason: rec.status === 'REVOKED' ? rec.revocationReason : null,
      supersededById: rec.supersededById,
      verificationCount: rec.verificationCount,
      lastVerifiedAt: rec.lastVerifiedAt,
    };
  }

  private async auditLifecycle(rec: any, actorUserId: string, action: string, detail: string) {
    try {
      await this.prisma.documentAuditLog.create({
        data: {
          schoolId: rec.schoolId,
          actorId: actorUserId,
          action,
          entityType: 'DocumentAuthentication',
          entityId: rec.id,
          result: 'SUCCESS',
          detail: { detail, documentId: rec.documentId, serial: rec.documentSerial } as any,
        },
      });
    } catch {
      /* audit best-effort on lifecycle paths */
    }
  }
}
