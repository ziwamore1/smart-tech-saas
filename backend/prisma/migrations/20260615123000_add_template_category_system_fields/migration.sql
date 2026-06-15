-- Add description field to ReportTemplate
ALTER TABLE "ReportTemplate" ADD COLUMN "description" TEXT;

-- AlterTable: Make TemplateCategory schoolId optional, add isSystem and educationLevel
ALTER TABLE "TemplateCategory" ALTER COLUMN "schoolId" DROP NOT NULL;
ALTER TABLE "TemplateCategory" ADD COLUMN "educationLevel" TEXT DEFAULT 'general';
ALTER TABLE "TemplateCategory" ADD COLUMN "isSystem" BOOLEAN DEFAULT false;

-- Update existing categories
UPDATE "TemplateCategory" SET "isSystem" = false WHERE "isSystem" IS NULL;
UPDATE "TemplateCategory" SET "educationLevel" = 'general' WHERE "educationLevel" IS NULL;

-- Add new enum values for ComponentType if needed (HEAD_TEACHER_REMARKS, PROMOTION_STATUS, BORDER)
ALTER TYPE "ComponentType" ADD VALUE IF NOT EXISTS 'HEAD_TEACHER_REMARKS';
ALTER TYPE "ComponentType" ADD VALUE IF NOT EXISTS 'PROMOTION_STATUS';
ALTER TYPE "ComponentType" ADD VALUE IF NOT EXISTS 'BORDER';

-- DropIndex: Remove unique constraint that requires schoolId
DROP INDEX IF EXISTS "TemplateCategory_slug_schoolId_key";
CREATE UNIQUE INDEX "TemplateCategory_slug_schoolId_key" ON "TemplateCategory"("slug", "schoolId") WHERE "schoolId" IS NOT NULL;
CREATE UNIQUE INDEX "TemplateCategory_slug_system_key" ON "TemplateCategory"("slug") WHERE "isSystem" = true;
