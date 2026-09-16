import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinancialSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<any> {
    const row = await this.prisma.financialDocumentSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async getAll(): Promise<Array<{ key: string; value: any; updatedAt: Date }>> {
    return this.prisma.financialDocumentSetting.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async set(key: string, value: any, userId?: string | null): Promise<{ key: string; value: any; updatedAt: Date }> {
    return this.prisma.financialDocumentSetting.upsert({
      where: { key },
      create: { key, value, updatedById: userId },
      update: { value, updatedById: userId, updatedAt: new Date() },
    });
  }

  async getNumberingDefaults(): Promise<Record<string, any>> {
    return (await this.get('numbering.defaults')) || {
      prefixQuotation: 'QT',
      prefixInvoice: 'INV',
      prefixReceipt: 'RCT',
      sequenceLength: 5,
      separator: '-',
      resetPolicy: 'ANNUAL',
    };
  }

  async setNumberingDefaults(data: Record<string, any>, userId?: string | null) {
    return this.set('numbering.defaults', data, userId);
  }
}