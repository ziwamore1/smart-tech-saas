import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialDocumentType, FinancialReceiptStatus, FinancialPaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialNumberingService } from './financial-numbering.service';
import { FinancialPdfService, PdfCompany } from './financial-pdf.service';
import { FinancialVerificationService } from './financial-verification.service';
import { FinancialAuditService } from './financial-audit.service';
import { CompanyProfileService } from './company-profile.service';
import { amountInWords } from '../utils/amount-in-words';

@Injectable()
export class FinancialReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: FinancialNumberingService,
    private readonly pdf: FinancialPdfService,
    private readonly verification: FinancialVerificationService,
    private readonly audit: FinancialAuditService,
    private readonly companyProfile: CompanyProfileService,
  ) {}

  async list(query: { invoiceId?: string; customerId?: string; status?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const where: any = {};
    if (query?.invoiceId) where.invoiceId = query.invoiceId;
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.status) where.status = query.status as FinancialReceiptStatus;
    if (query?.from || query?.to) {
      where.receiptDate = {};
      if (query.from) where.receiptDate.gte = new Date(query.from);
      if (query.to) where.receiptDate.lte = new Date(query.to);
    }
    const page = Math.max(1, query?.page || 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize || 20));
    const [total, rows] = await Promise.all([
      this.prisma.financialReceipt.count({ where }),
      this.prisma.financialReceipt.findMany({
        where,
        orderBy: { receiptDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
          payment: { select: { id: true, paymentNumber: true, amount: true, status: true } },
        },
      }),
    ]);
    return { items: rows, total, page, pageSize };
  }

  async get(id: string) {
    const receipt = await this.prisma.financialReceipt.findUnique({
      where: { id },
      include: { customer: true, invoice: { include: { customer: true } }, payment: true, quotation: true },
    });
    if (!receipt) throw new NotFoundException('Receipt not found.');
    return receipt;
  }

  async getByPayment(paymentId: string) {
    return this.prisma.financialReceipt.findUnique({ where: { paymentId } });
  }

  async issueReceipt(paymentId: string, userId?: string | null, userEmail?: string | null) {
    const payment = await this.prisma.financialPayment.findUnique({
      where: { id: paymentId },
      include: { invoice: { include: { customer: true } }, customer: true },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (payment.status !== FinancialPaymentStatus.CONFIRMED) {
      throw new BadRequestException('A receipt can only be issued for a confirmed payment.');
    }
    const existing = await this.getByPayment(paymentId);
    if (existing) {
      throw new BadRequestException(`A receipt (${existing.receiptNumber}) has already been issued for this payment.`);
    }

    const num = await this.numbering.nextNumber(FinancialDocumentType.PAYMENT_RECEIPT);
    const company = await this.companyProfile.requireProfile();
    const verification = await this.verification.generateVerification({
      documentType: FinancialDocumentType.PAYMENT_RECEIPT,
      documentId: paymentId,
      documentNumber: num.number,
      totalAmount: payment.amount,
      currency: payment.currency,
      customerName: payment.customer?.name,
      issuedAt: new Date().toISOString(),
    });
    const bank = payment.bankReference
      ? await this.prisma.bankAccount.findFirst({ where: { isDefault: true, isActive: true } }).catch(() => null)
      : null;

    const rendered = await this.pdf.renderReceipt({
      number: num.number,
      status: 'ISSUED',
      receiptDate: new Date(),
      paymentDate: payment.paymentDate,
      invoiceNumber: payment.invoice?.invoiceNumber,
      company: company as PdfCompany,
      customer: (payment.invoice?.customer || payment.customer || { name: '' }) as PdfCompany,
      amountReceived: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.method,
      transactionReference: payment.transactionReference,
      bankName: bank?.bankName ?? undefined,
      accountName: bank?.accountName ?? undefined,
      accountLast4: bank?.accountNumber ? String(bank.accountNumber).slice(-4) : undefined,
      description: payment.notes,
      verification,
    });

    const receipt = await this.prisma.financialReceipt.create({
      data: {
        receiptNumber: num.number,
        paymentId,
        invoiceId: payment.invoiceId,
        quotationId: payment.quotationId ?? undefined,
        customerId: payment.customerId,
        receiptDate: new Date(),
        paymentDate: payment.paymentDate,
        amountReceived: payment.amount,
        currency: payment.currency,
        amountInWords: amountInWords(payment.amount, payment.currency),
        paymentMethod: payment.method,
        transactionReference: payment.transactionReference ?? undefined,
        bankName: bank?.bankName,
        accountName: bank?.accountName,
        accountLast4: bank?.accountNumber ? String(bank.accountNumber).slice(-4) : undefined,
        description: payment.notes,
        status: FinancialReceiptStatus.ISSUED,
        issuedById: userId ?? undefined,
        issuedAt: new Date(),
        pdfUrl: rendered.url,
        pdfPublicId: rendered.publicId,
        verificationCode: verification.verificationCode,
        documentHash: verification.documentHash,
        verificationUrl: verification.verificationUrl,
      },
    });

    await this.prisma.financialDocumentVersion.create({
      data: {
        documentType: FinancialDocumentType.PAYMENT_RECEIPT,
        documentId: receipt.id,
        documentNumber: num.number,
        version: 1,
        pdfUrl: rendered.url,
        dataSnapshot: { number: num.number, amount: payment.amount, paymentNumber: payment.paymentNumber },
        generatedById: userId ?? undefined,
        sourceFile: `SMART_TECH_Receipt_${num.number}.pdf`,
      },
    });

    await this.audit.write({
      action: 'ISSUE',
      entity: 'FinancialReceipt',
      entityId: receipt.id,
      documentType: FinancialDocumentType.PAYMENT_RECEIPT,
      userId,
      userEmail,
      newValues: { receiptNumber: num.number, amount: payment.amount, paymentNumber: payment.paymentNumber },
    });
    return receipt;
  }

  async voidReceipt(id: string, reason?: string, userId?: string | null, userEmail?: string | null) {
    const receipt = await this.get(id);
    if (receipt.status !== FinancialReceiptStatus.ISSUED) {
      throw new BadRequestException('Only issued receipts can be voided.');
    }
    if (!reason) throw new BadRequestException('A void reason is required.');

    const company = await this.companyProfile.requireProfile();
    const verification = receipt.verificationCode
      ? { verificationCode: receipt.verificationCode, verificationUrl: receipt.verificationUrl, verificationQr: await this.verification.qrForUrl(receipt.verificationUrl), documentHash: receipt.documentHash }
      : undefined;
    const rendered = await this.pdf.renderReceipt({
      number: receipt.receiptNumber,
      status: 'VOID',
      receiptDate: receipt.receiptDate,
      paymentDate: receipt.paymentDate,
      invoiceNumber: receipt.invoice?.invoiceNumber,
      company: company as PdfCompany,
      customer: (receipt.customer || { name: '' }) as PdfCompany,
      amountReceived: receipt.amountReceived,
      currency: receipt.currency,
      paymentMethod: receipt.paymentMethod,
      transactionReference: receipt.transactionReference,
      bankName: receipt.bankName,
      accountName: receipt.accountName,
      accountLast4: receipt.accountLast4,
      notes: reason,
      verification,
    });

    const updated = await this.prisma.financialReceipt.update({
      where: { id },
      data: {
        status: FinancialReceiptStatus.VOID,
        voidedAt: new Date(),
        voidedById: userId ?? undefined,
        voidReason: reason,
        pdfUrl: rendered.url,
        pdfPublicId: rendered.publicId,
      },
    });
    await this.audit.write({ action: 'VOID', entity: 'FinancialReceipt', entityId: id, documentType: FinancialDocumentType.PAYMENT_RECEIPT, userId, userEmail, oldValues: { status: FinancialReceiptStatus.ISSUED }, newValues: { status: FinancialReceiptStatus.VOID, reason } });
    return updated;
  }

  async renderPdf(id: string): Promise<{ buffer: Buffer; url: string | null; publicId: string | null }> {
    const receipt = await this.get(id);
    const company = await this.companyProfile.requireProfile();
    const verification = receipt.verificationCode
      ? { verificationCode: receipt.verificationCode, verificationUrl: receipt.verificationUrl, verificationQr: await this.verification.qrForUrl(receipt.verificationUrl), documentHash: receipt.documentHash }
      : undefined;
    return this.pdf.renderReceipt({
      number: receipt.receiptNumber,
      status: receipt.status,
      receiptDate: receipt.receiptDate,
      paymentDate: receipt.paymentDate,
      invoiceNumber: receipt.invoice?.invoiceNumber,
      company: company as PdfCompany,
      customer: (receipt.customer || { name: '' }) as PdfCompany,
      amountReceived: receipt.amountReceived,
      currency: receipt.currency,
      paymentMethod: receipt.paymentMethod,
      transactionReference: receipt.transactionReference,
      bankName: receipt.bankName,
      accountName: receipt.accountName,
      accountLast4: receipt.accountLast4,
      notes: receipt.notes,
      verification,
    });
  }
}