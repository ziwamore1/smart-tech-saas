-- CreateEnum
CREATE TYPE "FinancialDocumentType" AS ENUM ('QUOTATION', 'INVOICE', 'PAYMENT_RECEIPT');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONVERTED_TO_INVOICE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID');

-- CreateEnum
CREATE TYPE "FinancialPaymentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'USSD', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialReceiptStatus" AS ENUM ('ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "FinancialTaxPricingMode" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "FinancialSequenceResetPolicy" AS ENUM ('NEVER', 'ANNUAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "FinancialCustomerType" AS ENUM ('SCHOOL', 'GOVERNMENT', 'NGO', 'CORPORATE', 'INDIVIDUAL', 'OTHER');

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'company',
    "legalName" TEXT NOT NULL,
    "tradingName" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "companyRegistrationNumber" TEXT,
    "tpin" TEXT,
    "zraIdentityNumber" TEXT,
    "physicalAddress" TEXT,
    "postalAddress" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Zambia',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "businessDescription" TEXT,
    "registrationInformation" JSONB,
    "authorizedContactName" TEXT,
    "authorizedContactRole" TEXT,
    "authorizedContactEmail" TEXT,
    "authorizedContactPhone" TEXT,
    "authorizedSignatoryName" TEXT,
    "authorizedSignatoryRole" TEXT,
    "signatureUrl" TEXT,
    "signaturePublicId" TEXT,
    "stampUrl" TEXT,
    "stampPublicId" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e3a5f',
    "secondaryColor" TEXT NOT NULL DEFAULT '#c0a030',
    "headerLayout" TEXT NOT NULL DEFAULT 'logo-left',
    "footerLayout" TEXT NOT NULL DEFAULT 'standard',
    "watermarkText" TEXT,
    "defaultTerms" TEXT,
    "defaultPaymentTerms" TEXT,
    "defaultNotes" TEXT,
    "defaultTaxConfigurationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCustomer" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "customerType" "FinancialCustomerType" NOT NULL DEFAULT 'SCHOOL',
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "address" TEXT,
    "postalAddress" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT,
    "contactPerson" TEXT,
    "billingContact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "customerReference" TEXT,
    "taxInformation" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "branch" TEXT,
    "branchCode" TEXT,
    "swiftCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "accountType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxConfiguration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "registrationNumber" TEXT,
    "description" TEXT,
    "pricingMode" "FinancialTaxPricingMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDocumentSequence" (
    "id" TEXT NOT NULL,
    "documentType" "FinancialDocumentType" NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'QT',
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "sequenceLength" INTEGER NOT NULL DEFAULT 5,
    "separator" TEXT NOT NULL DEFAULT '-',
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "pattern" TEXT NOT NULL DEFAULT '{PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{SEQ}',
    "resetPolicy" "FinancialSequenceResetPolicy" NOT NULL DEFAULT 'NEVER',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialDocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "quotationDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "customerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "reference" TEXT,
    "customerReference" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountInWords" TEXT,
    "taxConfigurationId" TEXT,
    "bankAccountId" TEXT,
    "quotationValidity" TEXT,
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "notes" TEXT,
    "specialConditions" TEXT,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "pdfUrl" TEXT,
    "pdfPublicId" TEXT,
    "verificationCode" TEXT,
    "documentHash" TEXT,
    "verificationUrl" TEXT,
    "createdById" TEXT,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "itemName" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "quotationId" TEXT,
    "orderReference" TEXT,
    "purchaseReference" TEXT,
    "customerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountInWords" TEXT,
    "taxConfigurationId" TEXT,
    "bankAccountId" TEXT,
    "paymentTerms" TEXT,
    "serviceTerms" TEXT,
    "notes" TEXT,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "pdfUrl" TEXT,
    "pdfPublicId" TEXT,
    "verificationCode" TEXT,
    "documentHash" TEXT,
    "verificationUrl" TEXT,
    "createdById" TEXT,
    "issuedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemName" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "quotationId" TEXT,
    "customerId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "method" "FinancialPaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "transactionReference" TEXT,
    "bankReference" TEXT,
    "receivedById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reversalReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "attachmentPublicId" TEXT,
    "status" "FinancialPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "quotationId" TEXT,
    "customerId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentDate" TIMESTAMP(3),
    "amountReceived" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "amountInWords" TEXT,
    "paymentMethod" "FinancialPaymentMethod" NOT NULL,
    "transactionReference" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountLast4" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "status" "FinancialReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "pdfUrl" TEXT,
    "pdfPublicId" TEXT,
    "verificationCode" TEXT,
    "documentHash" TEXT,
    "verificationUrl" TEXT,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentType" "FinancialDocumentType" NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "htmlSnapshot" TEXT,
    "dataSnapshot" JSONB,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "templateSnapshot" JSONB,
    "generatedById" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFile" TEXT,

    CONSTRAINT "FinancialDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDocumentAudit" (
    "id" TEXT NOT NULL,
    "documentType" "FinancialDocumentType",
    "documentId" TEXT,
    "documentNumber" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialDocumentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDocumentSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialDocumentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDocumentTemplate" (
    "id" TEXT NOT NULL,
    "docType" "FinancialDocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" JSONB,
    "headerLayout" TEXT,
    "footerLayout" TEXT,
    "watermarkText" TEXT,
    "components" JSONB,
    "legalFooter" TEXT,
    "termsAndConditions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialDocumentTemplate_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_defaultTaxConfigurationId_key" ON "CompanyProfile"("defaultTaxConfigurationId");

-- CreateIndex
CREATE INDEX "CompanyProfile_createdAt_idx" ON "CompanyProfile"("createdAt");

-- CreateIndex
CREATE INDEX "FinancialCustomer_schoolId_idx" ON "FinancialCustomer"("schoolId");

-- CreateIndex
CREATE INDEX "FinancialCustomer_name_idx" ON "FinancialCustomer"("name");

-- CreateIndex
CREATE INDEX "FinancialCustomer_isActive_idx" ON "FinancialCustomer"("isActive");

-- CreateIndex
CREATE INDEX "BankAccount_currency_idx" ON "BankAccount"("currency");

-- CreateIndex
CREATE INDEX "BankAccount_isActive_idx" ON "BankAccount"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_bankName_accountNumber_key" ON "BankAccount"("bankName", "accountNumber");

-- CreateIndex
CREATE INDEX "TaxConfiguration_isActive_idx" ON "TaxConfiguration"("isActive");

-- CreateIndex
CREATE INDEX "TaxConfiguration_isDefault_idx" ON "TaxConfiguration"("isDefault");

-- CreateIndex
CREATE INDEX "FinancialDocumentSequence_documentType_idx" ON "FinancialDocumentSequence"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocumentSequence_documentType_prefix_year_key" ON "FinancialDocumentSequence"("documentType", "prefix", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_quotationDate_idx" ON "Quotation"("quotationDate");

-- CreateIndex
CREATE INDEX "Quotation_createdAt_idx" ON "Quotation"("createdAt");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_quotationId_key" ON "Invoice"("quotationId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPayment_paymentNumber_key" ON "FinancialPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "FinancialPayment_invoiceId_idx" ON "FinancialPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "FinancialPayment_quotationId_idx" ON "FinancialPayment"("quotationId");

-- CreateIndex
CREATE INDEX "FinancialPayment_customerId_idx" ON "FinancialPayment"("customerId");

-- CreateIndex
CREATE INDEX "FinancialPayment_status_idx" ON "FinancialPayment"("status");

-- CreateIndex
CREATE INDEX "FinancialPayment_paymentDate_idx" ON "FinancialPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialReceipt_receiptNumber_key" ON "FinancialReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialReceipt_paymentId_key" ON "FinancialReceipt"("paymentId");

-- CreateIndex
CREATE INDEX "FinancialReceipt_invoiceId_idx" ON "FinancialReceipt"("invoiceId");

-- CreateIndex
CREATE INDEX "FinancialReceipt_quotationId_idx" ON "FinancialReceipt"("quotationId");

-- CreateIndex
CREATE INDEX "FinancialReceipt_receiptDate_idx" ON "FinancialReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "FinancialDocumentVersion_documentType_idx" ON "FinancialDocumentVersion"("documentType");

-- CreateIndex
CREATE INDEX "FinancialDocumentVersion_documentId_idx" ON "FinancialDocumentVersion"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocumentVersion_documentType_documentId_version_key" ON "FinancialDocumentVersion"("documentType", "documentId", "version");

-- CreateIndex
CREATE INDEX "FinancialDocumentAudit_documentType_idx" ON "FinancialDocumentAudit"("documentType");

-- CreateIndex
CREATE INDEX "FinancialDocumentAudit_documentId_idx" ON "FinancialDocumentAudit"("documentId");

-- CreateIndex
CREATE INDEX "FinancialDocumentAudit_documentNumber_idx" ON "FinancialDocumentAudit"("documentNumber");

-- CreateIndex
CREATE INDEX "FinancialDocumentAudit_userId_idx" ON "FinancialDocumentAudit"("userId");

-- CreateIndex
CREATE INDEX "FinancialDocumentAudit_createdAt_idx" ON "FinancialDocumentAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDocumentSetting_key_key" ON "FinancialDocumentSetting"("key");

-- CreateIndex
CREATE INDEX "FinancialDocumentTemplate_docType_idx" ON "FinancialDocumentTemplate"("docType");

-- CreateIndex
CREATE INDEX "FinancialDocumentTemplate_isDefault_idx" ON "FinancialDocumentTemplate"("isDefault");
-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_defaultTaxConfigurationId_fkey" FOREIGN KEY ("defaultTaxConfigurationId") REFERENCES "TaxConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCustomer" ADD CONSTRAINT "FinancialCustomer_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FinancialCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_taxConfigurationId_fkey" FOREIGN KEY ("taxConfigurationId") REFERENCES "TaxConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FinancialCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_taxConfigurationId_fkey" FOREIGN KEY ("taxConfigurationId") REFERENCES "TaxConfiguration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FinancialCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FinancialPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReceipt" ADD CONSTRAINT "FinancialReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "FinancialPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReceipt" ADD CONSTRAINT "FinancialReceipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReceipt" ADD CONSTRAINT "FinancialReceipt_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialReceipt" ADD CONSTRAINT "FinancialReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FinancialCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
