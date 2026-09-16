import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialDocumentType, FinancialPaymentMethod, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialNumberingService } from './financial-numbering.service';
import { FinancialPdfService, PdfCompany } from './financial-pdf.service';
import { FinancialVerificationService } from './financial-verification.service';
import { FinancialAuditService } from './financial-audit.service';
import { CompanyProfileService } from './company-profile.service';
import { BankAccountService } from './bank-account.service';
import { TaxConfigurationService } from './tax-configuration.service';
import { FinancialPaymentService } from './financial-payment.service';
import { computeItems, CalcItemInput } from '../utils/financial-calculation';
import { amountInWords } from '../utils/amount-in-words';
import { invoiceEffectiveStatus } from '../utils/document-status';

export interface InvoiceItemInput extends CalcItemInput {}

export interface InvoiceCreateInput {
  customerId: string;
  quotationId?: string;
  invoiceDate?: Date | string;
  dueDate?: Date | string;
  orderReference?: string;
  purchaseReference?: string;
  currency?: string;
  items?: InvoiceItemInput[];
  taxConfigurationId?: string;
  bankAccountId?: string;
  paymentTerms?: string;
  serviceTerms?: string;
  notes?: string;
  templateId?: string;
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: FinancialNumberingService,
    private readonly pdf: FinancialPdfService,
    private readonly verification: FinancialVerificationService,
    private readonly audit: FinancialAuditService,
    private readonly companyProfile: CompanyProfileService,
    private readonly bankAccounts: BankAccountService,
    private readonly taxConfigs: TaxConfigurationService,
    private readonly payments: FinancialPaymentService,
  ) {}

  async list(query: { search?: string; status?: string; customerId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const where: Prisma.InvoiceWhereInput = {};
    if (query?.status) where.status = query.status as InvoiceStatus;
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { orderReference: { contains: query.search, mode: 'insensitive' } },
        { purchaseReference: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query?.from || query?.to) {
      where.invoiceDate = {};
      if (query.from) where.invoiceDate.gte = new Date(query.from);
      if (query.to) where.invoiceDate.lte = new Date(query.to);
    }

    const page = Math.max(1, query?.page || 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize || 20));
    const [total, rows] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true, legalName: true, city: true, email: true, phone: true } },
          items: { orderBy: { sortOrder: 'asc' } },
          _count: true,
        },
      }),
    ]);
    return { items: rows.map((inv) => ({ ...inv, effectiveStatus: invoiceEffectiveStatus(inv) })), total, page, pageSize };
  }

  async get(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: 'asc' } },
        taxConfig: true,
        bankAccount: true,
        quotation: true,
        payments: { orderBy: { createdAt: 'desc' } },
        receipts: { orderBy: { createdAt: 'desc' } },
        allocations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found.');
    return { ...inv, effectiveStatus: invoiceEffectiveStatus(inv) };
  }

  async create(input: InvoiceCreateInput, userId?: string | null, userEmail?: string | null) {
    if (!input.items || !input.items.length) throw new BadRequestException('At least one invoice line item is required.');
    const customer = await this.prisma.financialCustomer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundException('Financial customer not found.');
    if (!customer.isActive) throw new BadRequestException('Customer is inactive.');

    const taxConfig = input.taxConfigurationId
      ? await this.taxConfigs.get(input.taxConfigurationId)
      : await this.taxConfigs.getDefault();
    const bankAccount = input.bankAccountId
      ? await this.bankAccounts.get(input.bankAccountId)
      : await this.bankAccounts.getDefault();
    const { items, totals } = computeItems(input.items, taxConfig?.taxRate ?? null, taxConfig?.pricingMode);
    const currency = input.currency || 'ZMW';
    const num = await this.numbering.nextNumber(FinancialDocumentType.INVOICE);

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber: num.number,
        status: InvoiceStatus.DRAFT,
        invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        orderReference: input.orderReference,
        purchaseReference: input.purchaseReference,
        customerId: input.customerId,
        currency,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        taxRate: totals.taxRate,
        totalAmount: totals.totalAmount,
        amountPaid: 0,
        balanceDue: totals.totalAmount,
        taxConfigurationId: taxConfig?.id,
        bankAccountId: bankAccount?.id,
        paymentTerms: input.paymentTerms,
        serviceTerms: input.serviceTerms,
        notes: input.notes,
        templateId: input.templateId,
        createdById: userId ?? undefined,
        items: { create: items.map(this.itemData) },
      },
      include: { items: true },
    });
    await this.audit.write({ action: 'CREATE', entity: 'Invoice', entityId: invoice.id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, newValues: { customerId: input.customerId, totalAmount: totals.totalAmount, status: 'DRAFT' } });
    return invoice;
  }

  async createFromQuotation(quotationId: string, userId?: string | null, userEmail?: string | null, overrides?: Partial<InvoiceCreateInput>) {
    const q = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: { orderBy: { sortOrder: 'asc' } }, customer: true, taxConfig: true, bankAccount: true },
    });
    if (!q) throw new NotFoundException('Quotation not found.');
    const existing = await this.prisma.invoice.findUnique({ where: { quotationId } });
    if (existing) throw new BadRequestException('An invoice has already been created from this quotation.');

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber: (await this.numbering.nextNumber(FinancialDocumentType.INVOICE)).number,
        status: InvoiceStatus.DRAFT,
        invoiceDate: overrides?.invoiceDate ? new Date(overrides.invoiceDate) : new Date(),
        dueDate: overrides?.dueDate ? new Date(overrides.dueDate) : undefined,
        quotationId,
        orderReference: overrides?.orderReference ?? q.reference,
        purchaseReference: overrides?.purchaseReference ?? q.customerReference,
        customerId: q.customerId,
        currency: overrides?.currency || q.currency,
        subtotal: q.subtotal,
        discount: q.discount,
        taxableAmount: q.taxableAmount,
        taxAmount: q.taxAmount,
        taxRate: q.taxRate,
        totalAmount: q.totalAmount,
        amountPaid: 0,
        balanceDue: q.totalAmount,
        taxConfigurationId: overrides?.taxConfigurationId ?? q.taxConfigurationId,
        bankAccountId: overrides?.bankAccountId ?? q.bankAccountId,
        paymentTerms: overrides?.paymentTerms ?? q.paymentTerms,
        serviceTerms: overrides?.serviceTerms ?? q.deliveryTerms,
        notes: overrides?.notes ?? q.notes,
        templateId: overrides?.templateId ?? q.templateId,
        createdById: userId ?? undefined,
        items: {
          create: q.items.map((it: any) => ({
            itemName: it.itemName ?? undefined,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit ?? undefined,
            unitPrice: it.unitPrice,
            discount: it.discount,
            taxRate: it.taxRate,
            taxAmount: it.taxAmount,
            subtotal: it.subtotal,
            lineTotal: it.lineTotal,
            sortOrder: it.sortOrder,
          })),
        },
      },
      include: { items: true },
    });
    await this.audit.write({ action: 'CREATE_FROM_QUOTATION', entity: 'Invoice', entityId: invoice.id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, newValues: { quotationId, totalAmount: q.totalAmount, status: 'DRAFT' } });
    return invoice;
  }

  async update(id: string, input: Partial<InvoiceCreateInput>, userId?: string | null, userEmail?: string | null) {
    const existing = await this.get(id);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited.');
    }
    const items = input.items?.length ? input.items : existing.items;
    const taxConfig = input.taxConfigurationId
      ? await this.taxConfigs.get(input.taxConfigurationId)
      : existing.taxConfigurationId
        ? existing.taxConfig
        : await this.taxConfigs.getDefault();
    const { items: computed, totals } = computeItems(items as InvoiceItemInput[], taxConfig?.taxRate ?? null, taxConfig?.pricingMode);

    const invoice = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : undefined,
          dueDate: input.dueDate !== undefined ? new Date(input.dueDate) : undefined,
          orderReference: input.orderReference,
          purchaseReference: input.purchaseReference,
          currency: input.currency,
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxableAmount: totals.taxableAmount,
          taxAmount: totals.taxAmount,
          taxRate: totals.taxRate,
          totalAmount: totals.totalAmount,
          balanceDue: roundSafe(existing.amountPaid) - totals.totalAmount <= 0
            ? Number((totals.totalAmount - existing.amountPaid).toFixed(2))
            : 0,
          taxConfigurationId: taxConfig?.id,
          bankAccountId: input.bankAccountId,
          paymentTerms: input.paymentTerms,
          serviceTerms: input.serviceTerms,
          notes: input.notes,
          templateId: input.templateId,
          items: { create: computed.map((it: any) => this.itemData(it)) },
        },
        include: { items: true },
      });
    });
    await this.audit.write({ action: 'UPDATE', entity: 'Invoice', entityId: id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, oldValues: { totalAmount: existing.totalAmount, status: existing.status }, newValues: { totalAmount: totals.totalAmount, status: invoice.status } });
    return invoice;
  }

  async issue(id: string, userId?: string | null, userEmail?: string | null) {
    const inv = await this.get(id);
    if (inv.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Only draft invoices can be issued. Current status: ${inv.status}.`);
    }
    return this.finalizeIssue(inv, userId, userEmail);
  }

  async send(id: string, userId?: string | null, userEmail?: string | null) {
    const inv = await this.get(id);
    const sendable: InvoiceStatus[] = [InvoiceStatus.ISSUED, InvoiceStatus.SENT];
    if (!sendable.includes(inv.status)) {
      throw new BadRequestException('Only issued invoices can be sent.');
    }
    const updated = await this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.SENT, sentAt: new Date(), issuedById: userId ?? undefined } });
    await this.audit.write({ action: 'SEND', entity: 'Invoice', entityId: id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, oldValues: { status: inv.status }, newValues: { status: InvoiceStatus.SENT } });
    return updated;
  }

  async cancel(id: string, reason?: string, userId?: string | null, userEmail?: string | null) {
    const inv = await this.get(id);
    const cancellable: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.SENT];
    if (!cancellable.includes(inv.status)) {
      throw new BadRequestException(`Invoice cannot be cancelled from status ${inv.status}.`);
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date(), cancelledBy: userId ?? undefined, cancellationReason: reason },
    });
    await this.audit.write({ action: 'CANCEL', entity: 'Invoice', entityId: id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, oldValues: { status: inv.status }, newValues: { status: InvoiceStatus.CANCELLED, reason } });
    return updated;
  }

  async void(id: string, reason?: string, userId?: string | null, userEmail?: string | null) {
    const inv = await this.get(id);
    const voidable: InvoiceStatus[] = [InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID];
    if (!voidable.includes(inv.status)) {
      throw new BadRequestException(`Invoice cannot be voided from status ${inv.status}.`);
    }
    if (inv.amountPaid > 0) {
      const confirmed = inv.payments?.filter((p: any) => p.status === 'CONFIRMED') || [];
      for (const p of confirmed) {
        await this.payments.reverse(p.id, `Invoice ${inv.invoiceNumber} voided: ${reason || 'Company void'}`, userId, userEmail);
      }
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOID,
        voidedAt: new Date(),
        voidedBy: userId ?? undefined,
        voidReason: reason,
        amountPaid: 0,
        balanceDue: 0,
      },
    });
    await this.audit.write({ action: 'VOID', entity: 'Invoice', entityId: id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, oldValues: { status: inv.status, amountPaid: inv.amountPaid }, newValues: { status: InvoiceStatus.VOID, reason } });
    return updated;
  }

  async remove(id: string, userId?: string | null, userEmail?: string | null) {
    const inv = await this.get(id);
    if (inv.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be deleted.');
    }
    await this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date(), cancelledBy: userId ?? undefined, cancellationReason: 'Deleted by operator' } });
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await this.audit.write({ action: 'DELETE', entity: 'Invoice', entityId: id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, oldValues: { status: inv.status } });
    return { ok: true };
  }

  async recordPayment(
    invoiceId: string,
    input: { amount: number; paymentDate?: Date | string; method?: string; transactionReference?: string; bankReference?: string; notes?: string },
    userId?: string | null,
    userEmail?: string | null,
  ) {
    const inv = await this.get(invoiceId);
    const blockedStatuses: InvoiceStatus[] = [InvoiceStatus.VOID, InvoiceStatus.CANCELLED];
    if (blockedStatuses.includes(inv.status as InvoiceStatus)) {
      throw new BadRequestException('Payments cannot be recorded against a voided or cancelled invoice.');
    }
    if (inv.balanceDue <= 0) throw new BadRequestException('This invoice is already fully paid.');
    if (input.amount <= 0) throw new BadRequestException('Payment amount must be greater than zero.');
    if (input.amount > inv.balanceDue + 0.005) {
      throw new BadRequestException(`Payment amount of ${input.amount} exceeds the outstanding balance of ${inv.balanceDue}.`);
    }
    return this.payments.recordPayment(
      { invoiceId, amount: Number(input.amount.toFixed(2)), paymentDate: input.paymentDate, method: input.method as FinancialPaymentMethod | undefined, transactionReference: input.transactionReference, bankReference: input.bankReference, notes: input.notes, customerId: inv.customerId },
      userId,
      userEmail,
    );
  }

  async getPayments(invoiceId: string) {
    const inv = await this.get(invoiceId);
    return inv.payments;
  }

  async renderPdf(id: string): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const inv = await this.get(id);
    if (!inv.invoiceNumber) throw new BadRequestException('This invoice has not been issued yet.');
    const company = await this.companyProfile.requireProfile();
    const verification = inv.verificationCode
      ? { verificationCode: inv.verificationCode, verificationUrl: inv.verificationUrl, verificationQr: await this.verification.qrForUrl(inv.verificationUrl), documentHash: inv.documentHash }
      : undefined;
    return this.pdf.renderInvoice({
      number: inv.invoiceNumber,
      status: invoiceEffectiveStatus(inv),
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      orderReference: inv.orderReference,
      purchaseReference: inv.purchaseReference,
      company: company as PdfCompany,
      customer: inv.customer,
      items: inv.items,
      totals: {
        subtotal: inv.subtotal,
        discount: inv.discount,
        taxableAmount: inv.taxableAmount,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
        amountInWords: inv.amountInWords || amountInWords(inv.balanceDue, inv.currency),
        taxRate: inv.taxRate,
      },
      amountPaid: inv.amountPaid,
      balanceDue: inv.balanceDue,
      bank: inv.bankAccount || (await this.bankAccounts.getDefault()),
      notes: inv.notes,
      paymentTerms: inv.paymentTerms || company.defaultPaymentTerms,
      serviceTerms: inv.serviceTerms,
      verification,
    });
  }

  private async finalizeIssue(inv: any, userId?: string | null, userEmail?: string | null) {
    const num = await this.numbering.nextNumber(FinancialDocumentType.INVOICE);
    const company = await this.companyProfile.requireProfile();
    const verification = await this.verification.generateVerification({
      documentType: FinancialDocumentType.INVOICE,
      documentId: inv.id,
      documentNumber: num.number,
      totalAmount: inv.totalAmount,
      currency: inv.currency,
      customerName: inv.customer?.name,
      issuedAt: new Date().toISOString(),
    });
    const bank = inv.bankAccount || (await this.bankAccounts.getDefault());
    const rendered = await this.pdf.renderInvoice({
      number: num.number,
      status: InvoiceStatus.ISSUED,
      invoiceDate: new Date(),
      dueDate: inv.dueDate,
      orderReference: inv.orderReference,
      purchaseReference: inv.purchaseReference,
      company: company as PdfCompany,
      customer: inv.customer,
      items: inv.items,
      totals: {
        subtotal: inv.subtotal,
        discount: inv.discount,
        taxableAmount: inv.taxableAmount,
        taxAmount: inv.taxAmount,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
        amountInWords: amountInWords(inv.totalAmount, inv.currency),
        taxRate: inv.taxRate,
      },
      amountPaid: 0,
      balanceDue: inv.totalAmount,
      bank,
      notes: inv.notes,
      paymentTerms: inv.paymentTerms || company.defaultPaymentTerms,
      serviceTerms: inv.serviceTerms,
      verification,
    });

    const updated = await this.prisma.invoice.update({
      where: { id: inv.id },
      data: {
        invoiceNumber: num.number,
        status: InvoiceStatus.ISSUED,
        issueDate: new Date(),
        issuedById: userId ?? undefined,
        pdfUrl: rendered.url,
        pdfPublicId: rendered.publicId,
        verificationCode: verification.verificationCode,
        documentHash: verification.documentHash,
        verificationUrl: verification.verificationUrl,
        amountInWords: amountInWords(inv.totalAmount, inv.currency),
      },
    });

    await this.prisma.financialDocumentVersion.create({
      data: {
        documentType: FinancialDocumentType.INVOICE,
        documentId: inv.id,
        documentNumber: num.number,
        version: (await this.versionCount(inv.id)) + 1,
        pdfUrl: rendered.url,
        dataSnapshot: { number: num.number, totalAmount: inv.totalAmount, customerId: inv.customerId },
        templateId: inv.templateId ?? undefined,
        generatedById: userId ?? undefined,
        sourceFile: `SMART_TECH_Invoice_${num.number}.pdf`,
      },
    });

    await this.audit.write({ action: 'ISSUE', entity: 'Invoice', entityId: inv.id, documentType: FinancialDocumentType.INVOICE, userId, userEmail, oldValues: { status: inv.status }, newValues: { status: InvoiceStatus.ISSUED, invoiceNumber: num.number } });
    return updated;
  }

  private itemData(it: any) {
    return {
      itemName: it.itemName,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      discount: it.discount,
      taxRate: it.taxRate,
      taxAmount: it.taxAmount,
      subtotal: it.subtotal,
      lineTotal: it.lineTotal,
      sortOrder: it.sortOrder,
    };
  }

  private async versionCount(id: string): Promise<number> {
    return this.prisma.financialDocumentVersion.count({ where: { documentId: id, documentType: FinancialDocumentType.INVOICE } });
  }
}

function roundSafe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}