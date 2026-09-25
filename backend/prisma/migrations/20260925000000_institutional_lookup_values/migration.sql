CREATE TABLE "InstitutionalLookupValue" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "category" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "parentCode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstitutionalLookupValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionalLookupValue_schoolId_category_code_key" ON "InstitutionalLookupValue"("schoolId", "category", "code");
CREATE INDEX "InstitutionalLookupValue_schoolId_category_active_idx" ON "InstitutionalLookupValue"("schoolId", "category", "active");
CREATE INDEX "InstitutionalLookupValue_category_parentCode_idx" ON "InstitutionalLookupValue"("category", "parentCode");
