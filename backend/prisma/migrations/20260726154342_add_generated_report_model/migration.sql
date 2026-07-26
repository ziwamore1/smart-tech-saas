-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "studentId" TEXT,
    "className" TEXT,
    "classId" TEXT,
    "termId" TEXT,
    "academicYear" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT DEFAULT 'application/pdf',
    "templateId" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedByName" TEXT,
    "status" TEXT DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedReport_schoolId_idx" ON "GeneratedReport"("schoolId");

-- CreateIndex
CREATE INDEX "GeneratedReport_reportType_idx" ON "GeneratedReport"("reportType");

-- CreateIndex
CREATE INDEX "GeneratedReport_studentId_idx" ON "GeneratedReport"("studentId");

-- CreateIndex
CREATE INDEX "GeneratedReport_classId_idx" ON "GeneratedReport"("classId");

-- CreateIndex
CREATE INDEX "GeneratedReport_termId_idx" ON "GeneratedReport"("termId");

-- CreateIndex
CREATE INDEX "GeneratedReport_generatedById_idx" ON "GeneratedReport"("generatedById");

-- CreateIndex
CREATE INDEX "GeneratedReport_createdAt_idx" ON "GeneratedReport"("createdAt");
