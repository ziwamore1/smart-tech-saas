import { Module } from '@nestjs/common';
import { QrModule } from '../qr-service/qr.module';
import { FinancialDocumentsController } from './financial-documents.controller';
import { PublicFinancialVerificationController } from './public/public-financial-verification.controller';
import { FinancialNumberingService } from './services/financial-numbering.service';
import { FinancialVerificationService } from './services/financial-verification.service';
import { FinancialAuditService } from './services/financial-audit.service';
import { FinancialPdfService } from './services/financial-pdf.service';
import { CompanyProfileService } from './services/company-profile.service';
import { FinancialSettingsService } from './services/financial-settings.service';
import { BankAccountService } from './services/bank-account.service';
import { TaxConfigurationService } from './services/tax-configuration.service';
import { FinancialCustomerService } from './services/financial-customer.service';
import { FinancialTemplateService } from './services/financial-template.service';
import { QuotationService } from './services/quotation.service';
import { InvoiceService } from './services/invoice.service';
import { FinancialPaymentService } from './services/financial-payment.service';
import { FinancialReceiptService } from './services/financial-receipt.service';
import { FinancialDocumentsService } from './services/financial-documents.service';

@Module({
  imports: [QrModule],
  controllers: [FinancialDocumentsController, PublicFinancialVerificationController],
  providers: [
    FinancialNumberingService,
    FinancialVerificationService,
    FinancialAuditService,
    FinancialPdfService,
    CompanyProfileService,
    FinancialSettingsService,
    BankAccountService,
    TaxConfigurationService,
    FinancialCustomerService,
    FinancialTemplateService,
    QuotationService,
    InvoiceService,
    FinancialPaymentService,
    FinancialReceiptService,
    FinancialDocumentsService,
  ],
  exports: [FinancialNumberingService, FinancialVerificationService, FinancialAuditService, FinancialPdfService],
})
export class FinancialDocumentsModule {}