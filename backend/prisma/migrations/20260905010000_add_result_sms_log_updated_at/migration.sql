-- Add the NOT NULL @updatedAt column to ResultSmsLog.
-- Backfill existing rows (Prisma manages the value on create/update, so no
-- DB default is needed — matching the schema exactly and avoiding drift).
ALTER TABLE "ResultSmsLog" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "ResultSmsLog" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP);

ALTER TABLE "ResultSmsLog" ALTER COLUMN "updatedAt" SET NOT NULL;