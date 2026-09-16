import { BadRequestException, Injectable } from '@nestjs/common';
import { FinancialDocumentType, FinancialSequenceResetPolicy } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialSettingsService } from './financial-settings.service';
import { DEFAULT_DOCUMENT_PREFIXES } from '../constants';

class NumberingError extends BadRequestException {
  constructor(message?: string | object) {
    super(message ?? 'Invalid document numbering configuration.');
  }
}

export interface NextDocumentNumberResult {
  number: string;
  prefix: string;
  year: number;
  sequence: number;
  sequenceLength: number;
  separator: string;
}

@Injectable()
export class FinancialNumberingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: FinancialSettingsService,
  ) {}

  /**
   * Allocates the next document number atomically for the given type.
   *
   * - ANNUAL / MANUAL: a per-(type, prefix, year) counter row is upserted and
   *   incremented inside a serialized transaction. A new year naturally starts
   *   a fresh counter.
   * - NEVER: a single sentinel row (year = 0) keeps one continuous, forever
   *   monotonic counter per (type, prefix); the current calendar year is used
   *   in the rendered number.
   */
  async nextNumber(
    documentType: FinancialDocumentType,
    options?: { prefix?: string; pattern?: string; resetPolicy?: FinancialSequenceResetPolicy },
  ): Promise<NextDocumentNumberResult> {
    const prefix = (options?.prefix || DEFAULT_DOCUMENT_PREFIXES[documentType]).trim().toUpperCase();
    if (!/^[A-Z0-9]{1,8}$/.test(prefix)) {
      throw new NumberingError('Document prefix must be 1-8 uppercase letters/digits.');
    }

    const currentYear = new Date().getFullYear();
    const defaults = await this.settings.getNumberingDefaults();
    const existing = await this.prisma.financialDocumentSequence.findFirst({
      where: { documentType, prefix, year: { in: [0, currentYear] } },
      orderBy: { updatedAt: 'desc' },
    });
    const resetPolicy = options?.resetPolicy ?? existing?.resetPolicy ?? defaults.resetPolicy ?? FinancialSequenceResetPolicy.NEVER;
    const counterYear = resetPolicy === FinancialSequenceResetPolicy.ANNUAL || resetPolicy === FinancialSequenceResetPolicy.MANUAL
      ? currentYear
      : 0;

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.financialDocumentSequence.upsert({
        where: {
          documentType_prefix_year: { documentType, prefix, year: counterYear },
        },
        create: {
          documentType,
          prefix,
          year: counterYear,
          sequence: 1,
          sequenceLength: 5,
          separator: '-',
          startNumber: 1,
          pattern: '{PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{SEQ}',
          resetPolicy,
        },
        update: {
          sequence: { increment: 1 },
          resetPolicy,
        },
      });
      return row;
    });

    const pattern = options?.pattern || result.pattern || '{PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{SEQ}';
    const numberYear = counterYear === 0 ? currentYear : result.year;
    const sequence = result.sequence;
    const formatted = pattern
      .replace('{PREFIX}', result.prefix)
      .replace('{SEPARATOR}', result.separator)
      .replace('{YEAR}', String(numberYear))
      .replace('{SEQ}', String(sequence).padStart(result.sequenceLength, '0'));

    return {
      number: formatted,
      prefix: result.prefix,
      year: numberYear,
      sequence,
      sequenceLength: result.sequenceLength,
      separator: result.separator,
    };
  }

  /** Manual reset for ANNUAL/MANUAL counters (draft document numbers never repeat). */
  async resetSequence(
    documentType: FinancialDocumentType,
    options?: { prefix?: string; year?: number },
  ): Promise<{ sequence: number; year: number }> {
    const prefix = (options?.prefix || DEFAULT_DOCUMENT_PREFIXES[documentType]).trim().toUpperCase();
    const year = options?.year ?? new Date().getFullYear();
    const updated = await this.prisma.financialDocumentSequence.upsert({
      where: { documentType_prefix_year: { documentType, prefix, year } },
      create: {
        documentType,
        prefix,
        year,
        sequence: 0,
        sequenceLength: 5,
        separator: '-',
        startNumber: 1,
        pattern: '{PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{SEQ}',
        resetPolicy: FinancialSequenceResetPolicy.MANUAL,
      },
      update: { sequence: 0, resetPolicy: FinancialSequenceResetPolicy.MANUAL },
    });
    return { sequence: updated.sequence, year: updated.year };
  }

  async listSequences(): Promise<any[]> {
    return this.prisma.financialDocumentSequence.findMany({
      orderBy: [{ documentType: 'asc' }, { year: 'desc' }, { prefix: 'asc' }],
    });
  }

  async updateSequenceSettings(
    documentType: FinancialDocumentType,
    data: { prefix?: string; sequenceLength?: number; separator?: string; startNumber?: number; pattern?: string; resetPolicy?: FinancialSequenceResetPolicy },
  ): Promise<any> {
    if (data.sequenceLength !== undefined && (data.sequenceLength < 3 || data.sequenceLength > 12)) {
      throw new NumberingError('Sequence length must be between 3 and 12 digits.');
    }
    if (data.startNumber !== undefined && (data.startNumber < 1 || data.startNumber > 1_000_000)) {
      throw new NumberingError('Start number must be between 1 and 1,000,000.');
    }
    const resetPolicy = data.resetPolicy ?? FinancialSequenceResetPolicy.NEVER;
    const year = resetPolicy === FinancialSequenceResetPolicy.ANNUAL || resetPolicy === FinancialSequenceResetPolicy.MANUAL
      ? new Date().getFullYear()
      : 0;
    const prefix = data.prefix?.trim().toUpperCase() || DEFAULT_DOCUMENT_PREFIXES[documentType];
    return this.prisma.financialDocumentSequence.upsert({
      where: { documentType_prefix_year: { documentType, prefix, year } },
      create: {
        documentType,
        prefix,
        year,
        sequence: 0,
        sequenceLength: data.sequenceLength ?? 5,
        separator: data.separator ?? '-',
        startNumber: data.startNumber ?? 1,
        pattern: data.pattern ?? '{PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{SEQ}',
        resetPolicy,
      },
      update: {
        prefix: data.prefix?.trim().toUpperCase(),
        sequenceLength: data.sequenceLength,
        separator: data.separator,
        startNumber: data.startNumber,
        pattern: data.pattern,
        resetPolicy,
      },
    });
  }

  /**
   * Atomic, readable payment identifiers (PAY-<year>-<seq>). Payments are not
   * customer-facing numbered documents, so they use a dedicated counter stored
   * in FinancialDocumentSetting to avoid touching the document sequences.
   */
  async nextPaymentIdentifier(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.prisma.$queryRawUnsafe<Array<{ sequence: number }>>(
      `INSERT INTO "FinancialDocumentSetting" ("id", "key", "value", "updatedAt")
       VALUES ($1, $2, jsonb_build_object('payments', jsonb_build_object($3, 1)), now())
       ON CONFLICT ("key") DO UPDATE
         SET "value" = jsonb_set(
               COALESCE("FinancialDocumentSetting"."value", '{}'::jsonb),
               ARRAY['payments', $3],
               to_jsonb((COALESCE(("FinancialDocumentSetting"."value" -> 'payments' ->> $3))::bigint, 0) + 1)
             ),
             "updatedAt" = now()
       RETURNING ("value" -> 'payments' ->> $3)::bigint AS sequence`,
      `fd-payment-counter-${year}`,
      `counters.payments.${year}`,
      String(year),
    );
    const sequence = Number(result?.[0]?.sequence ?? 1);
    return `PAY-${year}-${String(sequence).padStart(6, '0')}`;
  }
}