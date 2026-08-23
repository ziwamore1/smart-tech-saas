-- Digital Stamp Engine — Document Authenticity Platform (Part A)
-- Additive migration: existing tables and data are untouched.

CREATE TYPE "StampTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "DocumentVerificationStatus" AS ENUM ('VALID', 'REVOKED', 'EXPIRED', 'INVALID', 'SUPERSEDED');

CREATE TYPE "StampAssetKind" AS ENUM ('LOGO', 'EMBLEM', 'COAT_OF_ARMS', 'CENTER_GRAPHIC', 'SIGNATURE', 'OTHER');

-- ==========================================
-- Stamp templates (layer-based designer)
-- ==========================================

CREATE TABLE "StampTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "StampType" NOT NULL DEFAULT 'CUSTOM',
    "status" "StampTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB NOT NULL,
    "thumbnailUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StampTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StampTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "configJson" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StampAsset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "StampAssetKind" NOT NULL DEFAULT 'LOGO',
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "metadata" JSONB DEFAULT '{}',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampAsset_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- Serial numbers
-- ==========================================

CREATE TABLE "SerialSequence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSerial" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentRef" TEXT,
    "sequence" INTEGER NOT NULL,
    "year" INTEGER,
    "formatPattern" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,

    CONSTRAINT "DocumentSerial_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- Verification records
-- ==========================================

CREATE TABLE "DocumentVerification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentTitle" TEXT,
    "serialNumber" TEXT,
    "documentHash" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "hashBasis" JSONB,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'VALID',
    "stampedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lusaka',
    "stampDate" TEXT,
    "stampTime" TEXT,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "templateSnapshot" JSONB,
    "verificationCode" TEXT NOT NULL,
    "verificationUrl" TEXT,
    "qrCodeDataUrl" TEXT,
    "issuedToLabel" TEXT,
    "disclaimerText" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revocationReason" TEXT,
    "supersededBySerial" TEXT,
    "finalizedById" TEXT NOT NULL,
    "signatureRecordId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVerification_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- Configurable approval workflows + audit
-- ==========================================

CREATE TABLE "ApprovalWorkflowConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stepsJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresSigner" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflowConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "documentVerificationId" TEXT,
    "beforeStatus" TEXT,
    "afterStatus" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "detail" JSONB DEFAULT '{}',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAuditLog_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- Foreign keys (School-scoped tenancy)
-- ==========================================

ALTER TABLE "StampTemplate"
  ADD CONSTRAINT "StampTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StampTemplateVersion"
  ADD CONSTRAINT "StampTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StampTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StampAsset"
  ADD CONSTRAINT "StampAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SerialSequence"
  ADD CONSTRAINT "SerialSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentSerial"
  ADD CONSTRAINT "DocumentSerial_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentVerification"
  ADD CONSTRAINT "DocumentVerification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalWorkflowConfig"
  ADD CONSTRAINT "ApprovalWorkflowConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAuditLog"
  ADD CONSTRAINT "DocumentAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==========================================
-- Indexes & uniqueness guarantees
-- ==========================================

CREATE UNIQUE INDEX "StampTemplate_schoolId_name_key" ON "StampTemplate"("schoolId", "name");
CREATE INDEX "StampTemplate_schoolId_idx" ON "StampTemplate"("schoolId");
CREATE INDEX "StampTemplate_status_idx" ON "StampTemplate"("status");

CREATE UNIQUE INDEX "StampTemplateVersion_templateId_version_key" ON "StampTemplateVersion"("templateId", "version");
CREATE INDEX "StampTemplateVersion_templateId_idx" ON "StampTemplateVersion"("templateId");

CREATE INDEX "StampAsset_schoolId_idx" ON "StampAsset"("schoolId");
CREATE INDEX "StampAsset_kind_idx" ON "StampAsset"("kind");

CREATE UNIQUE INDEX "SerialSequence_schoolId_scopeKey_key" ON "SerialSequence"("schoolId", "scopeKey");
CREATE INDEX "SerialSequence_schoolId_idx" ON "SerialSequence"("schoolId");

CREATE UNIQUE INDEX "DocumentSerial_serialNumber_key" ON "DocumentSerial"("serialNumber");
CREATE INDEX "DocumentSerial_schoolId_idx" ON "DocumentSerial"("schoolId");
CREATE INDEX "DocumentSerial_documentType_idx" ON "DocumentSerial"("documentType");
CREATE INDEX "DocumentSerial_issuedAt_idx" ON "DocumentSerial"("issuedAt");

CREATE UNIQUE INDEX "DocumentVerification_serialNumber_key" ON "DocumentVerification"("serialNumber");
CREATE UNIQUE INDEX "DocumentVerification_documentHash_key" ON "DocumentVerification"("documentHash");
CREATE UNIQUE INDEX "DocumentVerification_verificationCode_key" ON "DocumentVerification"("verificationCode");
CREATE INDEX "DocumentVerification_documentId_idx" ON "DocumentVerification"("documentId");
CREATE INDEX "DocumentVerification_schoolId_idx" ON "DocumentVerification"("schoolId");
CREATE INDEX "DocumentVerification_status_idx" ON "DocumentVerification"("status");
CREATE INDEX "DocumentVerification_verificationCode_idx" ON "DocumentVerification"("verificationCode");

CREATE UNIQUE INDEX "ApprovalWorkflowConfig_schoolId_documentType_name_key" ON "ApprovalWorkflowConfig"("schoolId", "documentType", "name");
CREATE INDEX "ApprovalWorkflowConfig_schoolId_idx" ON "ApprovalWorkflowConfig"("schoolId");
CREATE INDEX "ApprovalWorkflowConfig_isActive_idx" ON "ApprovalWorkflowConfig"("isActive");

CREATE INDEX "DocumentAuditLog_entityType_entityId_idx" ON "DocumentAuditLog"("entityType", "entityId");
CREATE INDEX "DocumentAuditLog_schoolId_idx" ON "DocumentAuditLog"("schoolId");
CREATE INDEX "DocumentAuditLog_action_idx" ON "DocumentAuditLog"("action");
CREATE INDEX "DocumentAuditLog_createdAt_idx" ON "DocumentAuditLog"("createdAt");
