-- Keep certificate recipient identity and award category explicit. String-backed
-- values allow new school award categories without enum migrations.
ALTER TABLE "CertificateTemplate" ADD COLUMN IF NOT EXISTS "audience" TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "CertificateTemplate" ADD COLUMN IF NOT EXISTS "awardCategory" TEXT NOT NULL DEFAULT 'OVERALL_AVERAGE';
ALTER TABLE "CertificateTemplate" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "TemplateMarketplace" ADD COLUMN IF NOT EXISTS "recipientType" TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "TemplateMarketplace" ADD COLUMN IF NOT EXISTS "awardCategory" TEXT;
ALTER TABLE "GeneratedReport" ADD COLUMN IF NOT EXISTS "recipientType" TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "GeneratedReport" ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT;
CREATE INDEX IF NOT EXISTS "CertificateTemplate_audience_awardCategory_idx" ON "CertificateTemplate" ("audience", "awardCategory");
CREATE INDEX IF NOT EXISTS "TemplateMarketplace_recipientType_awardCategory_idx" ON "TemplateMarketplace" ("recipientType", "awardCategory");
