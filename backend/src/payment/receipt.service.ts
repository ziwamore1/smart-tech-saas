import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface ReceiptData {
  receiptNumber: string;
  invoiceNumber?: string;
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  customerName: string;
  customerEmail?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentReference?: string;
  paidAt: Date;
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

@Injectable()
export class ReceiptService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RCP-${timestamp}-${random}`;
  }

  async generateReceiptForPayment(paymentId: string): Promise<ReceiptData> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: {
          include: {
            school: true,
            plan: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const school = payment.subscription?.school;
    const plan = payment.subscription?.plan;

    const receiptNumber = this.generateReceiptNumber();

    const items: ReceiptItem[] = [
      {
        description: `${plan?.displayName || 'Subscription'} - Monthly Plan`,
        quantity: 1,
        unitPrice: payment.amount,
        total: payment.amount,
      },
    ];

    const subtotal = payment.amount;
    const tax = 0;
    const total = payment.amount;

    const receipt = await this.prisma.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber,
        invoiceNumber: `INV-${Date.now()}`,
        schoolName: school?.name || 'School',
        schoolAddress: school?.address || undefined,
        schoolPhone: school?.phone || undefined,
        schoolEmail: school?.email || undefined,
        customerName: `${school?.name || 'Customer'}`,
        customerEmail: school?.email || undefined,
        items: items as any,
        subtotal,
        tax,
        total,
        paymentMethod: payment.paymentMethod || 'CARD',
        paymentReference: payment.flutterwaveTransactionId || payment.id,
      },
    });

    return {
      receiptNumber: receipt.receiptNumber,
      invoiceNumber: receipt.invoiceNumber || undefined,
      schoolName: receipt.schoolName,
      schoolAddress: receipt.schoolAddress || undefined,
      schoolPhone: receipt.schoolPhone || undefined,
      schoolEmail: receipt.schoolEmail || undefined,
      customerName: receipt.customerName,
      customerEmail: receipt.customerEmail || undefined,
      items: receipt.items as unknown as ReceiptItem[],
      subtotal: receipt.subtotal,
      tax: receipt.tax,
      total: receipt.total,
      paymentMethod: receipt.paymentMethod,
      paymentReference: receipt.paymentReference || undefined,
      paidAt: payment.paidAt || new Date(),
    };
  }

  async generatePDF(receiptData: ReceiptData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('RECEIPT', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text(receiptData.schoolName, { align: 'center' });
      if (receiptData.schoolAddress) {
        doc.text(receiptData.schoolAddress, { align: 'center' });
      }
      if (receiptData.schoolPhone || receiptData.schoolEmail) {
        doc.text(
          [receiptData.schoolPhone, receiptData.schoolEmail]
            .filter(Boolean)
            .join(' | '),
          { align: 'center' },
        );
      }
      doc.moveDown();

      doc.fontSize(10).text('-'.repeat(50));
      doc.moveDown();

      doc.fontSize(12).text(`Receipt Number: ${receiptData.receiptNumber}`);
      if (receiptData.invoiceNumber) {
        doc.text(`Invoice Number: ${receiptData.invoiceNumber}`);
      }
      doc.text(`Date: ${receiptData.paidAt.toLocaleDateString()}`);
      doc.text(`Time: ${receiptData.paidAt.toLocaleTimeString()}`);
      doc.moveDown();

      doc.fontSize(10).text('-'.repeat(50));
      doc.moveDown();

      doc.text('BILL TO:', { underline: true });
      doc.text(receiptData.customerName);
      if (receiptData.customerEmail) {
        doc.text(receiptData.customerEmail);
      }
      doc.moveDown();

      doc.fontSize(10).text('-'.repeat(50));
      doc.moveDown();

      doc.fontSize(11).text('ITEMS', { underline: true });
      doc.moveDown(0.5);

      for (const item of receiptData.items) {
        doc.text(`${item.description}`);
        doc.text(
          `Qty: ${item.quantity} x ${this.formatCurrency(item.unitPrice)} = ${this.formatCurrency(item.total)}`,
          { align: 'right' },
        );
        doc.moveDown(0.5);
      }

      doc.fontSize(10).text('-'.repeat(50));
      doc.moveDown();

      doc.text('Subtotal:', { continued: true, align: 'right' });
      doc.text(this.formatCurrency(receiptData.subtotal), { align: 'right' });

      if (receiptData.tax > 0) {
        doc.text('Tax:', { continued: true, align: 'right' });
        doc.text(this.formatCurrency(receiptData.tax), { align: 'right' });
      }

      doc.fontSize(14).text('TOTAL:', { continued: true, align: 'right' });
      doc
        .fontSize(14)
        .text(this.formatCurrency(receiptData.total), { align: 'right' });
      doc.moveDown();

      doc.fontSize(10).text('-'.repeat(50));
      doc.moveDown();

      doc.text(`Payment Method: ${receiptData.paymentMethod}`);
      if (receiptData.paymentReference) {
        doc.text(`Payment Reference: ${receiptData.paymentReference}`);
      }
      doc.moveDown(2);

      doc.fontSize(10).text('Thank you for your payment!', { align: 'center' });
      doc.text('Smart Tech School SaaS', { align: 'center' });
      doc.text('www.smarttechschools.com', { align: 'center' });

      doc.end();
    });
  }

  private formatCurrency(amount: number): string {
    return `ZMW ${amount.toFixed(2)}`;
  }

  async getReceiptById(id: string) {
    return this.prisma.receipt.findUnique({
      where: { id },
    });
  }

  async getReceiptByNumber(receiptNumber: string) {
    return this.prisma.receipt.findUnique({
      where: { receiptNumber },
    });
  }

  async getSchoolReceipts(schoolId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        subscription: { schoolId },
        status: 'COMPLETED',
      },
      include: { receipt: true },
      orderBy: { paidAt: 'desc' },
    });

    return payments.filter((p) => p.receipt).map((p) => p.receipt);
  }
}
