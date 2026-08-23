import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface SerialFormatPolicy {
  prefix?: string; // institution prefix e.g. "STS"
  documentType: string; // e.g. TRANSCRIPT (used in scope + default pattern)
  yearSource?: 'calendar' | 'academic';
  academicYear?: string; // when yearSource = academic
  pattern?: string; // tokens: {PREFIX} {TYPE} {YEAR} {SEQ}; default "{PREFIX}-{YEAR}-{SEQ}"
  padding?: number; // sequence zero-padding, default 6
}

export interface AllocatedSerial {
  serialNumber: string;
  sequence: number;
  scopeKey: string;
  formatPattern: string;
  year: number | null;
}

interface SequenceRow {
  nextValue: number;
  prefix: string;
}

/**
 * Unique, concurrency-safe document serial numbers.
 *
 * Allocation is a single atomic SQL statement:
 *   INSERT .. ON CONFLICT DO UPDATE SET "nextValue" = "SerialSequence"."nextValue" + 1
 *   RETURNING "nextValue"
 * Two concurrent transactions always receive distinct values — the database
 * guarantees it, never the application or frontend. A unique constraint on
 * DocumentSerial.serialNumber is the final safety net.
 */
@Injectable()
export class SerialNumberService {
  private readonly logger = new Logger(SerialNumberService.name);

  constructor(private prisma: PrismaService) {}

  private resolveYear(policy: SerialFormatPolicy): number | null {
    if ((policy.yearSource || 'calendar') === 'academic' && policy.academicYear) {
      const parsed = parseInt(policy.academicYear.slice(0, 4), 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return new Date().getUTCFullYear();
  }

  private buildScopeKey(schoolId: string, policy: SerialFormatPolicy, year: number | null): string {
    const typePart = (policy.documentType || 'DOCUMENT').toUpperCase();
    const yearPart = policy.yearSource === 'academic' && policy.academicYear
      ? policy.academicYear.replace(/\s+/g, '-').toUpperCase()
      : year ?? 'NONE';
    return `${typePart}:${yearPart}`;
  }

  private formatSerial(
    policy: SerialFormatPatternInput,
    sequence: number,
    year: number | null,
  ): string {
    const pattern = policy.pattern || '{PREFIX}-{TYPE}-{YEAR}-{SEQ}';
    const padded = String(sequence).padStart(policy.padding ?? 6, '0');
    return pattern
      .replace('{PREFIX}', (policy.prefix || 'STS').toUpperCase())
      .replace('{TYPE}', (policy.documentType || 'DOC').toUpperCase())
      .replace('{YEAR}', year != null ? String(year) : '')
      .replace('{SEQ}', padded)
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .toUpperCase();
  }

  /**
   * Atomically allocate the next sequence value for (schoolId, scopeKey).
   */
  async allocate(
    schoolId: string,
    policy: SerialFormatPolicy,
    tx?: Prisma.TransactionClient,
  ): Promise<AllocatedSerial> {
    const client = tx || this.prisma;
    const year = this.resolveYear(policy);
    const scopeKey = this.buildScopeKey(schoolId, policy, year);
    const prefix = (policy.prefix || 'STS').toUpperCase();
    const patternStr = policy.pattern || '{PREFIX}-{TYPE}-{YEAR}-{SEQ}';

    const rows = await client.$queryRaw<SequenceRow[]>(Prisma.sql`
      INSERT INTO "SerialSequence" ("id", "schoolId", "scopeKey", "prefix", "nextValue", "updatedAt")
      VALUES (${randomUUID()}, ${schoolId}, ${scopeKey}, ${prefix}, 2, NOW())
      ON CONFLICT ("schoolId", "scopeKey")
      DO UPDATE SET "nextValue" = "SerialSequence"."nextValue" + 1, "prefix" = ${prefix}
      RETURNING "nextValue"
    `);

    const row = rows?.[0];
    if (!row || typeof row.nextValue !== 'number') {
      throw new InternalServerErrorException('Failed to allocate serial number');
    }

    // The returned nextValue is the value AFTER increment for existing rows
    // (initial insert seeds 2 because value 1 is consumed by this allocation).
    const allocatedSequence = row.nextValue - 1;

    const serialNumber = this.formatSerial(
      { ...policy, pattern: patternStr },
      allocatedSequence,
      year,
    );

    return {
      serialNumber,
      sequence: allocatedSequence,
      scopeKey,
      formatPattern: patternStr,
      year,
    };
  }

  /**
   * Allocate + persist a DocumentSerial row. Retries on the (astronomically
   * unlikely) unique collision caused by concurrent custom-format changes.
   */
  async issue(
    schoolId: string,
    policy: SerialFormatPolicy,
    data: { documentRef?: string; issuedById?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<DocumentSerialRecord> {
    const maxAttempts = 5;
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const allocated = await this.allocate(schoolId, policy, tx);
        const record = await (tx || this.prisma).documentSerial.create({
          data: {
            schoolId,
            serialNumber: allocated.serialNumber,
            documentType: policy.documentType.toUpperCase(),
            documentRef: data.documentRef,
            sequence: allocated.sequence,
            year: allocated.year,
            formatPattern: allocated.formatPattern,
            issuedById: data.issuedById,
          },
        });
        return record;
      } catch (err: any) {
        // Unique-constraint violation (duck-typed by code — resilient across
        // Prisma client versions and driver adapters).
        if (err?.code === 'P2002') {
          lastError = err;
          continue; // collision → retry with a fresh allocation
        }
        throw err;
      }
    }
    this.logger.error(`Serial allocation failed after ${maxAttempts} attempts: ${lastError?.message}`);
    throw new InternalServerErrorException('Unable to allocate unique serial number');
  }
}

export interface DocumentSerialRecord {
  id: string;
  schoolId: string;
  serialNumber: string;
  documentType: string;
  documentRef?: string | null;
  sequence: number;
  year: number | null;
  issuedAt: Date;
}

type SerialFormatPatternInput = SerialFormatPolicy;
