-- CreateEnum
CREATE TYPE "ResultSheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'PUBLISHED', 'LOCKED');

-- CreateTable
CREATE TABLE "ResultSheet" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'END_TERM',
    "academicYearId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" "ResultSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "enteredCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultAuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT,
    "subjectId" TEXT,
    "classId" TEXT,
    "termId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "performedBy" TEXT NOT NULL,
    "performedByRole" TEXT,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResultSheet_schoolId_idx" ON "ResultSheet"("schoolId");

-- CreateIndex
CREATE INDEX "ResultSheet_classId_idx" ON "ResultSheet"("classId");

-- CreateIndex
CREATE INDEX "ResultSheet_termId_idx" ON "ResultSheet"("termId");

-- CreateIndex
CREATE INDEX "ResultSheet_status_idx" ON "ResultSheet"("status");

-- CreateIndex
CREATE INDEX "ResultSheet_examType_idx" ON "ResultSheet"("examType");

-- CreateIndex
CREATE UNIQUE INDEX "ResultSheet_classId_termId_examType_key" ON "ResultSheet"("classId", "termId", "examType");

-- CreateIndex
CREATE INDEX "ResultAuditLog_schoolId_idx" ON "ResultAuditLog"("schoolId");

-- CreateIndex
CREATE INDEX "ResultAuditLog_entityType_entityId_idx" ON "ResultAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ResultAuditLog_studentId_idx" ON "ResultAuditLog"("studentId");

-- CreateIndex
CREATE INDEX "ResultAuditLog_classId_idx" ON "ResultAuditLog"("classId");

-- CreateIndex
CREATE INDEX "ResultAuditLog_termId_idx" ON "ResultAuditLog"("termId");

-- CreateIndex
CREATE INDEX "ResultAuditLog_action_idx" ON "ResultAuditLog"("action");

-- CreateIndex
CREATE INDEX "ResultAuditLog_createdAt_idx" ON "ResultAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ResultAuditLog_performedBy_idx" ON "ResultAuditLog"("performedBy");

-- AddForeignKey
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultAuditLog" ADD CONSTRAINT "ResultAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
