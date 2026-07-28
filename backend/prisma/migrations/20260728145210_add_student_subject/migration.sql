-- DropIndex (safe: IF EXISTS)
DROP INDEX IF EXISTS "SchoolRoleAssignment_schoolId_idx";

-- AlterTable: backfill NULL status values before making required
UPDATE "GeneratedReport" SET "status" = 'DRAFT' WHERE "status" IS NULL;
ALTER TABLE "GeneratedReport" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "GeneratedReport" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
