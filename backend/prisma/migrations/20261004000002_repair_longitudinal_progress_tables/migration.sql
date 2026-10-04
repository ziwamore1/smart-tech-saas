CREATE TABLE IF NOT EXISTS "ProgressEvidence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "streamId" TEXT,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT,
    "assessmentId" TEXT,
    "assessmentTypeId" TEXT,
    "topicId" TEXT,
    "competencyId" TEXT,
    "rawScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "weightedScore" DOUBLE PRECISION,
    "grade" TEXT,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgressEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProgressEvidence_sourceType_sourceId_key" ON "ProgressEvidence"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "ProgressEvidence_schoolId_studentId_academicYearId_termId_subjectId_idx" ON "ProgressEvidence"("schoolId", "studentId", "academicYearId", "termId", "subjectId");
CREATE INDEX IF NOT EXISTS "ProgressEvidence_schoolId_classId_academicYearId_termId_subjectId_idx" ON "ProgressEvidence"("schoolId", "classId", "academicYearId", "termId", "subjectId");
CREATE INDEX IF NOT EXISTS "ProgressEvidence_studentId_subjectId_recordedAt_idx" ON "ProgressEvidence"("studentId", "subjectId", "recordedAt");
CREATE INDEX IF NOT EXISTS "ProgressEvidence_teacherId_subjectId_academicYearId_termId_idx" ON "ProgressEvidence"("teacherId", "subjectId", "academicYearId", "termId");
CREATE INDEX IF NOT EXISTS "ProgressEvidence_assessmentTypeId_idx" ON "ProgressEvidence"("assessmentTypeId");
CREATE INDEX IF NOT EXISTS "ProgressEvidence_topicId_idx" ON "ProgressEvidence"("topicId");
CREATE INDEX IF NOT EXISTS "ProgressEvidence_competencyId_idx" ON "ProgressEvidence"("competencyId");

CREATE TABLE IF NOT EXISTS "AcademicProgressSnapshot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "assessmentCount" INTEGER NOT NULL DEFAULT 0,
    "averagePercentage" DOUBLE PRECISION,
    "weightedAverage" DOUBLE PRECISION,
    "median" DOUBLE PRECISION,
    "standardDeviation" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "rank" INTEGER,
    "grade" TEXT,
    "passStatus" TEXT,
    "trendDirection" TEXT,
    "trendStrength" DOUBLE PRECISION,
    "attendancePercentage" DOUBLE PRECISION,
    "competencyScore" DOUBLE PRECISION,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicProgressSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AcademicProgressSnapshot_studentId_academicYearId_termId_classId_subjectId_key" ON "AcademicProgressSnapshot"("studentId", "academicYearId", "termId", "classId", "subjectId");
CREATE INDEX IF NOT EXISTS "AcademicProgressSnapshot_schoolId_academicYearId_termId_classId_subjectId_idx" ON "AcademicProgressSnapshot"("schoolId", "academicYearId", "termId", "classId", "subjectId");
CREATE INDEX IF NOT EXISTS "AcademicProgressSnapshot_studentId_subjectId_generatedAt_idx" ON "AcademicProgressSnapshot"("studentId", "subjectId", "generatedAt");

CREATE TABLE IF NOT EXISTS "StudentAcademicYearSummary" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT,
    "overallAverage" DOUBLE PRECISION,
    "median" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "overallGrade" TEXT,
    "subjectsTaken" INTEGER NOT NULL DEFAULT 0,
    "subjectsPassed" INTEGER NOT NULL DEFAULT 0,
    "subjectsFailed" INTEGER NOT NULL DEFAULT 0,
    "strongestSubject" TEXT,
    "weakestSubject" TEXT,
    "improvementRate" DOUBLE PRECISION,
    "declineRate" DOUBLE PRECISION,
    "attendancePercentage" DOUBLE PRECISION,
    "riskLevel" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAcademicYearSummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentAcademicYearSummary_studentId_academicYearId_key" ON "StudentAcademicYearSummary"("studentId", "academicYearId");
CREATE INDEX IF NOT EXISTS "StudentAcademicYearSummary_schoolId_academicYearId_idx" ON "StudentAcademicYearSummary"("schoolId", "academicYearId");
CREATE INDEX IF NOT EXISTS "StudentAcademicYearSummary_studentId_generatedAt_idx" ON "StudentAcademicYearSummary"("studentId", "generatedAt");
