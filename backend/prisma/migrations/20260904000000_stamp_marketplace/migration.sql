-- Stamp Marketplace (super-admin authored stamps distributed to schools)
-- Additive migration: existing tables/data untouched.
-- NOTE: "SubscriptionTier" enum type already exists in the DB (not recreated here).

-- ==========================================
-- 1) StampTemplate: allow PLATFORM-scoped templates
-- ==========================================

-- schoolId becomes nullable so super-admin can author platform templates (schoolId = NULL).
ALTER TABLE "StampTemplate" ALTER COLUMN "schoolId" DROP NOT NULL;

-- scope discriminates PLATFORM vs SCHOOL templates.
ALTER TABLE "StampTemplate" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'SCHOOL';

-- The old per-school unique name constraint is replaced by (scope, status) index;
-- platform templates (schoolId NULL) may repeat names, uniqueness is enforced in the service.
DROP INDEX IF EXISTS "StampTemplate_schoolId_name_key";

CREATE INDEX "StampTemplate_scope_status_idx" ON "StampTemplate"("scope", "status");

-- ==========================================
-- 2) StampMarketplace - published marketplace listings
-- ==========================================

CREATE TABLE "StampMarketplace" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT '{}',
    "thumbnailUrl" TEXT,
    "minTier" "SubscriptionTier" NOT NULL DEFAULT 'STANDARD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StampMarketplace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StampMarketplace_templateId_key" ON "StampMarketplace"("templateId");
CREATE UNIQUE INDEX "StampMarketplace_name_key" ON "StampMarketplace"("name");
CREATE INDEX "StampMarketplace_status_minTier_idx" ON "StampMarketplace"("status", "minTier");
CREATE INDEX "StampMarketplace_category_idx" ON "StampMarketplace"("category");

ALTER TABLE "StampMarketplace"
    ADD CONSTRAINT "StampMarketplace_templateId_fkey" FOREIGN KEY ("templateId")
    REFERENCES "StampTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==========================================
-- 3) StampMarketplaceInstall - per-school install records
-- ==========================================

CREATE TABLE "StampMarketplaceInstall" (
    "id" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "installedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampMarketplaceInstall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StampMarketplaceInstall_marketplaceId_schoolId_key" ON "StampMarketplaceInstall"("marketplaceId", "schoolId");
CREATE INDEX "StampMarketplaceInstall_schoolId_idx" ON "StampMarketplaceInstall"("schoolId");
CREATE INDEX "StampMarketplaceInstall_templateId_idx" ON "StampMarketplaceInstall"("templateId");

ALTER TABLE "StampMarketplaceInstall"
    ADD CONSTRAINT "StampMarketplaceInstall_marketplaceId_fkey" FOREIGN KEY ("marketplaceId")
    REFERENCES "StampMarketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StampMarketplaceInstall"
    ADD CONSTRAINT "StampMarketplaceInstall_schoolId_fkey" FOREIGN KEY ("schoolId")
    REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StampMarketplaceInstall"
    ADD CONSTRAINT "StampMarketplaceInstall_templateId_fkey" FOREIGN KEY ("templateId")
    REFERENCES "StampTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
