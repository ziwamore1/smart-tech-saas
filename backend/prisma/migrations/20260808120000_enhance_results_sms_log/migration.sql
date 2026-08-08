ALTER TABLE "ResultSmsLog"
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resultVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "providerResponse" TEXT,
  ADD COLUMN IF NOT EXISTS "failureCode" TEXT,
  ADD COLUMN IF NOT EXISTS "initiatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "messageHash" TEXT;

CREATE INDEX IF NOT EXISTS "ResultSmsLog_studentId_termId_resultVersion_idx"
  ON "ResultSmsLog"("studentId", "termId", "resultVersion");
