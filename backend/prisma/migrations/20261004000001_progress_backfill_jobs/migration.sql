CREATE TABLE "ProgressBackfillJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "evidence" INTEGER NOT NULL DEFAULT 0,
    "snapshots" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgressBackfillJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressBackfillJob_schoolId_status_idx" ON "ProgressBackfillJob"("schoolId", "status");
CREATE INDEX "ProgressBackfillJob_createdAt_idx" ON "ProgressBackfillJob"("createdAt");
