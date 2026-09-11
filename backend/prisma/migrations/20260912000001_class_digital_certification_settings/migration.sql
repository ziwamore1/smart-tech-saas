-- Per-class digital report certification settings.
--
-- Classes opt in per class (each class has its own class-teacher signatory):
--   * includeDigitalStamp     - apply the Stamp Engine digital stamp, QR,
--                               serial number and verification block.
--   * includeDigitalSignature - apply the class-teacher signature plus the
--                               school Head Teacher / Deputy signatures.
--
-- Both columns are nullable: NULL means "follow the ReportTemplate opt-in
-- (includeStamp / includeSignature)", TRUE/FALSE is an explicit per-class
-- override. Schools additionally name their signatories so the signing
-- pipeline can resolve the Head Teacher / Deputy slots (previously the
-- pipeline queried School.headTeacherName which did not exist, causing a
-- silent runtime error that degraded every report to stamp-only/no-signature).
--
-- Statements are idempotent (ADD COLUMN IF NOT EXISTS) so the migration is
-- safe to apply even when a production database was already provisioned via
-- `prisma db push` with a newer schema snapshot.

ALTER TABLE "Class"
  ADD COLUMN IF NOT EXISTS "includeDigitalStamp"     BOOLEAN,
  ADD COLUMN IF NOT EXISTS "includeDigitalSignature" BOOLEAN;

ALTER TABLE "School"
  ADD COLUMN IF NOT EXISTS "headTeacherName" TEXT,
  ADD COLUMN IF NOT EXISTS "deputyName"      TEXT;