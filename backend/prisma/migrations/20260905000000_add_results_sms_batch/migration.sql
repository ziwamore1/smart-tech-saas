-- CreateTable
CREATE TABLE "ResultSmsBatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "termId" TEXT,
    "initiatedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "retrying" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "sending" INTEGER NOT NULL DEFAULT 0,
    "queued" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "estimatedUnits" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorSuggestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResultSmsBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResultSmsBatch_schoolId_idx" ON "ResultSmsBatch"("schoolId");

-- CreateIndex
CREATE INDEX "ResultSmsBatch_schoolId_status_idx" ON "ResultSmsBatch"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ResultSmsBatch_classId_termId_idx" ON "ResultSmsBatch"("classId", "termId");

-- CreateIndex
CREATE INDEX "ResultSmsBatch_createdAt_idx" ON "ResultSmsBatch"("createdAt");

-- AlterTable
ALTER TABLE "ResultSmsLog" ADD COLUMN "nextRetryAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ResultSmsLog_nextRetryAt_idx" ON "ResultSmsLog"("nextRetryAt");