import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { FinancialDocumentType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { cloudinaryMemoryStorage, CLOUDINARY_FILE_FILTER } from '../cloudinary/multer-cloudinary';
import { QuotationService, QuotationCreateInput } from './services/quotation.service';
import { InvoiceService, InvoiceCreateInput } from './services/invoice.service';
import { FinancialPaymentService } from './services/financial-payment.service';
import { FinancialReceiptService } from './services/financial-receipt.service';
import { FinancialDocumentsService } from './services/financial-documents.service';
import { FinancialNumberingService } from './services/financial-numbering.service';
import { FinancialSettingsService } from './services/financial-settings.service';
import { CompanyProfileService } from './services/company-profile.service';
import { BankAccountService } from './services/bank-account.service';
import { TaxConfigurationService } from './services/tax-configuration.service';
import { FinancialCustomerService } from './services/financial-customer.service';
import { FinancialTemplateService } from './services/financial-template.service';
import { CreateQuoteInvoiceDto, UpdateQuoteInvoiceDto } from './dto/document.dto';
import { TransitionQuotationDto, QuotationConvertDto } from './dto/quotation.dto';
import { PaymentStatusUpdateDto, RecordPaymentDto } from './dto/payment.dto';
import { IssueReceiptDto, VoidOrCancelDto } from './dto/receipt.dto';
import { CreateFinancialCustomerDto } from './dto/financial-customer.dto';
import { CreateBankAccountDto } from './dto/bank-account.dto';
import { CreateTaxConfigurationDto } from './dto/tax-configuration.dto';
import { UpdateCompanyProfileDto } from './dto/company-profile.dto';
import { CreateFinancialTemplateDto } from './dto/financial-template.dto';
import { NumberingDefaultsDto, ResetSequenceDto, SettingsWriteDto, UpdateSequenceSettingsDto } from './dto/sequence.dto';
import { DocIdQDto, DocumentTypeQDto, ListQueryDto } from './dto/query.dto';

interface AuthedRequest extends Request {
  user?: { id?: string; email?: string; isSuperAdmin?: boolean; [key: string]: any };
}

@Controller('financial-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class FinancialDocumentsController {
  constructor(
    private readonly quotations: QuotationService,
    private readonly invoices: InvoiceService,
    private readonly payments: FinancialPaymentService,
    private readonly receipts: FinancialReceiptService,
    private readonly docs: FinancialDocumentsService,
    private readonly numbering: FinancialNumberingService,
    private readonly settings: FinancialSettingsService,
    private readonly companyProfile: CompanyProfileService,
    private readonly bankAccounts: BankAccountService,
    private readonly taxConfigs: TaxConfigurationService,
    private readonly customers: FinancialCustomerService,
    private readonly templates: FinancialTemplateService,
  ) {}

  private static userOf(req: AuthedRequest): { userId?: string; userEmail?: string } {
    return { userId: req.user?.id, userEmail: req.user?.email };
  }

  // ─── Dashboard / readiness / audit ───────────────────────────────────────
  @Get('dashboard')
  dashboard() {
    return this.docs.dashboard();
  }

  @Get('readiness')
  readiness() {
    return this.docs.readiness();
  }

  @Get('audit-logs')
  auditLogs(@Query() query: DocIdQDto) {
    return this.docs.auditLogs({ ...query, page: query.page || 1, pageSize: query.pageSize || 25 });
  }

  @Get('versions/:docType/:documentId')
  versions(@Param('docType') docType: string, @Param('documentId') documentId: string) {
    return this.docs.versions(docType as FinancialDocumentType, documentId);
  }

  @Get('relationships/:docType/:documentId')
  relationships(@Param('docType') docType: string, @Param('documentId') documentId: string) {
    return this.docs.documentRelationships(docType as FinancialDocumentType, documentId);
  }

  // ─── Sequences & numbering settings ─────────────────────────────────────
  @Get('sequences')
  sequences() {
    return this.numbering.listSequences();
  }

  @Post('sequences/:docType/settings')
  updateSequenceSettings(@Param('docType') docType: string, @Body() body: UpdateSequenceSettingsDto) {
    return this.numbering.updateSequenceSettings(docType as FinancialDocumentType, body);
  }

  @Post('sequences/:docType/reset')
  resetSequence(@Param('docType') docType: string, @Body() body: ResetSequenceDto) {
    return this.numbering.resetSequence(docType as FinancialDocumentType, body);
  }

  @Get('settings')
  listSettings() {
    return this.settings.getAll();
  }

  @Post('settings')
  setSetting(@Body() body: SettingsWriteDto) {
    return this.settings.set(body.key, body.value);
  }

  @Get('settings/numbering-defaults')
  numberingDefaults() {
    return this.settings.getNumberingDefaults();
  }

  @Put('settings/numbering-defaults')
  setNumberingDefaults(@Body() body: NumberingDefaultsDto, @Req() req: AuthedRequest) {
    return this.settings.setNumberingDefaults(body, req.user?.id);
  }

  // ─── Company profile ────────────────────────────────────────────────────
  @Get('company-profile')
  getCompanyProfile() {
    return this.companyProfile.get();
  }

  @Patch('company-profile')
  updateCompanyProfile(@Body() body: UpdateCompanyProfileDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.companyProfile.update(body, userId, userEmail);
  }

  @Post('company-profile/media')
  @UseInterceptors(FileInterceptor('file', { storage: cloudinaryMemoryStorage, fileFilter: CLOUDINARY_FILE_FILTER }))
  uploadCompanyMedia(@UploadedFile() file: any, @Body('kind') kind: string) {
    if (!file || !file.buffer) throw new Error('A file is required.');
    const kinds = ['logo', 'signature', 'stamp'];
    const k = kinds.includes(kind) ? kind : 'logo';
    return this.companyProfile.uploadMedia(file.buffer, k as 'logo' | 'signature' | 'stamp', file.mimetype || 'image/png');
  }

  // ─── Customers ──────────────────────────────────────────────────────────
  @Get('customers')
  listCustomers(@Query() query: ListQueryDto) {
    return this.customers.list(query);
  }

  @Post('customers')
  createCustomer(@Body() body: CreateFinancialCustomerDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.customers.create(body, userId, userEmail);
  }

  @Get('customers/:id')
  getCustomer(@Param('id') id: string) {
    return this.customers.get(id);
  }

  @Patch('customers/:id')
  updateCustomer(@Param('id') id: string, @Body() body: CreateFinancialCustomerDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.customers.update(id, body, userId, userEmail);
  }

  @Delete('customers/:id')
  deleteCustomer(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.customers.remove(id, userId, userEmail);
  }

  // ─── Bank accounts ──────────────────────────────────────────────────────
  @Get('bank-accounts')
  listBankAccounts() {
    return this.bankAccounts.list();
  }

  @Post('bank-accounts')
  createBankAccount(@Body() body: CreateBankAccountDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.bankAccounts.create(body, userId, userEmail);
  }

  @Get('bank-accounts/:id')
  getBankAccount(@Param('id') id: string) {
    return this.bankAccounts.get(id);
  }

  @Patch('bank-accounts/:id')
  updateBankAccount(@Param('id') id: string, @Body() body: CreateBankAccountDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.bankAccounts.update(id, body, userId, userEmail);
  }

  @Delete('bank-accounts/:id')
  deleteBankAccount(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.bankAccounts.remove(id, userId, userEmail);
  }

  // ─── Tax configurations ─────────────────────────────────────────────────
  @Get('tax-configurations')
  listTaxConfigs() {
    return this.taxConfigs.list();
  }

  @Post('tax-configurations')
  createTaxConfig(@Body() body: CreateTaxConfigurationDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.taxConfigs.create(body, userId, userEmail);
  }

  @Get('tax-configurations/:id')
  getTaxConfig(@Param('id') id: string) {
    return this.taxConfigs.get(id);
  }

  @Patch('tax-configurations/:id')
  updateTaxConfig(@Param('id') id: string, @Body() body: CreateTaxConfigurationDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.taxConfigs.update(id, body, userId, userEmail);
  }

  @Delete('tax-configurations/:id')
  deleteTaxConfig(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.taxConfigs.remove(id, userId, userEmail);
  }

  // ─── Templates ──────────────────────────────────────────────────────────
  @Get('templates')
  listTemplates(@Query() query: DocumentTypeQDto) {
    return this.templates.list(query.docType);
  }

  @Post('templates')
  createTemplate(@Body() body: CreateFinancialTemplateDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.templates.create(body, userId, userEmail);
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() body: CreateFinancialTemplateDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.templates.update(id, body, userId, userEmail);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.templates.remove(id, userId, userEmail);
  }

  @Post('templates/:id/duplicate')
  duplicateTemplate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.templates.duplicate(id, req.user?.id);
  }

  // ─── Quotations ─────────────────────────────────────────────────────────
  @Get('quotations')
  listQuotations(@Query() query: ListQueryDto) {
    return this.quotations.list(query);
  }

  @Post('quotations')
  createQuotation(@Body() body: CreateQuoteInvoiceDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.quotations.create(body as QuotationCreateInput, userId, userEmail);
  }

  @Get('quotations/:id')
  getQuotation(@Param('id') id: string) {
    return this.quotations.get(id);
  }

  @Patch('quotations/:id')
  updateQuotation(@Param('id') id: string, @Body() body: UpdateQuoteInvoiceDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.quotations.update(id, body as QuotationCreateInput, userId, userEmail);
  }

  @Delete('quotations/:id')
  deleteQuotation(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.quotations.remove(id, userId, userEmail);
  }

  @Post('quotations/:id/issue')
  issueQuotation(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.quotations.issue(id, userId, userEmail);
  }

  @Post('quotations/:id/send')
  sendQuotation(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.quotations.send(id, userId, userEmail);
  }

  @Post('quotations/:id/transition')
  transitionQuotation(@Param('id') id: string, @Body() body: TransitionQuotationDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.quotations.transition(id, body.to, userId, userEmail, body.reason);
  }

  @Post('quotations/:id/convert')
  convertQuotation(@Param('id') id: string, @Body() body: QuotationConvertDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.quotations.convertToInvoice(id, userId, userEmail, body);
  }

  @Get('quotations/:id/payments')
  async quotationPayments(@Param('id') id: string) {
    return (await this.quotations.get(id)).payments;
  }

  @Get('quotations/:id/pdf')
  async quotationPdf(@Param('id') id: string, @Res() res: Response) {
    const q = await this.quotations.get(id);
    const rendered = await this.quotations.renderPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SMART_TECH_Quotation_${q.quotationNumber || id}.pdf"`);
    return res.send(rendered.buffer);
  }

  // ─── Invoices ───────────────────────────────────────────────────────────
  @Get('invoices')
  listInvoices(@Query() query: ListQueryDto) {
    return this.invoices.list(query);
  }

  @Post('invoices')
  createInvoice(@Body() body: CreateQuoteInvoiceDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.create(body, userId, userEmail);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string) {
    return this.invoices.get(id);
  }

  @Patch('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() body: UpdateQuoteInvoiceDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.update(id, body as InvoiceCreateInput, userId, userEmail);
  }

  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.remove(id, userId, userEmail);
  }

  @Post('invoices/:id/issue')
  issueInvoice(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.issue(id, userId, userEmail);
  }

  @Post('invoices/:id/send')
  sendInvoice(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.send(id, userId, userEmail);
  }

  @Post('invoices/:id/cancel')
  cancelInvoice(@Param('id') id: string, @Body() body: VoidOrCancelDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.cancel(id, body.reason, userId, userEmail);
  }

  @Post('invoices/:id/void')
  voidInvoice(@Param('id') id: string, @Body() body: VoidOrCancelDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.void(id, body.reason, userId, userEmail);
  }

  @Post('invoices/:id/payments')
  recordPayment(@Param('id') id: string, @Body() body: RecordPaymentDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.invoices.recordPayment(id, body, userId, userEmail);
  }

  @Get('invoices/:id/payments')
  invoicePayments(@Param('id') id: string) {
    return this.invoices.getPayments(id);
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(@Param('id') id: string, @Res() res: Response) {
    const inv = await this.invoices.get(id);
    const rendered = await this.invoices.renderPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SMART_TECH_Invoice_${inv.invoiceNumber || id}.pdf"`);
    return res.send(rendered.buffer);
  }

  // ─── Payments ───────────────────────────────────────────────────────────
  @Get('payments')
  listPayments(@Query() query: ListQueryDto) {
    return this.payments.list(query);
  }

  @Get('payments/:id')
  getPayment(@Param('id') id: string) {
    return this.payments.get(id);
  }

  @Patch('payments/:id/status')
  updatePaymentStatus(@Param('id') id: string, @Body() body: PaymentStatusUpdateDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.payments.updateStatus(id, body.status, body.reason, userId, userEmail);
  }

  @Delete('payments/:id')
  deletePayment(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.payments.remove(id, userId, userEmail);
  }

  // ─── Receipts ───────────────────────────────────────────────────────────
  @Get('receipts')
  listReceipts(@Query() query: ListQueryDto) {
    return this.receipts.list(query);
  }

  @Post('receipts')
  issueReceipt(@Body() body: IssueReceiptDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.receipts.issueReceipt(body.paymentId, userId, userEmail);
  }

  @Get('receipts/:id')
  getReceipt(@Param('id') id: string) {
    return this.receipts.get(id);
  }

  @Post('receipts/:id/void')
  voidReceipt(@Param('id') id: string, @Body() body: VoidOrCancelDto, @Req() req: AuthedRequest) {
    const { userId, userEmail } = FinancialDocumentsController.userOf(req);
    return this.receipts.voidReceipt(id, body.reason, userId, userEmail);
  }

  @Get('receipts/:id/pdf')
  async receiptPdf(@Param('id') id: string, @Res() res: Response) {
    const r = await this.receipts.get(id);
    const rendered = await this.receipts.renderPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="SMART_TECH_Receipt_${r.receiptNumber || id}.pdf"`);
    return res.send(rendered.buffer);
  }
}