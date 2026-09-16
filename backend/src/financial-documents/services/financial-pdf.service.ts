import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { FINANCIAL_DOCUMENTS_FOLDER } from '../constants';
import { amountInWords, formatAmount, roundMoney } from '../utils/amount-in-words';

export interface PdfCompany {
  legalName?: string | null;
  tradingName?: string | null;
  logoUrl?: string | null;
  companyRegistrationNumber?: string | null;
  tpin?: string | null;
  physicalAddress?: string | null;
  postalAddress?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  watermarkText?: string | null;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  defaultTerms?: string | null;
  defaultPaymentTerms?: string | null;
  authorizedSignatoryName?: string | null;
  authorizedSignatoryRole?: string | null;
  zraIdentityNumber?: string | null;
}

export interface PdfBank {
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  branch?: string | null;
  branchCode?: string | null;
  swiftCode?: string | null;
  currency?: string | null;
}

export interface PdfLineItem {
  itemName?: string | null;
  description?: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  discount: number;
  taxRate?: number | null;
  taxAmount: number;
  subtotal: number;
  lineTotal: number;
}

export interface PdfTotals {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  amountInWords?: string | null;
  taxRate?: number | null;
}

export interface PdfVerification {
  verificationCode?: string | null;
  verificationUrl?: string | null;
  verificationQr?: string | null;
  documentHash?: string | null;
}

export interface PdfRenderResult {
  buffer: Buffer;
  url: string | null;
  publicId: string | null;
}

@Injectable()
export class FinancialPdfService {
  private readonly logger = new Logger(FinancialPdfService.name);

  constructor(private readonly cloudinary: CloudinaryService) {}

  async renderQuotation(input: {
    number: string;
    status: string;
    issuedAt?: Date | null;
    validUntil?: Date | null;
    reference?: string | null;
    customerReference?: string | null;
    company: PdfCompany;
    customer: { name?: string; legalName?: string | null; address?: string | null; postalAddress?: string | null; city?: string | null; province?: string | null; country?: string | null; contactPerson?: string | null; email?: string | null; phone?: string | null };
    items: PdfLineItem[];
    totals: PdfTotals;
    bank?: PdfBank | null;
    notes?: string | null;
    specialConditions?: string | null;
    paymentTerms?: string | null;
    validity?: string | null;
    verification?: PdfVerification;
  }): Promise<PdfRenderResult> {
    const html = this.baseDocument({
      company: input.company,
      primaryTitle: 'QUOTATION',
      number: input.number,
      status: input.status,
      companyAddressBlock: this.addressBlock(input.company),
      detailsBlock: this.detailsBlock([
        ['Quotation Date', input.issuedAt ? new Date(input.issuedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')],
        ['Valid Until', input.validUntil ? new Date(input.validUntil).toLocaleDateString('en-GB') : (input.validity || '')],
        ['Reference', input.reference || ''],
        ['Customer Ref', input.customerReference || ''],
      ]),
      customerBlock: this.customerBlock(input.customer),
      itemsTable: this.itemsTable(input.items, input.totals),
      bankBlock: input.bank ? this.bankBlock(input.bank) : '',
      notesBlock: this.notesBlock({
        notes: input.notes,
        paymentTerms: input.paymentTerms,
        specialConditions: input.specialConditions,
        terms: input.company.defaultTerms,
      }),
      verification: input.verification,
      watermark: input.company.watermarkText,
    });
    return this.renderToPdf(html, `SMART_TECH_Quotation_${input.number}.pdf`);
  }

  async renderInvoice(input: {
    number: string;
    status: string;
    invoiceDate?: Date | null;
    dueDate?: Date | null;
    orderReference?: string | null;
    purchaseReference?: string | null;
    company: PdfCompany;
    customer: PdfCompany;
    items: PdfLineItem[];
    totals: PdfTotals;
    amountPaid: number;
    balanceDue: number;
    bank?: PdfBank | null;
    notes?: string | null;
    paymentTerms?: string | null;
    serviceTerms?: string | null;
    verification?: PdfVerification;
  }): Promise<PdfRenderResult> {
    const html = this.baseDocument({
      company: input.company,
      primaryTitle: 'INVOICE',
      number: input.number,
      status: input.status,
      companyAddressBlock: this.addressBlock(input.company),
      detailsBlock: this.detailsBlock([
        ['Invoice Date', input.invoiceDate ? new Date(input.invoiceDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')],
        ['Due Date', input.dueDate ? new Date(input.dueDate).toLocaleDateString('en-GB') : ''],
        ['Order Ref', input.orderReference || ''],
        ['PO Ref', input.purchaseReference || ''],
      ]),
      customerBlock: this.customerBlock(input.customer),
      itemsTable: this.itemsTable(input.items, {
        ...input.totals,
        extraRow: ['Amount Paid', `(${formatAmount(input.amountPaid, input.totals.currency)})`],
        extraRowBold: ['Balance Due', formatAmount(input.balanceDue, input.totals.currency)],
      } as any),
      bankBlock: input.bank ? this.bankBlock(input.bank) : '',
      notesBlock: this.notesBlock({
        notes: input.notes,
        paymentTerms: input.paymentTerms || input.company.defaultPaymentTerms,
        specialConditions: input.serviceTerms,
        terms: input.company.defaultTerms,
      }),
      verification: input.verification,
      watermark: input.company.watermarkText,
    });
    return this.renderToPdf(html, `SMART_TECH_Invoice_${input.number}.pdf`);
  }

  async renderReceipt(input: {
    number: string;
    status: string;
    receiptDate?: Date | null;
    paymentDate?: Date | null;
    invoiceNumber?: string | null;
    company: PdfCompany;
    customer: PdfCompany;
    amountReceived: number;
    amountInWordsText?: string | null;
    currency: string;
    paymentMethod: string;
    transactionReference?: string | null;
    bankName?: string | null;
    accountName?: string | null;
    accountLast4?: string | null;
    description?: string | null;
    notes?: string | null;
    verification?: PdfVerification;
  }): Promise<PdfRenderResult> {
    const html = this.baseDocument({
      company: input.company,
      primaryTitle: 'PAYMENT RECEIPT',
      number: input.number,
      status: input.status,
      companyAddressBlock: this.addressBlock(input.company),
      detailsBlock: this.detailsBlock([
        ['Receipt Date', input.receiptDate ? new Date(input.receiptDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')],
        ['Payment Date', input.paymentDate ? new Date(input.paymentDate).toLocaleDateString('en-GB') : ''],
        ['Invoice', input.invoiceNumber || ''],
      ]),
      customerBlock: this.customerBlock(input.customer),
      itemsTable: this.receiptBlock({
        amountReceived: input.amountReceived,
        amountInWordsText: input.amountInWordsText || amountInWords(input.amountReceived, input.currency),
        currency: input.currency,
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        bankName: input.bankName,
        accountName: input.accountName,
        accountLast4: input.accountLast4,
        description: input.description,
        notes: input.notes,
      }),
      bankBlock: '',
      notesBlock: '',
verification: input.verification,
      watermark: input.company.watermarkText,
    });
    return this.renderToPdf(html, `SMART_TECH_Receipt_${input.number}.pdf`);
  }

  async renderToPdf(html: string, fileName?: string): Promise<PdfRenderResult> {
    const browser = await this.launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    try {
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' as any, timeout: 45000 });
      } catch {
        await page.setContent(html, { waitUntil: 'domcontentloaded' as any, timeout: 60000 });
      }
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      await browser.close();
      const buffer = Buffer.from(pdf);
      try {
        const uploaded = await this.cloudinary.uploadBuffer(buffer, {
          folder: FINANCIAL_DOCUMENTS_FOLDER,
          publicId: `financial-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          resourceType: 'raw',
        });
        return { buffer, url: uploaded.secureUrl, publicId: uploaded.publicId };
      } catch (err: any) {
        this.logger.warn(`Cloudinary upload failed, returning buffer only: ${err?.message}`);
        return { buffer, url: null, publicId: null };
      }
    } catch (err: any) {
      await browser.close().catch(() => undefined);
      throw new Error(`PDF rendering failed: ${err?.message}`);
    }
  }

  private async launchBrowser() {
    const userDataDir = path.join(os.tmpdir(), `fd-puppeteer-${crypto.randomBytes(8).toString('hex')}`);
    return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      userDataDir,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
      timeout: 120000,
    });
  }

  private escapeHtml(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private addressBlock(c: PdfCompany): string {
    const lines = [c.physicalAddress, c.postalAddress, [c.city, c.province].filter(Boolean).join(', '), c.country].filter((l: any) => l);
    return lines.map((l: any) => this.escapeHtml(l)).join('<br/>');
  }

  private detailsBlock(rows: Array<[string, string]>): string {
    const body = rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<div class="detail-row"><span class="detail-key">${this.escapeHtml(k)}</span><span class="detail-val">${this.escapeHtml(v)}</span></div>`)
      .join('');
    return `<div class="details">${body}</div>`;
  }

  private customerBlock(c: any): string {
    const lines = [
      c.name || c.legalName,
      c.address,
      c.city && c.province ? `${c.city}, ${c.province}` : c.city,
      c.country,
      c.contactPerson ? `Attn: ${c.contactPerson}` : '',
      c.email,
      c.phone,
    ].filter((l: any) => l);
    return `
      <div class="billed-to">
        <div class="billed-label">BILLED TO</div>
        ${lines.map((l: any) => `<div>${this.escapeHtml(l)}</div>`).join('')}
      </div>`;
  }

  private itemsTable(items: PdfLineItem[], totals: any): string {
    const rows = (items || [])
      .map((it) => {
        const lineTotal = roundMoney(it.quantity * it.unitPrice - it.discount + it.taxAmount);
        return `<tr>
          <td>${this.escapeHtml(it.description || it.itemName || '')}</td>
          <td class="num">${this.escapeHtml(it.quantity)}${it.unit ? ' ' + this.escapeHtml(it.unit) : ''}</td>
          <td class="num">${formatAmount(it.unitPrice, totals.currency)}</td>
          <td class="num">${it.discount ? formatAmount(it.discount, totals.currency) : '—'}</td>
          <td class="num">${it.taxRate != null ? it.taxRate + '%' : '—'}</td>
          <td class="num">${formatAmount(lineTotal, totals.currency)}</td>
        </tr>`;
      })
      .join('');

    let totalRows = `
      <tr><td colspan="5" class="total-label">Subtotal</td><td class="num">${formatAmount(totals.subtotal, totals.currency)}</td></tr>
      ${totals.discount ? `<tr><td colspan="5" class="total-label">Discount</td><td class="num">(${formatAmount(totals.discount, totals.currency)})</td></tr>` : ''}
      ${totals.taxAmount ? `<tr><td colspan="5" class="total-label">Tax (${totals.taxRate ?? ''}${totals.taxRate != null ? '%' : ''})</td><td class="num">${formatAmount(totals.taxAmount, totals.currency)}</td></tr>` : ''}
      ${totals.extraRow ? `<tr><td colspan="5" class="total-label">${this.escapeHtml(totals.extraRow[0])}</td><td class="num">${this.escapeHtml(totals.extraRow[1])}</td></tr>` : ''}
    `;
    if (totals.extraRowBold) {
      totalRows += `<tr class="grand"><td colspan="5" class="total-label">${this.escapeHtml(totals.extraRowBold[0])}</td><td class="num">${this.escapeHtml(totals.extraRowBold[1])}</td></tr>`;
      totalRows += `<tr class="grand"><td colspan="6" class="in-words">Amount In Words: ${this.escapeHtml(totals.amountInWords || amountInWords(totals.balanceDue ?? totals.totalAmount, totals.currency))}</td></tr>`;
    } else {
      totalRows += `<tr class="grand"><td colspan="5" class="total-label">Total</td><td class="num">${formatAmount(totals.totalAmount, totals.currency)}</td></tr>`;
      totalRows += `<tr class="grand"><td colspan="6" class="in-words">Amount In Words: ${this.escapeHtml(totals.amountInWords || amountInWords(totals.totalAmount, totals.currency))}</td></tr>`;
    }

    return `
      <table class="items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            <th class="num">Discount</th>
            <th class="num">Tax</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>${totalRows}</tfoot>
      </table>`;
  }

  private receiptBlock(input: {
    amountReceived: number;
    amountInWordsText: string;
    currency: string;
    paymentMethod: string;
    transactionReference?: string | null;
    bankName?: string | null;
    accountName?: string | null;
    accountLast4?: string | null;
    description?: string | null;
    notes?: string | null;
  }): string {
    const rows: Array<[string, string]> = [
      ['Amount Received', formatAmount(input.amountReceived, input.currency)],
      ['Amount In Words', input.amountInWordsText],
      ['Payment Method', input.paymentMethod],
      ['Transaction Reference', input.transactionReference || ''],
      ['Bank', [input.bankName, input.accountName, input.accountLast4 ? `****${input.accountLast4}` : ''].filter(Boolean).join(' / ')],
      ['Description', input.description || ''],
      ['Notes', input.notes || ''],
    ];
    const body = rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td class="receipt-key">${this.escapeHtml(k)}</td><td class="receipt-val">${this.escapeHtml(v)}</td></tr>`)
      .join('');
    return `<table class="receipt">${body}</table>`;
  }

  private bankBlock(bank: PdfBank): string {
    const rows = [
      ['Bank Name', bank.bankName],
      ['Account Name', bank.accountName],
      ['Account Number', bank.accountNumber],
      ['Branch', bank.branch],
      ['SWIFT / Branch Code', [bank.swiftCode, bank.branchCode].filter(Boolean).join(' / ')],
    ].filter(([, v]) => v);
    return `
      <div class="bank">
        <div class="bank-title">PAYMENT DETAILS</div>
        ${rows.map(([k, v]) => `<div class="bank-row"><span>${this.escapeHtml(k)}</span><strong>${this.escapeHtml(v)}</strong></div>`).join('')}
      </div>`;
  }

  private notesBlock(input: { notes?: string | null; paymentTerms?: string | null; specialConditions?: string | null; terms?: string | null }): string {
    const sections: Array<[string, string]> = [];
    if (input.terms) sections.push(['Terms & Conditions', input.terms]);
    if (input.paymentTerms) sections.push(['Payment Terms', input.paymentTerms]);
    if (input.specialConditions) sections.push(['Special Conditions', input.specialConditions]);
    if (input.notes) sections.push(['Notes', input.notes]);
    if (!sections.length) return '';
    return `
      <div class="notes">
        ${sections.map(([title, body]) => `<div class="notes-block"><div class="notes-title">${this.escapeHtml(title)}</div><div>${this.escapeHtml(body)}</div></div>`).join('')}
      </div>`;
  }

  private baseDocument(input: {
    company: PdfCompany;
    primaryTitle: string;
    number: string;
    status: string;
    companyAddressBlock: string;
    detailsBlock: string;
    customerBlock: string;
    itemsTable: string;
    bankBlock: string;
    notesBlock: string;
    verification?: PdfVerification;
    watermark?: string | null;
  }): string {
    const c = input.company;
    const primary = c.primaryColor || '#1e3a5f';
    const secondary = c.secondaryColor || '#c0a030';
    const displayName = c.tradingName || c.legalName || '';

    const statusBadge = input.status && input.status !== 'ISSUED' && input.status !== 'CONFIRMED' && input.status !== 'COMPLETED'
      ? `<span class="status-badge status-${this.escapeHtml(input.status).toLowerCase().replace(/[^a-z]/g, '')}">${this.escapeHtml(input.status)}</span>`
      : '';

    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; font-size: 12px; -webkit-print-color-adjust: exact; }
        .page { width: 100%; min-height: 297mm; padding: 14mm 16mm 20mm; position: relative; }
        ${input.watermark ? `.watermark { position: fixed; left: 0; right: 0; top: 38%; text-align: center; font-size: 46px; font-weight: 700; color: rgba(190,190,190,0.14); transform: rotate(-30deg); z-index: 0; pointer-events: none; letter-spacing: 6px; }` : ''}
        .content { position: relative; z-index: 1; }

        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${primary}; padding-bottom: 10px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-logo { max-height: 62px; max-width: 62px; object-fit: contain; }
        .brand-name { font-size: 20px; font-weight: 800; color: ${primary}; line-height: 1.1; }
        .brand-tag { font-size: 10px; color: #667; margin-top: 2px; letter-spacing: 0.3px; }
        .header-right { text-align: right; }
        .doc-title { font-size: 22px; font-weight: 900; color: ${primary}; letter-spacing: 1px; }
        .doc-number { font-size: 13px; font-weight: 700; margin-top: 2px; }
        .doc-number span { color: ${secondary}; }
        .company-address { font-size: 10px; color: #556; margin-top: 6px; line-height: 1.45; }

        .meta { display: flex; justify-content: space-between; margin-top: 14px; }
        .details { width: 48%; background: #f7f9fc; border-left: 3px solid ${secondary}; padding: 8px 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 2px 0; }
        .detail-key { color: #667; font-size: 10px; }
        .detail-val { font-weight: 700; font-size: 11px; }
        .billed-to { width: 48%; }
        .billed-label { font-size: 10px; font-weight: 800; color: ${primary}; letter-spacing: 1px; margin-bottom: 4px; }
        .billed-to div { font-size: 11px; line-height: 1.5; }

        .items { width: 100%; border-collapse: collapse; margin-top: 14px; }
        .items thead th { background: ${primary}; color: #fff; padding: 7px 8px; font-size: 10px; text-align: left; }
        .items thead th.num, .items td.num { text-align: right; }
        .items td { padding: 6px 8px; border-bottom: 1px solid #e5e9f0; font-size: 10.5px; }
        .items tbody tr:nth-child(even) { background: #f8fafd; }
        .items tfoot td { padding: 4px 8px; font-size: 11px; }
        .items tfoot .total-label { text-align: right; }
        .items tfoot td.num { font-weight: 700; }
        .items tr.grand td { font-weight: 900; font-size: 12.5px; color: ${primary}; border-top: 2px solid ${primary}; border-bottom: 2px solid ${primary}; }
        .items tr.grand .in-words { font-weight: 600; font-size: 10.5px; color: #334; text-align: left; font-style: italic; }
        .items tr.grand .total-label { text-transform: uppercase; letter-spacing: 1px; }
        .status-badge { display: inline-block; background: ${secondary}; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px; margin-left: 6px; vertical-align: middle; }
        .status-void, .status-cancelled, .status-rejected, .status-reversed { background: #b91c1c; }
        .status-paid, .status-accepted, .status-issued, .status-confirmed { background: #15803d; }

        .bank { margin-top: 12px; background: #f2f6f3; border: 1px solid #d7e2d9; border-radius: 4px; padding: 8px 10px; max-width: 60%; }
        .bank-title { font-size: 10px; font-weight: 800; color: #177245; letter-spacing: 1px; margin-bottom: 4px; }
        .bank-row { display: flex; justify-content: space-between; font-size: 10.5px; padding: 1px 0; }
        .bank-row span { color: #556; }
        .bank-row strong { font-weight: 700; }

        .notes { margin-top: 12px; font-size: 10px; color: #445; border-top: 1px solid #e5e9f0; padding-top: 8px; }
        .notes-block { margin-bottom: 6px; }
        .notes-title { font-weight: 800; font-size: 10px; color: ${primary}; letter-spacing: 0.5px; }
        .notes-block div { line-height: 1.5; white-space: pre-wrap; }

        .verification { position: absolute; left: 16mm; right: 16mm; bottom: 78mm; display: flex; align-items: center; gap: 12px; background: #f7f9fc; border: 1px dashed #c7d0dd; border-radius: 4px; padding: 8px 10px; max-width: 62%; }
        .verification-title { font-weight: 800; font-size: 9px; color: ${primary}; letter-spacing: 1px; margin-bottom: 2px; }
        .verification-text { font-size: 9px; color: #556; line-height: 1.5; }
        .verification-url { font-weight: 700; color: #1a365d; word-break: break-all; }

        .signature-zone { position: absolute; right: 16mm; bottom: 52mm; text-align: center; max-width: 45%; }
        .signature-img { max-height: 52px; max-width: 150px; object-fit: contain; }
        .signatory-placeholder { border-bottom: 1px solid #333; width: 160px; height: 34px; margin: 0 auto; }
        .signatory-name { font-weight: 800; font-size: 11px; margin-top: 4px; }
        .signatory-role { font-size: 9.5px; color: #667; }

        .footer { position: absolute; left: 16mm; right: 16mm; bottom: 16mm; border-top: 1px solid #dfe4ec; padding-top: 6px; display: flex; justify-content: space-between; font-size: 8.5px; color: #7a8290; }
        .footer-left { max-width: 70%; }
        .footer-right { text-align: right; }
        .footer-divider { color: ${secondary}; }

        .receipt { width: 100%; border-collapse: collapse; margin-top: 14px; border: 1px solid #e5e9f0; }
        .receipt td { padding: 8px 10px; border-bottom: 1px solid #eef1f6; font-size: 11px; }
        .receipt td.receipt-key { width: 38%; color: #667; background: #f8fafd; font-weight: 700; }
        .receipt td.receipt-val { font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="page">
        ${input.watermark ? `<div class="watermark">${this.escapeHtml(input.watermark)}</div>` : ''}
        <div class="content">
          <div class="header">
            <div class="brand">
              ${c.logoUrl ? `<img class="brand-logo" src="${c.logoUrl}" alt="Logo" />` : ''}
              <div>
                <div class="brand-name">${this.escapeHtml(displayName)}</div>
                ${c.website ? `<div class="brand-tag">${this.escapeHtml(c.website)}</div>` : ''}
              </div>
            </div>
            <div class="header-right">
              <div class="doc-title">${this.escapeHtml(input.primaryTitle)}${statusBadge}</div>
              <div class="doc-number">Number: <span>${this.escapeHtml(input.number)}</span></div>
              <div class="company-address">${input.companyAddressBlock}</div>
            </div>
          </div>

          <div class="meta">
            ${input.detailsBlock}
            ${input.customerBlock}
          </div>

          ${input.itemsTable}

          ${input.bankBlock}
          ${input.notesBlock}

          ${c.stampUrl ? `<div class="verification" style="right:auto; left:16mm; bottom:52mm; background:transparent; border:none; max-width:34%;"><img src="${c.stampUrl}" style="max-height:120px; max-width:200px; object-fit:contain; opacity:0.85;" /></div>` : ''}

          ${this.signatureAndVerification(input)}

          <div class="footer">
            <div class="footer-left">
              ${c.companyRegistrationNumber ? `<span>Reg No: ${this.escapeHtml(c.companyRegistrationNumber)}</span><br/>` : ''}
              ${c.tpin ? `<span>TPIN: ${this.escapeHtml(c.tpin)}</span> &nbsp;|&nbsp; <span>ZRA: ${this.escapeHtml(c.zraIdentityNumber || c.tpin)}</span><br/>` : ''}
              ${c.phone ? `<span>Tel: ${this.escapeHtml(c.phone)}</span>` : ''} ${c.email ? `<span>Email: ${this.escapeHtml(c.email)}</span>` : ''}
            </div>
            <div class="footer-right">
              <span>Generated by SMART TECH Saas System</span><br/>
              <span class="footer-divider">•</span> <span>Page 1 of 1</span>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  }

  private signatureAndVerification(input: any): string {
    const c = input.company;
    let block = '';
    if (c.signatureUrl || c.authorizedSignatoryName) {
      block += `<div class="signature-zone">
        <div style="font-size:9px;font-weight:800;color:#667;letter-spacing:1px;margin-bottom:4px;">AUTHORIZED SIGNATURE</div>
        ${c.signatureUrl ? `<img class="signature-img" src="${c.signatureUrl}" alt="Signature" />` : `<div class="signatory-placeholder"></div>`}
        <div class="signatory-name">${this.escapeHtml(c.authorizedSignatoryName || 'Authorized Signatory')}</div>
        ${c.authorizedSignatoryRole ? `<div class="signatory-role">${this.escapeHtml(c.authorizedSignatoryRole)}</div>` : ''}
      </div>`;
    }
    if (input.verification?.verificationQr) {
      block += `<div class="verification" style="max-width:56%;">
        <div class="verification-qr"><img src="${input.verification.verificationQr}" width="82" height="82" alt="QR" /></div>
        <div class="verification-text">
          <div class="verification-title">DOCUMENT VERIFICATION</div>
          <div>Scan the QR code or visit ${this.escapeHtml(input.verification.verificationUrl || '')}</div>
          <div>Verification Code: ${this.escapeHtml(input.verification.verificationCode || '')}</div>
          <div style="word-break:break-all;opacity:0.75;">SHA-256: ${this.escapeHtml((input.verification.documentHash || '').substring(0, 24))}...</div>
        </div>
      </div>`;
    }
    return block;
  }
}