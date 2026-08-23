import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Deterministic canonical hashing for finalized documents.
 *
 * The hash represents the *content* of a finalized document (not the PDF bytes,
 * which change with renderer versions). Canonicalization rules:
 *   - object keys sorted lexicographically (recursively)
 *   - arrays keep order
 *   - strings trimmed; null/undefined/empty dropped from objects
 *   - numbers normalized (no trailing zeros)
 *   - serialized as compact JSON, UTF-8, then SHA-256
 *
 * Same payload ⇒ same hash, on any server, forever.
 */
@Injectable()
export class DocumentHashService {
  static readonly ALGORITHM = 'SHA-256';

  canonicalize(value: any): any {
    if (value === null || value === undefined) return undefined;

    if (Array.isArray(value)) {
      return value.map(v => this.canonicalize(v)).filter(v => v !== undefined);
    }

    if (value instanceof Date) return value.toISOString();

    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const key of Object.keys(value).sort()) {
        const canon = this.canonicalize(value[key]);
        if (canon !== undefined && canon !== '' && canon !== null) {
          out[key] = canon;
        }
      }
      // Keep empty objects out of the canonical form entirely.
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

  /**
   * Build the canonical payload for a finalized document and compute its hash.
   * `documentData` must contain the material content of the document only —
   * never volatile fields such as render timestamps or storage URLs.
   */
  hashDocument(input: {
    documentType: string;
    documentId: string;
    serialNumber: string;
    issuedAt: string; // ISO stampedAt
    schoolId: string;
    documentTitle?: string;
    issuedToLabel?: string;
    documentData?: Record<string, any>;
    stampTemplateFingerprint?: string;
  }): { hash: string; algorithm: string; basis: Record<string, any> } {
    const basis = {
      algorithm: DocumentHashService.ALGORITHM,
      version: 1,
      documentId: input.documentId,
      documentType: input.documentType,
      documentTitle: input.documentTitle,
      issuedToLabel: input.issuedToLabel,
      serialNumber: input.serialNumber,
      issuedAt: input.issuedAt,
      schoolId: input.schoolId,
      stampTemplateFingerprint: input.stampTemplateFingerprint,
      content: input.documentData || {},
    };
    const hash = this.sha256Hex(this.canonicalJson(basis));
    return { hash, algorithm: DocumentHashService.ALGORITHM, basis };
  }

  /** Fingerprint of a stamp template config (for templateSnapshot provenance). */
  fingerprintConfig(config: unknown): string {
    return this.sha256Hex(
      typeof config === 'string' ? config : JSON.stringify(config),
    ).slice(0, 16);
  }
}
