import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface CanonicalDocumentPayload {
  documentId: string;
  documentVersion: number;
  organizationId: string; // schoolId for SaaS schools, org ref for external
  documentType: string;
  serialNumber: string;
  verificationCode: string;
  issuedAt: string; // ISO-8601 UTC — authoritative server time
  contentHash: string; // SHA-256 of the content-only payload (pre-stamp)
  stampInstanceId: string | null;
  signerIdentities: { signerId: string; signerRole?: string }[];
  signatureAssetId?: string | null;
  /**
   * Present only for multi-signatory documents (>1 bound signature asset).
   * Omitted for single-signature issues so already-issued documents keep the
   * exact same canonical payload and continue to verify.
   */
  signatureAssetIds?: string[];
  templateVersion: number | null;
}

/**
 * Cryptographic model (see docs/AUTHENTICATION_PLATFORM.md §Crypto):
 *
 * 1. originalHash  = SHA-256(canonical(content payload))          — integrity of substance
 * 2. finalHash     = SHA-256(canonical(CanonicalDocumentPayload)) — signed by Ed25519
 * 3. finalPdfHash  = SHA-256(pdf bytes)                           — stored reference only
 *
 * Visual artefacts (stamp SVG, signature image, QR) are bound in via their
 * identifiers/hashes inside the canonical payload, so any post-signing change
 * to visuals or metadata breaks verification.
 */
@Injectable()
export class CanonicalPayloadService {
  hashContent(input: {
    documentId: string;
    documentType: string;
    documentData: unknown;
    schoolId: string;
  }): string {
    return this.canonicalSha256({
      documentId: input.documentId,
      documentType: input.documentType,
      documentData: input.documentData ?? null,
      schoolId: input.schoolId,
    });
  }
  buildAndHash(payload: CanonicalDocumentPayload): { canonical: Record<string, unknown>; finalHash: string } {
    const multiSignature = Array.isArray(payload.signatureAssetIds) && payload.signatureAssetIds.length > 1;
    const canonical = {
      documentId: payload.documentId,
      documentVersion: payload.documentVersion,
      organizationId: payload.organizationId,
      documentType: payload.documentType,
      serialNumber: payload.serialNumber,
      verificationCode: payload.verificationCode,
      issuedAt: new Date(payload.issuedAt).toISOString(),
      contentHash: payload.contentHash,
      stampInstanceId: payload.stampInstanceId,
      signerIdentities: [...payload.signerIdentities].sort((a, b) =>
        `${a.signerId}|${a.signerRole ?? ''}`.localeCompare(`${b.signerId}|${b.signerRole ?? ''}`),
      ),
      signatureAssetId: payload.signatureAssetId ?? null,
      ...(multiSignature ? { signatureAssetIds: [...payload.signatureAssetIds!].sort() } : {}),
      templateVersion: payload.templateVersion,
    };
    return { canonical, finalHash: this.canonicalSha256(canonical) };
  }

  hashPdf(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  /** Deterministic deep-sorted-key JSON → SHA-256 hex. Same rule as Part B. */
  private canonicalSha256(value: unknown): string {
    return createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  /** Recursively sorts every object's keys; arrays keep order. */
  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
    if (Array.isArray(value)) {
      return `[${value.map(v => this.stableStringify(v)).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`).join(',')}}`;
  }
}
