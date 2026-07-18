-- DropIndex
DROP INDEX "SchoolRoleAssignment_schoolId_idx";

-- CreateTable
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

-- CreateIndex
CREATE INDEX "ResultSmsLog_schoolId_idx" ON "ResultSmsLog"("schoolId");

-- CreateIndex
CREATE INDEX "ResultSmsLog_classId_idx" ON "ResultSmsLog"("classId");

-- CreateIndex
CREATE INDEX "ResultSmsLog_termId_idx" ON "ResultSmsLog"("termId");

-- CreateIndex
CREATE INDEX "ResultSmsLog_batchId_idx" ON "ResultSmsLog"("batchId");

-- CreateIndex
CREATE INDEX "ResultSmsLog_status_idx" ON "ResultSmsLog"("status");

-- CreateIndex
CREATE INDEX "ResultSmsLog_createdAt_idx" ON "ResultSmsLog"("createdAt");
