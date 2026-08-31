-- Multi-signatory architecture: template signatory positions, super-admin platform assets,
-- revoke/status management, and support for multiple signers per issued document.

ALTER TABLE "DigitalSignature" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'SCHOOL';
ALTER TABLE "DigitalSignature" ADD COLUMN "revokedReason" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "DigitalSignature" ADD COLUMN "revokedBy" TEXT;
CREATE INDEX "DigitalSignature_scope_status_idx" ON "DigitalSignature"("scope", "status");

ALTER TABLE "DigitalStamp" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "DigitalStamp" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'SCHOOL';
ALTER TABLE "DigitalStamp" ADD COLUMN "revokedReason" TEXT;
ALTER TABLE "DigitalStamp" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "DigitalStamp" ADD COLUMN "revokedBy" TEXT;
ALTER TABLE "DigitalStamp" ALTER COLUMN "schoolId" DROP NOT NULL;
CREATE INDEX "DigitalStamp_scope_status_idx" ON "DigitalStamp"("scope", "status");

ALTER TABLE "DocumentSignature" DROP CONSTRAINT IF EXISTS "DocumentSignature_documentHash_key";
ALTER TABLE "DocumentSignature" ADD COLUMN "signatoryLabel" TEXT;
ALTER TABLE "DocumentSignature" ADD COLUMN "signatureAssetId" TEXT;

CREATE TABLE "TemplateSignatory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "signatureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TemplateSignatory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TemplateSignatory_templateId_idx" ON "TemplateSignatory"("templateId");
CREATE INDEX "TemplateSignatory_signatureId_idx" ON "TemplateSignatory"("signatureId");
ALTER TABLE "TemplateSignatory" ADD CONSTRAINT "TemplateSignatory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateSignatory" ADD CONSTRAINT "TemplateSignatory_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "DigitalSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;