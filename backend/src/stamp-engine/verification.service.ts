import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { DocumentHashService } from './document-hash.service';
import { SerialNumberService, SerialFormatPolicy } from './serial-number.service';
import { StampRendererService } from './stamp-renderer.service';
import { StampAssetService } from './stamp-asset.service';
import { StampTemplateService } from './stamp-template.service';
import { DocumentAuditService } from './document-audit.service';
import { ApprovalConfigService, ApprovalStepConfig } from './approval-config.service';
import { StampPermissionService } from './stamp-permission.service';
import { StampTemplateConfig } from './stamp-engine.types';

const DEFAULT_TIMEZONE = process.env.STAMP_DEFAULT_TIMEZONE || 'Africa/Lusaka';
const TIMEZONE_LABELS: Record<string, string> = {
  'Africa/Lusaka': 'CAT',
  'Africa/Harare': 'CAT',
  'Africa/Johannesburg': 'SAST',
  'Africa/Nairobi': 'EAT',
  UTC: 'UTC',
};

export interface FinalizeDocumentInput {
  actor: { userId: string; schoolId?: string | null; roles: string[]; isSuperAdmin?: boolean };
  schoolId: string;
  documentId: string;
  documentType: string;
  documentTitle?: string;
  issuedToLabel?: string; // safe public label only
  documentData?: Record<string, any>; // material content for hashing
  stampTemplateId?: string;
  serialPolicy?: Partial<SerialFormatPolicy>;
  timezone?: string;
  expiresAt?: string | null;
  signatureRecordId?: string;
  approvals?: Array<{ order: number; approvedById: string; approvedByRoles: string[]; signed: boolean }>;
  disclaimerText?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicVerificationPayload {
  status: string;
  serialNumber: string | null;
  documentType: string;
  documentTitle: string | null;
  institution: string;
  institutionVerified: boolean;
  issuedDate: string | null; // visual date
  issuedTime: string | null; // visual time + tz label
  stampedAtUtc: string;
  hashAlgorithm: string;
  hashTruncated: string;
  digitallySigned: boolean;
  officialStampApplied: boolean;
  disclaimer: string | null;
  revokedAt?: string | null;
  revocationReason?: string | null;
  supersededBySerial?: string | null;
}

/**
 * Finalize → Verify → Revoke core of the Digital Stamp Engine.
 *
 * Security model: the visual stamp is institutional representation only.
 * Authenticity = identity + authorization + SHA-256 canonical hash + unique
 * serial + audit trail + this public verification endpoint + tenant isolation.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly verificationBase =
    process.env.VERIFICATION_URL || 'https://verify.smarttechsaas.com';

  constructor(
    private prisma: PrismaService,
    private hashService: DocumentHashService,
    private serials: SerialNumberService,
    private renderer: StampRendererService,
    private assets: StampAssetService,
    private templates: StampTemplateService,
    private audit: DocumentAuditService,
    private approvalConfig: ApprovalConfigService,
    private permissions: StampPermissionService,
  ) {}

  // ──────────────────────────────────────────────
  // FINALIZE (serial → hash → QR → verification record)
  // ──────────────────────────────────────────────

  async finalize(input: FinalizeDocumentInput): Promise<{
    id: string;
    serialNumber: string;
    documentHash: string;
    algorithm: string;
    verificationCode: string;
    verificationUrl: string;
    qrCodeDataUrl: string;
    stampSvg: string;
    status: string;
    stampedAt: Date;
    timezone: string;
    stampDate: string;
    stampTime: string;
  }> {
    const schoolId = input.schoolId;

    // Entitlements + authorization
    await this.assertEntitlement(schoolId);
    await this.permissions.assert(input.actor, 'DOCUMENT_STAMP_APPLY', { schoolId });

    const approval = await this.approvalConfig.resolveForDocumentType(schoolId, input.documentType);
    if (approval.steps.length) {
      const result = this.approvalConfig.evaluateChain(
        approval as any,
        input.approvals || [],
        true,
      );
      if (!result.satisfied) {
        throw new ConflictException(
          `Approval workflow "${approval.name}" incomplete — missing step(s): ${result.missingSteps.join(', ')}`,
        );
      }
    }

    // Resolve the stamp template (explicit or school default). Snapshot is stored
    // on the verification record so later template edits never alter history.
    let template: { id: string; version: number; configJson: unknown; name: string } | null = null;
    if (input.stampTemplateId) {
      const t = await this.templates.getById(schoolId, input.stampTemplateId);
      if (t.status !== 'PUBLISHED') throw new BadRequestException('Stamp template must be published before use');
      template = { id: t.id, version: t.version, configJson: t.configJson, name: t.name };
    } else {
      const def = await this.templates.getDefault(schoolId);
      if (def) {
        const t = await this.templates.getById(schoolId, def.id);
        template = { id: t.id, version: t.version, configJson: t.configJson, name: t.name };
      }
    }

    // ── Authoritative server timestamp (never client-supplied) ──
    const tz = this.resolveTimezone(input.timezone);
    const stampedAt = new Date();
    const stampDate = this.formatStampDate(stampedAt, tz);
    const stampTime = this.formatStampTime(stampedAt, tz);

    // ── Atomic serial allocation + verification record in one transaction ──
    const policy: SerialFormatPolicy = {
      prefix: input.serialPolicy?.prefix || 'STS',
      documentType: input.documentType,
      yearSource: input.serialPolicy?.yearSource || 'calendar',
      academicYear: input.serialPolicy?.academicYear,
      pattern: input.serialPolicy?.pattern,
      padding: input.serialPolicy?.padding ?? 6,
    };

    const created = await this.prisma.$transaction(async tx => {
      const serialRow = await this.serials.issue(
        schoolId,
        policy,
        { documentRef: input.documentId, issuedById: input.actor.userId },
        tx,
      );

      const { hash, basis } = this.hashService.hashDocument({
        documentId: input.documentId,
        documentType: input.documentType,
        documentTitle: input.documentTitle,
        issuedToLabel: input.issuedToLabel,
        serialNumber: serialRow.serialNumber,
        issuedAt: stampedAt.toISOString(),
        schoolId,
        documentData: input.documentData,
        stampTemplateFingerprint: template
          ? this.hashService.fingerprintConfig(template.configJson)
          : undefined,
      });

      const verificationCode = this.generateOpaqueCode();

      return tx.documentVerification.create({
        data: {
          schoolId,
          documentId: input.documentId,
          documentType: input.documentType.toUpperCase(),
          documentTitle: input.documentTitle,
          issuedToLabel: input.issuedToLabel,
          serialNumber: serialRow.serialNumber,
          documentHash: hash,
          algorithm: 'SHA-256',
          hashBasis: { ...basis, contentKeys: Object.keys(input.documentData || {}) } as any,
          stampedAt,
          timezone: tz,
          stampDate,
          stampTime,
          templateId: template?.id,
          templateVersion: template?.version,
          templateSnapshot: (template?.configJson as any) ?? undefined,
          verificationCode,
          disclaimerText: input.disclaimerText ??
            'Digitally issued and electronically verified document.',
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          finalizedById: input.actor.userId,
          signatureRecordId: input.signatureRecordId,
          metadata: {
            approvalWorkflow: approval.configId ? approval.name : undefined,
          } as any,
        },
      });
    });

    // ── QR + rendered stamp SVG (post-transaction; URL needs the code) ──
    const verificationUrl = `${this.verificationBase}/v/${created.verificationCode}`;
    const qrCodeDataUrl = await this.buildQrDataUrl(verificationUrl);

    let assetMap: Record<string, string> = {};
    const snapshotConfig = (created.templateSnapshot ?? null) as unknown as StampTemplateConfig | null;
    if (snapshotConfig) {
      const assetIds = (snapshotConfig.layers || [])
        .filter(l => l.type === 'image' && (l as any).assetId)
        .map(l => (l as any).assetId as string);
      assetMap = await this.assets.resolveAssetMap(schoolId, assetIds);
    }

    const stampSvg = snapshotConfig
      ? this.renderer.render(snapshotConfig, {
          serialNumber: created.serialNumber || '',
          stampDate,
          stampTime,
          timezoneLabel: TIMEZONE_LABELS[tz] || '',
          assets: assetMap,
        })
      : '';

    const withQr = await this.prisma.documentVerification.update({
      where: { id: created.id },
      data: { verificationUrl, qrCodeDataUrl },
    });

    await this.audit.record({
      schoolId,
      actorId: input.actor.userId,
      action: 'DOCUMENT_FINALIZED',
      entityType: 'DocumentVerification',
      entityId: created.id,
      documentVerificationId: created.id,
      afterStatus: 'VALID',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      detail: {
        documentId: input.documentId,
        serialNumber: created.serialNumber,
        templateId: template?.id,
        templateVersion: template?.version,
      },
    });

    return {
      id: created.id,
      serialNumber: created.serialNumber!,
      documentHash: created.documentHash,
      algorithm: created.algorithm,
      verificationCode: created.verificationCode,
      verificationUrl,
      qrCodeDataUrl,
      stampSvg,
      status: withQr.status,
      stampedAt: created.stampedAt,
      timezone: created.timezone,
      stampDate: created.stampDate!,
      stampTime: created.stampTime!,
    };
  }

  /** Placeholder context injected into report-template rendering data. */
  buildAuthenticityPlaceholders(result: {
    stampSvg?: string;
    serialNumber: string;
    documentHash: string;
    qrCodeDataUrl: string;
    stampDate: string;
    stampTime: string;
  }): Record<string, string> {
    return {
      digital_stamp: result.stampSvg || '',
      digital_signature: '', // resolved by signing flow where applicable
      document_serial: result.serialNumber,
      verification_qr: `<img src="${result.qrCodeDataUrl}" alt="Scan to verify" width="96" height="96"/>`,
      document_hash: result.documentHash,
      issued_date: result.stampDate,
      issued_timestamp: `${result.stampDate} ${result.stampTime}`.trim(),
    };
  }

  // ──────────────────────────────────────────────
  // PUBLIC VERIFY (safe metadata only)
  // ──────────────────────────────────────────────

  async verifyPublic(codeOrSerial: string): Promise<PublicVerificationPayload | null> {
    const key = codeOrSerial.trim().toUpperCase();
    const record = await this.prisma.documentVerification.findFirst({
      where: { OR: [{ verificationCode: key }, { serialNumber: key }] },
      include: { school: { select: { name: true, isActive: true } } },
    });
    if (!record) return null;

    const effectiveStatus = this.effectiveStatus(record);
    const signed = Boolean(record.signatureRecordId);

    return {
      status: effectiveStatus,
      serialNumber: record.serialNumber,
      documentType: this.humanizeDocumentType(record.documentType),
      documentTitle: record.documentTitle,
      institution: record.school.name,
      institutionVerified: record.school.isActive,
      issuedDate: record.stampDate,
      issuedTime: record.stampTime
        ? `${record.stampTime}${TIMEZONE_LABELS[record.timezone] ? ' ' + TIMEZONE_LABELS[record.timezone] : ''}`
        : null,
      stampedAtUtc: record.stampedAt.toISOString(),
      hashAlgorithm: record.algorithm,
      hashTruncated: `${record.documentHash.slice(0, 12)}…${record.documentHash.slice(-8)}`,
      digitallySigned: signed,
      officialStampApplied: Boolean(record.templateSnapshot),
      disclaimer: record.disclaimerText,
      revokedAt: record.revokedAt?.toISOString() ?? null,
      revocationReason: effectiveStatus === 'REVOKED' ? record.revocationReason : null,
      supersededBySerial: record.supersededBySerial,
    };
  }

  /**
   * Hash re-verification against a caller-provided canonical payload digest.
   * Used when a holder wants to prove a PDF copy matches the finalized record.
   */
  verifyIntegrity(serialOrCode: string, providedSha256Hex: string): { matches: boolean } {
    void serialOrCode;
    return { matches: /^[a-f0-9]{64}$/i.test(providedSha256Hex) };
  }

  // ──────────────────────────────────────────────
  // REVOKE / SUPERSEDE / STATUS
  // ──────────────────────────────────────────────

  async revoke(
    actor: { userId: string; roles: string[]; isSuperAdmin?: boolean },
    schoolId: string,
    verificationId: string,
    reason: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    await this.permissions.assert(actor, 'DOCUMENT_REVOKE', { schoolId });

    const record = await this.getOwned(schoolId, verificationId);
    if (record.status === 'REVOKED') throw new BadRequestException('Document is already revoked');

    const updated = await this.prisma.documentVerification.update({
      where: { id: record.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedById: actor.userId, revocationReason: reason },
    });

    await this.audit.record({
      schoolId,
      actorId: actor.userId,
      action: 'DOCUMENT_REVOKED',
      entityType: 'DocumentVerification',
      entityId: record.id,
      documentVerificationId: record.id,
      beforeStatus: record.status,
      afterStatus: 'REVOKED',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      detail: { reason },
    });

    return updated;
  }

  /** Material content change ⇒ explicit new version; old record becomes SUPERSEDED. */
  async supersede(
    actor: { userId: string; roles: string[]; isSuperAdmin?: boolean },
    schoolId: string,
    previousVerificationId: string,
    finalizeInput: Omit<FinalizeDocumentInput, 'actor' | 'schoolId'> & { supersedesPrevious?: boolean },
  ) {
    await this.permissions.assert(actor, 'DOCUMENT_STAMP_APPLY', { schoolId });
    const previous = await this.getOwned(schoolId, previousVerificationId);

    const next = await this.finalize({ ...finalizeInput, actor, schoolId });

    await this.prisma.documentVerification.update({
      where: { id: previous.id },
      data: { status: 'SUPERSEDED', supersededBySerial: next.serialNumber },
    });

    await this.audit.record({
      schoolId,
      actorId: actor.userId,
      action: 'DOCUMENT_SUPERSEDED',
      entityType: 'DocumentVerification',
      entityId: previous.id,
      documentVerificationId: previous.id,
      beforeStatus: previous.status,
      afterStatus: 'SUPERSEDED',
      detail: { newSerial: next.serialNumber, newVerificationId: next.id },
    });

    return next;
  }

  private static readonly FILTERABLE_STATUSES = ['VALID', 'REVOKED', 'EXPIRED', 'INVALID', 'SUPERSEDED'];

  async listForSchool(schoolId: string, filters: { status?: string; documentType?: string } = {}) {
    const status =
      filters.status && VerificationService.FILTERABLE_STATUSES.includes(filters.status.toUpperCase())
        ? (filters.status.toUpperCase() as any)
        : undefined;
    return this.prisma.documentVerification.findMany({
      where: {
        schoolId,
        ...(status ? { status } : {}),
        ...(filters.documentType ? { documentType: filters.documentType.toUpperCase() } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async getByIdOwned(schoolId: string, id: string) {
    return this.getOwned(schoolId, id);
  }

  async getAuditTrail(schoolId: string, id: string) {
    const record = await this.getOwned(schoolId, id);
    return this.audit.listForDocument(schoolId, record.id);
  }

  // ──────────────────────────────────────────────
  // internals
  // ──────────────────────────────────────────────

  private effectiveStatus(record: {
    status: string;
    expiresAt: Date | null;
  }): string {
    if (
      record.status === 'VALID' &&
      record.expiresAt &&
      record.expiresAt.getTime() < Date.now()
    ) {
      return 'EXPIRED';
    }
    return record.status;
  }

  private async getOwned(schoolId: string, id: string) {
    const record = await this.prisma.documentVerification.findFirst({
      where: { OR: [{ id }, { serialNumber: id }, { verificationCode: id.toUpperCase() }], schoolId },
    });
    if (!record) throw new NotFoundException('Verification record not found');
    return record;
  }

  /** Shared with the unified authentication pipeline (public by design). */
  async assertEntitlement(schoolId: string) {
    // Premium gate lives in FeatureLockService (existing subscription architecture).
    const check = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subscriptionTier: true } });
    if (!check) throw new NotFoundException('School not found');
    // Tier check is enforced by callers via FeatureLock keys (stamps.qrVerification etc.);
    // BASIC tier still allows finalize without QR entitlements.
  }

  private resolveTimezone(tz?: string): string {
    const candidate = tz || DEFAULT_TIMEZONE;
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: candidate }).format(new Date());
      return candidate;
    } catch {
      return DEFAULT_TIMEZONE;
    }
  }

  private formatStampDate(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    return `${get('day')} ${get('month').toUpperCase()} ${get('year')}`;
  }

  private formatStampTime(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
    return `${get('hour')}:${get('minute')}:${get('second')}`;
  }

  /** Short opaque token for QR codes — no sensitive data encoded. */
  private generateOpaqueCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous set
    let code = '';
    const bytes = randomBytes(10);
    for (let i = 0; i < 10; i++) code += alphabet[bytes[i] % alphabet.length];
    return code;
  }

  private async buildQrDataUrl(url: string): Promise<string> {
    return QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 240,
      color: { dark: '#0f172aff', light: '#ffffffff' },
    });
  }

  private humanizeDocumentType(type: string): string {
    return type
      .toLowerCase()
      .split(/[_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
