import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialDocumentType, FinancialPaymentMethod, FinancialPaymentStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialNumberingService } from './financial-numbering.service';
import { FinancialAuditService } from './financial-audit.service';

export interface RecordPaymentInput {
  invoiceId: string;
  quotationId?: string;
  customerId: string;
  amount: number;
  paymentDate?: Date | string;
  method?: FinancialPaymentMethod;
  transactionReference?: string;
  bankReference?: string;
  notes?: string;
}

@Injectable()
export class FinancialPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: FinancialNumberingService,
    private readonly audit: FinancialAuditService,
  ) {}

  async list(query: { status?: string; invoiceId?: string; customerId?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const where: Prisma.FinancialPaymentWhereInput = {};
    if (query?.status) where.status = query.status as FinancialPaymentStatus;
    if (query?.invoiceId) where.invoiceId = query.invoiceId;
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.from || query?.to) {
      where.paymentDate = {};
      if (query.from) where.paymentDate.gte = new Date(query.from);
      if (query.to) where.paymentDate.lte = new Date(query.to);
    }
    const page = Math.max(1, query?.page || 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize || 20));
    const [total, rows] = await Promise.all([
      this.prisma.financialPayment.count({ where }),
      this.prisma.financialPayment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true, status: true } },
          receipts: true,
        },
      }),
    ]);
    return { items: rows, total, page, pageSize };
  }

  async get(id: string) {
    const payment = await this.prisma.financialPayment.findUnique({
      where: { id },
      include: { customer: true, invoice: { include: { customer: true } }, quotation: true, allocations: true, receipts: true },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  async recordPayment(input: RecordPaymentInput, userId?: string | null, userEmail?: string | null) {
    const amount = Number(input.amount.toFixed ? input.amount.toFixed(2) : Number(input.amount).toFixed(2));
    if (!(amount > 0)) throw new BadRequestException('Payment amount must be greater than zero.');
    const invoice = await this.prisma.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.balanceDue <= 0) throw new BadRequestException('This invoice has no outstanding balance.');
    if (amount > invoice.balanceDue + 0.005) {
      throw new BadRequestException(`Payment of ${amount} exceeds the outstanding balance of ${invoice.balanceDue}.`);
    }

    const paymentNumber = await this.numbering.nextPaymentIdentifier();
    const payment = await this.prisma.financialPayment.create({
      data: {
        paymentNumber,
        invoiceId: input.invoiceId,
        quotationId: input.quotationId ?? undefined,
        customerId: input.customerId,
        paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
        amount,
        method: input.method ?? FinancialPaymentMethod.BANK_TRANSFER,
        transactionReference: input.transactionReference,
        bankReference: input.bankReference,
        notes: input.notes,
        status: FinancialPaymentStatus.PENDING,
        receivedById: userId ?? undefined,
      },
    });
    await this.audit.write({
      action: 'RECORD',
      entity: 'FinancialPayment',
      entityId: payment.id,
      documentType: FinancialDocumentType.INVOICE,
      documentId: invoice.id,
      documentNumber: invoice.invoiceNumber || undefined,
      userId,
      userEmail,
      newValues: { paymentNumber, amount, status: FinancialPaymentStatus.PENDING },
    });
    return payment;
  }

  /** Move a recorded payment into the confirmation pipeline. */
  async updateStatus(id: string, to: FinancialPaymentStatus, reason?: string, userId?: string | null, userEmail?: string | null) {
    const payment = await this.get(id);
    const allowed: Record<FinancialPaymentStatus, FinancialPaymentStatus[]> = {
      [FinancialPaymentStatus.PENDING]: [],
      [FinancialPaymentStatus.SUBMITTED]: [FinancialPaymentStatus.PENDING],
      [FinancialPaymentStatus.UNDER_REVIEW]: [FinancialPaymentStatus.SUBMITTED],
      [FinancialPaymentStatus.CONFIRMED]: [FinancialPaymentStatus.PENDING, FinancialPaymentStatus.SUBMITTED, FinancialPaymentStatus.UNDER_REVIEW],
      [FinancialPaymentStatus.REJECTED]: [FinancialPaymentStatus.PENDING, FinancialPaymentStatus.SUBMITTED, FinancialPaymentStatus.UNDER_REVIEW],
      [FinancialPaymentStatus.REVERSED]: [FinancialPaymentStatus.CONFIRMED],
    };
    if (!allowed[to].includes(payment.status as FinancialPaymentStatus)) {
      throw new BadRequestException(`Cannot move payment from ${payment.status} to ${to}.`);
    }

    if (to === FinancialPaymentStatus.REJECTED) {
      const updated = await this.prisma.financialPayment.update({
        where: { id },
        data: { status: to, rejectionReason: reason, confirmedById: userId ?? undefined },
      });
      await this.audit.write({ action: 'REJECT', entity: 'FinancialPayment', entityId: id, userId, userEmail, oldValues: { status: payment.status }, newValues: { status: to, reason } });
      return updated;
    }
    if (to === FinancialPaymentStatus.REVERSED) {
      return this.reverse(id, reason, userId, userEmail);
    }
    if (to === FinancialPaymentStatus.CONFIRMED) {
      return this.confirm(id, userId, userEmail);
    }

    const updated = await this.prisma.financialPayment.update({ where: { id }, data: { status: to } });
    await this.audit.write({ action: to, entity: 'FinancialPayment', entityId: id, userId, userEmail, oldValues: { status: payment.status }, newValues: { status: to } });
    return updated;
  }

  async confirm(id: string, userId?: string | null, userEmail?: string | null) {
    const payment = await this.get(id);
    const confirmableStatuses: FinancialPaymentStatus[] = [FinancialPaymentStatus.PENDING, FinancialPaymentStatus.SUBMITTED, FinancialPaymentStatus.UNDER_REVIEW];
    if (!confirmableStatuses.includes(payment.status as FinancialPaymentStatus)) {
      throw new BadRequestException(`Payment cannot be confirmed from status ${payment.status}.`);
    }
    const invoice = payment.invoice;
    if (!invoice || invoice.status === 'VOID' || invoice.status === 'CANCELLED') {
      throw new BadRequestException('Payment cannot be confirmed against a voided or cancelled invoice.');
    }

    const confirmed = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.invoice.findUnique({ where: { id: invoice.id } });
      if (!fresh || fresh.balanceDue < payment.amount - 0.005) {
        throw new BadRequestException('Invoice balance changed — payment exceeds outstanding balance.');
      }
      const p = await tx.financialPayment.update({
        where: { id },
        data: {
          status: FinancialPaymentStatus.CONFIRMED,
          confirmedById: userId ?? undefined,
          confirmedAt: new Date(),
        },
      });
      await tx.paymentAllocation.create({
        data: { paymentId: id, invoiceId: invoice.id, amount: payment.amount },
      });
      const amountPaid = Number((fresh.amountPaid + payment.amount).toFixed(2));
      const balanceDue = Number((fresh.balanceDue - payment.amount).toFixed(2));
      const nextStatus: InvoiceStatus = balanceDue <= 0.005 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid,
          balanceDue: Math.max(balanceDue, 0),
          status: nextStatus,
          paidAt: balanceDue <= 0.005 ? new Date() : undefined,
        },
      });
      return { p, updatedInvoice };
    });

    await this.audit.write({
      action: 'CONFIRM',
      entity: 'FinancialPayment',
      entityId: payment.id,
      documentType: FinancialDocumentType.INVOICE,
      documentId: invoice.id,
      documentNumber: invoice.invoiceNumber || undefined,
      userId,
      userEmail,
      oldValues: { status: payment.status },
      newValues: { status: FinancialPaymentStatus.CONFIRMED, amount: payment.amount, invoiceStatus: confirmed.updatedInvoice.status },
    });
    return confirmed.p;
  }

  async reverse(id: string, reason?: string, userId?: string | null, userEmail?: string | null) {
    const payment = await this.get(id);
    if (payment.status !== FinancialPaymentStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed payments can be reversed.');
    }
    if (!reason) throw new BadRequestException('A reversal reason is required.');

    const reversed = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
      const amountPaid = Number((Math.max((invoice?.amountPaid || 0) - payment.amount, 0)).toFixed(2));
      const balanceDue = Number(((invoice?.balanceDue || 0) + payment.amount).toFixed(2));
      const nextStatus: InvoiceStatus =
        invoice?.status === 'PAID' ? InvoiceStatus.PARTIALLY_PAID
        : (invoice?.status === InvoiceStatus.PARTIALLY_PAID || invoice?.status === InvoiceStatus.ISSUED || invoice?.status === InvoiceStatus.SENT)
          ? invoice.status
          : InvoiceStatus.PARTIALLY_PAID;

      const p = await tx.financialPayment.update({
        where: { id },
        data: {
          status: FinancialPaymentStatus.REVERSED,
          reversalReason: reason,
          reversedAt: new Date(),
          reversedById: userId ?? undefined,
        },
      });
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { amountPaid, balanceDue, status: nextStatus, paidAt: null },
      });
      const receipt = await tx.financialReceipt.findUnique({ where: { paymentId: id } });
      if (receipt && receipt.status === 'ISSUED') {
        await tx.financialReceipt.update({
          where: { id: receipt.id },
          data: { status: 'VOID', voidedAt: new Date(), voidedById: userId ?? undefined, voidReason: `Payment reversed: ${reason}` },
        });
      }
      return p;
    });

    await this.audit.write({
      action: 'REVERSE',
      entity: 'FinancialPayment',
      entityId: id,
      documentType: FinancialDocumentType.INVOICE,
      documentId: payment.invoiceId,
      documentNumber: payment.invoice?.invoiceNumber || undefined,
      userId,
      userEmail,
      oldValues: { status: payment.status, amount: payment.amount },
      newValues: { status: FinancialPaymentStatus.REVERSED, reason },
    });
    return reversed;
  }

  async remove(id: string, userId?: string | null, userEmail?: string | null) {
    const payment = await this.get(id);
    if (payment.status !== FinancialPaymentStatus.PENDING) {
      throw new BadRequestException('Only pending (unconfirmed) payments can be removed.');
    }
    await this.prisma.financialPayment.delete({ where: { id } });
    await this.audit.write({ action: 'DELETE', entity: 'FinancialPayment', entityId: id, userId, userEmail, oldValues: { paymentNumber: payment.paymentNumber, amount: payment.amount } });
    return { ok: true };
  }

  async outstandingByCustomer(query?: { from?: string; to?: string }) {
    const where: Prisma.InvoiceWhereInput = { status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID'] } };
    if (query?.from || query?.to) {
      where.dueDate = {};
      if (query.from) where.dueDate.gte = new Date(query.from);
      if (query.to) where.dueDate.lte = new Date(query.to);
    }
    const invoices = await this.prisma.invoice.findMany({
      where,
      select: { customerId: true, customer: { select: { name: true } }, balanceDue: true, currency: true, id: true, invoiceNumber: true, dueDate: true },
    });
    return invoices;
  }
}