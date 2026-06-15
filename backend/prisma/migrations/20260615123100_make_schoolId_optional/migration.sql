-- DropForeignKey
ALTER TABLE "ReportTemplate" DROP CONSTRAINT IF EXISTS "ReportTemplate_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateCategory" DROP CONSTRAINT IF EXISTS "TemplateCategory_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateMarketplace" DROP CONSTRAINT IF EXISTS "TemplateMarketplace_schoolId_fkey";

-- AlterTable
ALTER TABLE "ReportTemplate" ALTER COLUMN "schoolId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TemplateCategory" ALTER COLUMN "isSystem" SET NOT NULL;
ALTER TABLE "TemplateCategory" ALTER COLUMN "schoolId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TemplateMarketplace" ALTER COLUMN "schoolId" DROP NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "TemplateCategory_slug_schoolId_key";
DROP INDEX IF EXISTS "TemplateCategory_slug_system_key";

-- CreateIndex
CREATE UNIQUE INDEX "TemplateCategory_slug_schoolId_key" ON "TemplateCategory"("slug", "schoolId");

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateCategory" ADD CONSTRAINT "TemplateCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMarketplace" ADD CONSTRAINT "TemplateMarketplace_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;