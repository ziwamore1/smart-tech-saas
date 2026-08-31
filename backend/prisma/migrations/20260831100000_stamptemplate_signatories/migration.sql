-- StampTemplate signatory positions: issuance pre-fills signature slots from
-- the stamp/document template's declared positions.

CREATE TABLE "StampTemplateSignatory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "signatureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StampTemplateSignatory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StampTemplateSignatory_templateId_idx" ON "StampTemplateSignatory"("templateId");
CREATE INDEX "StampTemplateSignatory_signatureId_idx" ON "StampTemplateSignatory"("signatureId");
ALTER TABLE "StampTemplateSignatory" ADD CONSTRAINT "StampTemplateSignatory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StampTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StampTemplateSignatory" ADD CONSTRAINT "StampTemplateSignatory_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "DigitalSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
