import { Injectable } from '@nestjs/common';
import { FinancialDocumentType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntryInput {
  action: string;
  entity: string;
  entityId?: string;
  documentType?: FinancialDocumentType;
  documentId?: string;
  documentNumber?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: string | null;
  userEmail?: string | null;
  description?: string;
}

@Injectable()
export class FinancialAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private requestContext(): { ipAddress?: string; userAgent?: string } {
    const req: any = (global as any).request;
    if (!req) return {};
    return {
      ipAddress: req.ip || req.connection?.remoteAddress || undefined,
      userAgent: req.headers?.['user-agent'] || undefined,
    };
  }

  async write(entry: AuditEntryInput): Promise<void> {
    const ctx = this.requestContext();
    await this.prisma.financialDocumentAudit.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        documentType: entry.documentType,
        documentId: entry.documentId,
        documentNumber: entry.documentNumber,
        oldValues: entry.oldValues ?? undefined,
        newValues: entry.newValues ?? undefined,
        userId: entry.userId ?? undefined,
        userEmail: entry.userEmail ?? undefined,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });
  }

  async describeEntity(record: any): Promise<{ entity: string; entityId: string; documentNumber?: string }> {
    if ('quotationNumber' in record) {
      return { entity: 'Quotation', entityId: record.id, documentNumber: record.quotationNumber };
    }
    if ('invoiceNumber' in record) {
      return { entity: 'Invoice', entityId: record.id, documentNumber: record.invoiceNumber };
    }
    if ('paymentNumber' in record) {
      return { entity: 'FinancialPayment', entityId: record.id, documentNumber: record.paymentNumber };
    }
    if ('receiptNumber' in record) {
      return { entity: 'FinancialReceipt', entityId: record.id, documentNumber: record.receiptNumber };
    }
    if ('id' in record) {
      return { entity: 'FinancialDocument', entityId: record.id };
    }
    return { entity: 'FinancialDocument', entityId: String(Date.now()) };
  }
}