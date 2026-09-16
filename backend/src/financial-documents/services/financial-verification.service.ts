import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { FinancialDocumentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QrService } from '../../qr-service/qr.service';
import { VERIFICATION_URL_BASE } from '../constants';

export interface VerificationFields {
  documentType: FinancialDocumentType;
  documentId: string;
  documentNumber: string;
  totalAmount: number;
  currency: string;
  customerName?: string;
  issuedAt?: string;
}

export interface VerificationResult {
  verificationCode: string;
  documentHash: string;
  verificationUrl: string;
  verificationQr: string;
}

/**
 * Company-level verification for financial documents.
 *
 * Reuses the same canonical-hashing approach as the School stamp engine
 * (document-hash.service) but is intentionally NOT bound to a School: financial
 * documents belong to the SuperAdmin company, not to a school tenant.
 */
@Injectable()
export class FinancialVerificationService {
  static readonly ALGORITHM = 'SHA-256';

  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: QrService,
  ) {}

  private canonicalize(value: any): any {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) return value.map(v => this.canonicalize(v)).filter((v: any) => v !== undefined);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const key of Object.keys(value).sort()) {
        const canon = this.canonicalize(value[key]);
        if (canon !== undefined && canon !== '' && canon !== null) out[key] = canon;
      }
      return Object.keys(out).length ? out : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return undefined;
      return Number.isInteger(value) ? value : Number(value.toFixed(6));
    }
    return value;
  }

  canonicalJson(payload: Record<string, any>): string {
    const canon = this.canonicalize(payload);
    if (canon === undefined) return '{}';
    return JSON.stringify(canon);
  }

  sha256Hex(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  async generateVerification(fields: VerificationFields): Promise<VerificationResult> {
    const verificationCode = randomBytes(9).toString('hex').toUpperCase();
    const basis = {
      algorithm: FinancialVerificationService.ALGORITHM,
      version: 1,
      documentType: fields.documentType,
      documentNumber: fields.documentNumber,
      documentId: fields.documentId,
      totalAmount: fields.totalAmount,
      currency: fields.currency,
      customer: fields.customerName,
      issuedAt: fields.issuedAt || new Date().toISOString(),
    };
    const documentHash = this.sha256Hex(this.canonicalJson(basis));
    const verificationUrl = `${VERIFICATION_URL_BASE}/financial/${verificationCode}`;
    const verificationQr = await this.qr.generateSimpleQRCode(verificationUrl, 200);
    return { verificationCode, documentHash, verificationUrl, verificationQr };
  }

  /** Regenerate a QR image for an already-stored verification URL. */
  async qrForUrl(verificationUrl?: string | null): Promise<string | undefined> {
    if (!verificationUrl) return undefined;
    return this.qr.generateSimpleQRCode(verificationUrl, 200);
  }

  private async findRecord(code: string) {
    const candidates = await Promise.all([
      this.prisma.quotation.findFirst({ where: { verificationCode: code }, include: { customer: true } }),
      this.prisma.invoice.findFirst({ where: { verificationCode: code }, include: { customer: true } }),
      this.prisma.financialReceipt.findFirst({ where: { verificationCode: code }, include: { customer: true } }),
    ]);
    return candidates.find(Boolean) || null;
  }

  async verifyPublic(code: string): Promise<any> {
    const record = await this.findRecord(code);
    if (!record) {
      throw new NotFoundException('Verification code not found.');
    }
    const documentType: FinancialDocumentType =
      'quotationNumber' in record
        ? FinancialDocumentType.QUOTATION
        : 'invoiceNumber' in record
          ? FinancialDocumentType.INVOICE
          : FinancialDocumentType.PAYMENT_RECEIPT;

    const documentNumber =
      'quotationNumber' in record
        ? (record as any).quotationNumber
        : 'invoiceNumber' in record
          ? (record as any).invoiceNumber
          : (record as any).receiptNumber;
    const customerName = 'receiptNumber' in record ? (record as any).customer?.name : (record as any).customer?.name;
    const issueDate = 'quotationNumber' in record
      ? (record as any).quotationDate
      : 'invoiceNumber' in record
        ? (record as any).invoiceDate
        : (record as any).receiptDate;

    const basis = {
      algorithm: FinancialVerificationService.ALGORITHM,
      version: 1,
      documentType,
      documentNumber,
      documentId: record.id,
      totalAmount: (record as any).totalAmount ?? (record as any).amountReceived,
      currency: record.currency,
      customer: customerName,
      issuedAt: (issueDate ?? new Date()).toISOString(),
    };
    const recomputed = this.sha256Hex(this.canonicalJson(basis));
    const hashMatches = record.documentHash === recomputed;

    return {
      valid: hashMatches,
      document: {
        documentType,
        documentNumber,
        id: record.id,
        status: record.status,
        totalAmount: (record as any).totalAmount ?? (record as any).amountReceived,
        currency: record.currency,
        customerName,
        issuedAt: issueDate ?? null,
        verifiedAt: new Date().toISOString(),
      },
      message: hashMatches ? 'Document verified successfully.' : 'Document content does not match its recorded hash.',
    };
  }
}