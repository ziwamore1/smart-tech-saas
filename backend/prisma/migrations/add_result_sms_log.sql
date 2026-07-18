-- Create ResultSmsLog table for tracking result SMS delivery
CREATE TABLE "ResultSmsLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "parentId" TEXT,
    "parentName" TEXT,
    "studentName" TEXT NOT NULL,
    "admissionNumber" TEXT,
    "phoneNumber" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "errorSuggestion" TEXT,
    "batchId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultSmsLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "ResultSmsLog_schoolId_idx" ON "ResultSmsLog"("schoolId");
CREATE INDEX "ResultSmsLog_classId_idx" ON "ResultSmsLog"("classId");
CREATE INDEX "ResultSmsLog_termId_idx" ON "ResultSmsLog"("termId");
CREATE INDEX "ResultSmsLog_batchId_idx" ON "ResultSmsLog"("batchId");
CREATE INDEX "ResultSmsLog_status_idx" ON "ResultSmsLog"("status");
CREATE INDEX "ResultSmsLog_createdAt_idx" ON "ResultSmsLog"("createdAt");
