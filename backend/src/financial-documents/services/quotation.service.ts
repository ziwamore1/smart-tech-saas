import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialDocumentType, Prisma, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialNumberingService } from './financial-numbering.service';
import { FinancialPdfService, PdfCompany } from './financial-pdf.service';
import { FinancialVerificationService } from './financial-verification.service';
import { FinancialAuditService } from './financial-audit.service';
import { CompanyProfileService } from './company-profile.service';
import { BankAccountService } from './bank-account.service';
import { TaxConfigurationService } from './tax-configuration.service';
import { InvoiceCreateInput, InvoiceService } from './invoice.service';
import { computeItems, CalcItemInput } from '../utils/financial-calculation';
import { amountInWords } from '../utils/amount-in-words';
import { quotationEffectiveStatus } from '../utils/document-status';

export interface QuotationItemInput extends CalcItemInput {}

export interface QuotationCreateInput {
  customerId: string;
  quotationDate?: Date | string;
  validUntil?: Date | string;
  reference?: string;
  customerReference?: string;
  currency?: string;
  items: QuotationItemInput[];
  taxConfigurationId?: string;
  bankAccountId?: string;
  quotationValidity?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  specialConditions?: string;
  templateId?: string;
}

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: FinancialNumberingService,
    private readonly pdf: FinancialPdfService,
    private readonly verification: FinancialVerificationService,
    private readonly audit: FinancialAuditService,
    private readonly companyProfile: CompanyProfileService,
    private readonly bankAccounts: BankAccountService,
    private readonly taxConfigs: TaxConfigurationService,
    private readonly invoices: InvoiceService,
  ) {}

  async list(query: { search?: string; status?: string; customerId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const where: Prisma.QuotationWhereInput = {};
    if (query?.status) where.status = query.status as QuotationStatus;
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.search) {
      where.OR = [
        { quotationNumber: { contains: query.search, mode: 'insensitive' } },
        { reference: { contains: query.search, mode: 'insensitive' } },
        { customerReference: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query?.from || query?.to) {
      where.quotationDate = {};
      if (query.from) where.quotationDate.gte = new Date(query.from);
      if (query.to) where.quotationDate.lte = new Date(query.to);
    }

    const page = Math.max(1, query?.page || 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize || 20));
    const [total, rows] = await Promise.all([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        orderBy: { quotationDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true, legalName: true, city: true, email: true, phone: true } },
          items: { orderBy: { sortOrder: 'asc' } },
          _count: true,
        },
      }),
    ]);
    return {
      items: rows.map((q) => ({ ...q, effectiveStatus: quotationEffectiveStatus(q) })),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: 'asc' } },
        taxConfig: true,
        bankAccount: true,
        invoice: true,
        payments: { orderBy: { createdAt: 'desc' } },
        receipts: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!q) throw new NotFoundException('Quotation not found.');
    return { ...q, effectiveStatus: quotationEffectiveStatus(q) };
  }

  async create(input: QuotationCreateInput, userId?: string | null, userEmail?: string | null) {
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
    const num = await this.numbering.nextNumber(FinancialDocumentType.QUOTATION);

    const quotation = await this.prisma.quotation.create({
      data: {
        quotationNumber: num.number,
        status: QuotationStatus.DRAFT,
        quotationDate: input.quotationDate ? new Date(input.quotationDate) : new Date(),
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
        customerId: input.customerId,
        currency,
        reference: input.reference,
        customerReference: input.customerReference,
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxableAmount: totals.taxableAmount,
        taxAmount: totals.taxAmount,
        taxRate: totals.taxRate,
        totalAmount: totals.totalAmount,
        taxConfigurationId: taxConfig?.id,
        bankAccountId: bankAccount?.id,
        quotationValidity: input.quotationValidity,
        paymentTerms: input.paymentTerms,
        deliveryTerms: input.deliveryTerms,
        notes: input.notes,
        specialConditions: input.specialConditions,
        templateId: input.templateId,
        createdById: userId ?? undefined,
        items: {
          create: items.map((it) => ({
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
          })),
        },
      },
      include: { items: true },
    });
    await this.audit.write({ action: 'CREATE', entity: 'Quotation', entityId: quotation.id, documentType: FinancialDocumentType.QUOTATION, userId, userEmail, newValues: { customerId: customer.id, totalAmount: totals.totalAmount, status: 'DRAFT' } });
    return quotation;
  }

  async update(id: string, input: Partial<QuotationCreateInput>, userId?: string | null, userEmail?: string | null) {
    const existing = await this.get(id);
    if (existing.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Only draft quotations can be edited. Issue a new version if the content has changed.');
    }
    const items = input.items ?? existing.items;
    const taxConfig = input.taxConfigurationId
      ? await this.taxConfigs.get(input.taxConfigurationId)
      : existing.taxConfigurationId
        ? await this.taxConfigs.get(existing.taxConfigurationId)
        : await this.taxConfigs.getDefault();
    const { items: computedItems, totals } = computeItems(items as QuotationItemInput[], taxConfig?.taxRate ?? null, taxConfig?.pricingMode);

    const quotation = await this.prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      return tx.quotation.update({
        where: { id },
        data: {
          quotationDate: input.quotationDate ? new Date(input.quotationDate) : undefined,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          reference: input.reference,
          customerReference: input.customerReference,
          currency: input.currency,
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxableAmount: totals.taxableAmount,
          taxAmount: totals.taxAmount,
          taxRate: totals.taxRate,
          totalAmount: totals.totalAmount,
          taxConfigurationId: taxConfig?.id,
          bankAccountId: input.bankAccountId,
          quotationValidity: input.quotationValidity,
          paymentTerms: input.paymentTerms,
          deliveryTerms: input.deliveryTerms,
          notes: input.notes,
          specialConditions: input.specialConditions,
          templateId: input.templateId,
          items: { create: computedItems.map((it: any) => ({ ...this.itemData(it) })) },
        },
        include: { items: true },
      });
    });
    await this.audit.write({ action: 'UPDATE', entity: 'Quotation', entityId: id, documentType: FinancialDocumentType.QUOTATION, userId, userEmail, oldValues: { totalAmount: existing.totalAmount, status: existing.status }, newValues: { totalAmount: totals.totalAmount, status: quotation.status } });
    return quotation;
  }

  async issue(id: string, userId?: string | null, userEmail?: string | null) {
    const existing = await this.get(id);
    if (existing.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException(`Only draft quotations can be issued. Current status: ${existing.status}.`);
    }
    return this.finalizeIssue(existing, userId, userEmail);
  }

  private async finalizeIssue(q: any, userId?: string | null, userEmail?: string | null) {
    const num = await this.numbering.nextNumber(FinancialDocumentType.QUOTATION);
    return this._render(q, num.number, true, userId, userEmail, { action: 'ISSUE', toStatus: QuotationStatus.ISSUED });
  }

  async send(id: string, userId?: string | null, userEmail?: string | null) {
    const q = await this.get(id);
    const sendable: QuotationStatus[] = [QuotationStatus.ISSUED, QuotationStatus.SENT];
    if (!sendable.includes(q.status)) {
      throw new BadRequestException('Only issued quotations can be sent.');
    }
    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.SENT, sentAt: new Date(), issuedById: userId ?? undefined },
    });
    await this.audit.write({ action: 'SEND', entity: 'Quotation', entityId: id, documentType: FinancialDocumentType.QUOTATION, userId, userEmail, oldValues: { status: q.status }, newValues: { status: QuotationStatus.SENT } });
    return updated;
  }

  async transition(id: string, to: QuotationStatus, userId?: string | null, userEmail?: string | null, reason?: string) {
    const q = await this.get(id);
    const allowed: Record<string, string[]> = {
      ACCEPTED: ['SENT', 'ISSUED'],
      REJECTED: ['SENT', 'ISSUED'],
      CANCELLED: ['DRAFT', 'ISSUED', 'SENT'],
      EXPIRED: ['ISSUED', 'SENT'],
    };
    const valid = allowed[to];
    if (!valid || !valid.includes(q.status)) {
      throw new BadRequestException(`Cannot transition quotation from ${q.status} to ${to}.`);
    }
    const update: Prisma.QuotationUpdateInput = { status: to };
    const stamps: Record<string, Date | string | undefined> = {
      ACCEPTED: 'acceptedAt',
      REJECTED: 'rejectedAt',
      EXPIRED: 'expiredAt',
      CANCELLED: 'cancelledAt',
    };
    if (stamps[to]) update[stamps[to] as keyof Prisma.QuotationUpdateInput] = new Date();
    if (to === QuotationStatus.CANCELLED) {
      update.cancelledBy = userId;
      update.cancellationReason = reason;
    }
    const updated = await this.prisma.quotation.update({ where: { id }, data: update });
    await this.audit.write({ action: to, entity: 'Quotation', entityId: id, documentType: FinancialDocumentType.QUOTATION, userId, userEmail, oldValues: { status: q.status }, newValues: { status: to, reason } });
    return updated;
  }

  async convertToInvoice(id: string, userId?: string | null, userEmail?: string | null, overrides?: Partial<InvoiceCreateInput>) {
    const q = await this.get(id);
    if (q.status !== QuotationStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted quotations can be converted to an invoice.');
    }
    const invoice = await this.invoices.createFromQuotation(id, userId, userEmail, overrides);
    await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.CONVERTED_TO_INVOICE, convertedAt: new Date(), issuedById: userId ?? undefined },
    });
    await this.audit.write({ action: 'CONVERT_TO_INVOICE', entity: 'Quotation', entityId: id, documentType: FinancialDocumentType.QUOTATION, userId, userEmail, newValues: { status: QuotationStatus.CONVERTED_TO_INVOICE, invoiceId: invoice.id } });
    return { quotation: await this.get(id), invoice };
  }

  async remove(id: string, userId?: string | null, userEmail?: string | null) {
    const q = await this.get(id);
    if (q.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Only draft quotations can be deleted. Issued quotations are preserved for audit.');
    }
    await this.prisma.quotation.update({ where: { id }, data: { status: QuotationStatus.CANCELLED, cancelledAt: new Date(), cancelledBy: userId, cancellationReason: 'Deleted by operator' } });
    await this.prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    await this.audit.write({ action: 'DELETE', entity: 'Quotation', entityId: id, documentType: FinancialDocumentType.QUOTATION, userId, userEmail, oldValues: { status: q.status } });
    return { ok: true };
  }

  /** Render (and optionally persist) the customer-facing PDF. */
  async renderPdf(id: string): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const q = await this.get(id);
    if (!q.quotationNumber) {
      throw new BadRequestException('This quotation has not been issued yet — issue it to generate the PDF.');
    }
    return this.buildPdf(q);
  }

  private async buildPdf(q: any) {
    const company = await this.companyProfile.requireProfile();
    const verification = q.verificationCode
      ? {
          verificationCode: q.verificationCode,
          verificationUrl: q.verificationUrl,
          verificationQr: await this.verification.qrForUrl(q.verificationUrl),
          documentHash: q.documentHash,
        }
      : undefined;
    const result = await this.pdf.renderQuotation({
      number: q.quotationNumber,
      status: q.status,
      issuedAt: q.issueDate || q.quotationDate,
      validUntil: q.validUntil,
      reference: q.reference,
      customerReference: q.customerReference,
      company: company as PdfCompany,
      customer: q.customer,
      items: q.items,
      totals: {
        subtotal: q.subtotal,
        discount: q.discount,
        taxableAmount: q.taxableAmount,
        taxAmount: q.taxAmount,
        totalAmount: q.totalAmount,
        currency: q.currency,
        amountInWords: q.amountInWords || amountInWords(q.totalAmount, q.currency),
        taxRate: q.taxRate,
      },
      bank: q.bankAccount || (await this.bankAccounts.getDefault()),
      notes: q.notes,
      specialConditions: q.specialConditions,
      paymentTerms: q.paymentTerms || company.defaultPaymentTerms,
      validity: q.quotationValidity,
      verification,
    });
    return result;
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

  private async _render(
    q: any,
    number: string,
    persist: boolean,
    userId?: string | null,
    userEmail?: string | null,
    meta?: { action: string; toStatus: QuotationStatus },
  ) {
    const company = await this.companyProfile.requireProfile();
    const verification = await this.verification.generateVerification({
      documentType: FinancialDocumentType.QUOTATION,
      documentId: q.id,
      documentNumber: number,
      totalAmount: q.totalAmount,
      currency: q.currency,
      customerName: q.customer?.name,
      issuedAt: new Date().toISOString(),
    });
    const bank = q.bankAccount || (await this.bankAccounts.getDefault());
    const rendered = await this.pdf.renderQuotation({
      number,
      status: QuotationStatus.ISSUED,
      issuedAt: new Date(),
      validUntil: q.validUntil,
      reference: q.reference,
      customerReference: q.customerReference,
      company: company as PdfCompany,
      customer: q.customer || { name: '' },
      items: q.items,
      totals: {
        subtotal: q.subtotal,
        discount: q.discount,
        taxableAmount: q.taxableAmount,
        taxAmount: q.taxAmount,
        totalAmount: q.totalAmount,
        currency: q.currency,
        amountInWords: amountInWords(q.totalAmount, q.currency),
        taxRate: q.taxRate,
      },
      bank,
      notes: q.notes,
      specialConditions: q.specialConditions,
      paymentTerms: q.paymentTerms || company.defaultPaymentTerms,
      validity: q.quotationValidity,
      verification,
    });

    const updated = await this.prisma.quotation.update({
      where: { id: q.id },
      data: {
        quotationNumber: number,
        status: meta?.toStatus ?? QuotationStatus.ISSUED,
        issueDate: new Date(),
        issuedById: userId ?? undefined,
        pdfUrl: rendered.url,
        pdfPublicId: rendered.publicId,
        verificationCode: verification.verificationCode,
        documentHash: verification.documentHash,
        verificationUrl: verification.verificationUrl,
        amountInWords: amountInWords(q.totalAmount, q.currency),
      },
    });

    await this.prisma.financialDocumentVersion.create({
      data: {
        documentType: FinancialDocumentType.QUOTATION,
        documentId: q.id,
        documentNumber: number,
        version: (await this.versionCount(q.id)) + 1,
        pdfUrl: rendered.url,
        dataSnapshot: {
          number,
          totalAmount: q.totalAmount,
          customerId: q.customerId,
          itemsCount: q.items?.length ?? 0,
        },
        templateId: q.templateId ?? undefined,
        generatedById: userId ?? undefined,
        sourceFile: `SMART_TECH_Quotation_${number}.pdf`,
      },
    });

    await this.audit.write({ action: meta?.action ?? 'ISSUE', entity: 'Quotation', entityId: q.id, documentType: FinancialDocumentType.QUOTATION, userId, userEmail, oldValues: { status: q.status }, newValues: { status: meta?.toStatus ?? QuotationStatus.ISSUED, quotationNumber: number } });
    return updated;
  }

  private async versionCount(id: string): Promise<number> {
    const count = await this.prisma.financialDocumentVersion.count({ where: { documentId: id, documentType: FinancialDocumentType.QUOTATION } });
    return count;
  }
}