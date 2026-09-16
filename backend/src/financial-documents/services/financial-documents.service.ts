import { Injectable } from '@nestjs/common';
import { FinancialDocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class FinancialDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [quoteCounts, quoteTotal, quoteMonthly] = await Promise.all([
      this.prisma.quotation.groupBy({ by: ['status'], _count: { _all: true } }) as any,
      this.prisma.quotation.count(),
      this.prisma.quotation.count({ where: { quotationDate: { gte: startOfMonth } } }),
    ]);
    const [invoiceCounts, invoiceTotal, invoiceOverdueRaw, invoiceMonthly, invoiceSums] = await Promise.all([
      this.prisma.invoice.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalAmount: true, amountPaid: true, balanceDue: true } }) as any,
      this.prisma.invoice.count(),
      this.prisma.invoice.findMany({
        where: {
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
          dueDate: { lt: new Date() },
        },
        select: { id: true, invoiceNumber: true, dueDate: true, balanceDue: true, currency: true, customer: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.invoice.count({ where: { invoiceDate: { gte: startOfMonth } } }),
      this.prisma.invoice.aggregate({ _sum: { totalAmount: true, amountPaid: true, balanceDue: true } }),
    ]);
    const [paymentCounts, paidConfirmed, paymentMonthly, paymentSums] = await Promise.all([
      this.prisma.financialPayment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true } }) as any,
      this.prisma.financialPayment.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.financialPayment.count({ where: { paymentDate: { gte: startOfMonth } } }),
      this.prisma.financialPayment.aggregate({ where: { status: 'CONFIRMED' }, _sum: { amount: true } }),
    ]);
    const [receiptTotal, receiptMonthly, receiptByStatus] = await Promise.all([
      this.prisma.financialReceipt.count(),
      this.prisma.financialReceipt.count({ where: { receiptDate: { gte: startOfMonth } } }),
      this.prisma.financialReceipt.groupBy({ by: ['status'], _count: { _all: true } }) as any,
    ]);
    const [customerTotal, overdueSum, recent] = await Promise.all([
      this.prisma.financialCustomer.count({ where: { isActive: true } }),
      this.prisma.invoice.aggregate({ where: { status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID'] }, dueDate: { lt: new Date() } }, _sum: { balanceDue: true } }),
      this.recentDocuments(),
    ]);

    return {
      quotations: { total: quoteTotal, monthly: quoteMonthly, byStatus: toMap(quoteCounts) },
      invoices: {
        total: invoiceTotal,
        monthly: invoiceMonthly,
        byStatus: toMap(invoiceCounts),
        billed: invoiceSums._sum.totalAmount ?? 0,
        collected: invoiceSums._sum.amountPaid ?? 0,
        outstanding: invoiceSums._sum.balanceDue ?? 0,
        overdueCount: invoiceOverdueRaw.length,
        overdueAmount: overdueSum._sum.balanceDue ?? 0,
        overdue: invoiceOverdueRaw,
      },
      payments: {
        total: sumCounts(paymentCounts),
        confirmedCount: paidConfirmed,
        monthly: paymentMonthly,
        byStatus: toMap(paymentCounts),
        collected: paymentSums._sum.amount ?? 0,
      },
      receipts: { total: receiptTotal, monthly: receiptMonthly, byStatus: toMap(receiptByStatus) },
      customers: customerTotal,
      recent,
    };
  }

  async readiness() {
    const [profile, bank, tax, templates, sequences] = await Promise.all([
      this.prisma.companyProfile.findUnique({ where: { id: 'company' } }),
      this.prisma.bankAccount.findFirst({ where: { isDefault: true, isActive: true } }),
      this.prisma.taxConfiguration.findFirst({ where: { isDefault: true, isActive: true } }),
      this.prisma.financialDocumentTemplate.findMany({ where: { isActive: true }, select: { docType: true, id: true } }),
      this.prisma.financialDocumentSequence.findMany({ select: { documentType: true, prefix: true } }),
    ]);

    const checks: Array<{ key: string; label: string; ok: boolean; message: string }> = [];
    checks.push({
      key: 'company-profile',
      label: 'Company Profile',
      ok: !!(profile && profile.legalName),
      message: profile && profile.legalName ? 'Company profile configured.' : 'Company profile has not been configured.',
    });
    checks.push({
      key: 'tpin',
      label: 'ZRA / TPIN',
      ok: !!profile?.tpin,
      message: profile?.tpin ? 'TPIN configured.' : 'Company TPIN has not been configured.',
    });
    checks.push({
      key: 'signatory',
      label: 'Authorized Signatory',
      ok: !!(profile?.authorizedSignatoryName || profile?.signatureUrl),
      message: profile?.authorizedSignatoryName || profile?.signatureUrl ? 'Signatory configured.' : 'Authorized signatory has not been configured.',
    });
    checks.push({
      key: 'bank',
      label: 'Default Bank Account',
      ok: !!bank,
      message: bank ? `Default bank account: ${bank.bankName} ${bank.accountNumber}` : 'Default bank account has not been configured.',
    });
    checks.push({
      key: 'tax',
      label: 'Default Tax Configuration',
      ok: !!tax,
      message: tax ? `Default tax: ${tax.name} (${tax.taxRate}%)` : 'Default tax configuration has not been configured.',
    });
    const types = [FinancialDocumentType.QUOTATION, FinancialDocumentType.INVOICE, FinancialDocumentType.PAYMENT_RECEIPT];
    for (const t of types) {
      const hasTemplate = templates.some((tpl) => tpl.docType === t);
      const hasSequence = sequences.some((s) => s.documentType === t);
      checks.push({
        key: `template-${t}`,
        label: `${t.replace('_', ' ')} — Default Template`,
        ok: hasTemplate,
        message: hasTemplate ? `Default ${t} template configured.` : `No default ${t} template configured yet.`,
      });
      checks.push({
        key: `sequence-${t}`,
        label: `${t.replace('_', ' ')} — Numbering`,
        ok: hasSequence,
        message: hasSequence ? `Numbering configured.` : `Numbering will auto-initialize on first issue.`,
      });
    }

    return {
      ready: checks.filter((c) => !c.ok).length === 0,
      checks,
    };
  }

  async versions(docType: FinancialDocumentType, documentId: string) {
    return this.prisma.financialDocumentVersion.findMany({
      where: { documentType: docType, documentId },
      orderBy: { version: 'desc' },
    });
  }

  async auditLogs(query: { entity?: string; action?: string; documentType?: string; userId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const where: Prisma.FinancialDocumentAuditWhereInput = {};
    if (query?.entity) where.entity = query.entity;
    if (query?.action) where.action = query.action;
    if (query?.documentType) where.documentType = query.documentType as FinancialDocumentType;
    if (query?.userId) where.userId = query.userId;
    if (query?.from || query?.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    const page = Math.max(1, query?.page || 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize || 25));
    const [total, items] = await Promise.all([
      this.prisma.financialDocumentAudit.count({ where }),
      this.prisma.financialDocumentAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async documentRelationships(docType: FinancialDocumentType, documentId: string) {
    const versionList = await this.prisma.financialDocumentVersion.findMany({
      where: { documentType: docType, documentId },
      orderBy: { version: 'desc' },
    });
    if (docType === FinancialDocumentType.QUOTATION) {
      const q = await this.prisma.quotation.findUnique({
        where: { id: documentId },
        include: {
          customer: true,
          items: true,
          invoice: { include: { payments: true, receipts: true } },
          payments: true,
          receipts: true,
        },
      });
      return { kind: 'QUOTATION', root: q, versions: versionList };
    }
    if (docType === FinancialDocumentType.INVOICE) {
      const inv = await this.prisma.invoice.findUnique({
        where: { id: documentId },
        include: {
          customer: true,
          items: true,
          quotation: true,
          payments: true,
          receipts: true,
          allocations: true,
        },
      });
      return { kind: 'INVOICE', root: inv, versions: versionList };
    }
    if (docType === FinancialDocumentType.PAYMENT_RECEIPT) {
      const r = await this.prisma.financialReceipt.findUnique({
        where: { id: documentId },
        include: { customer: true, payment: true, invoice: { include: { payments: true } } },
      });
      return { kind: 'RECEIPT', root: r, versions: versionList };
    }
    return { kind: docType, root: null, versions: versionList };
  }

  private async recentDocuments() {
    const [quotes, invoices, receipts] = await Promise.all([
      this.prisma.quotation.findMany({ orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, quotationNumber: true, status: true, totalAmount: true, currency: true, createdAt: true, customer: { select: { name: true } } } }),
      this.prisma.invoice.findMany({ orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, invoiceNumber: true, status: true, totalAmount: true, balanceDue: true, currency: true, createdAt: true, customer: { select: { name: true } } } }),
      this.prisma.financialReceipt.findMany({ orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, receiptNumber: true, status: true, amountReceived: true, currency: true, createdAt: true, customer: { select: { name: true } } } }),
    ]);
    const mapped: Array<Record<string, any>> = [
      ...quotes.map((d: any) => ({ type: 'QUOTATION', id: d.id, number: d.quotationNumber || '(draft)', status: d.status, amount: d.totalAmount, currency: d.currency, date: d.createdAt, customer: d.customer?.name, } as any)),
      ...invoices.map((d: any) => ({ type: 'INVOICE', id: d.id, number: d.invoiceNumber || '(draft)', status: d.status, amount: d.totalAmount, currency: d.currency, date: d.createdAt, customer: d.customer?.name, } as any)),
      ...receipts.map((d: any) => ({ type: 'RECEIPT', id: d.id, number: d.receiptNumber, status: d.status, amount: d.amountReceived, currency: d.currency, date: d.createdAt, customer: d.customer?.name, } as any)),
    ];
    return mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }
}

function toMap(rows: Array<{ status: string; _count?: Record<string, number>; _sum?: Record<string, number> }>) {
  const map: Record<string, any> = {};
  for (const row of rows ?? []) {
    map[row.status] = row._count?._all ?? 0;
  }
  return map;
}

function sumCounts(rows: Array<{ _count?: Record<string, number> }>) {
  return (rows ?? []).reduce((acc, r) => acc + (r._count?._all ?? 0), 0);
}