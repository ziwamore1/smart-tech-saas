-- Additive AI-EXAMINOR foundation. Existing examination records are preserved.
CREATE TYPE "ExamAuthoringStatus" AS ENUM ('DRAFT', 'GENERATED', 'VALIDATION_IN_PROGRESS', 'PASSED_WITH_WARNINGS', 'PASSED', 'MODERATION', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "ExamValidationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE "ExamArtifactType" AS ENUM ('CANDIDATE_PDF', 'EXAMINER_PDF', 'COMBINED_PDF', 'CANDIDATE_DOCX', 'EXAMINER_DOCX', 'ANSWER_BOOKLET_PDF');
CREATE TYPE "ExamAuditAction" AS ENUM ('CREATED', 'UPDATED', 'GENERATED', 'DUPLICATED', 'VERSION_CREATED', 'QUESTION_UPDATED', 'MARKING_KEY_UPDATED', 'VALIDATION_STARTED', 'VALIDATION_COMPLETED', 'SUBMITTED_FOR_MODERATION', 'MODERATION_COMMENTED', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED', 'EXPORTED');

ALTER TABLE "Exam" ADD COLUMN "blueprintId" TEXT;
ALTER TABLE "Exam" ADD COLUMN "authoringStatus" "ExamAuthoringStatus" NOT NULL DEFAULT 'DRAFT';
CREATE INDEX "Exam_blueprintId_idx" ON "Exam"("blueprintId");
CREATE INDEX "Exam_authoringStatus_idx" ON "Exam"("authoringStatus");

CREATE TABLE "ExamBlueprint" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "schoolId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "academicStageId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "structure" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamBlueprint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExamBlueprint_schoolId_idx" ON "ExamBlueprint"("schoolId");
CREATE INDEX "ExamBlueprint_subjectId_idx" ON "ExamBlueprint"("subjectId");
CREATE INDEX "ExamBlueprint_status_idx" ON "ExamBlueprint"("status");
ALTER TABLE "ExamBlueprint" ADD CONSTRAINT "ExamBlueprint_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamBlueprint" ADD CONSTRAINT "ExamBlueprint_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamBlueprint" ADD CONSTRAINT "ExamBlueprint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ExaminationVersion" (
  "id" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "blueprintId" TEXT,
  "schoolId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ExamAuthoringStatus" NOT NULL DEFAULT 'DRAFT',
  "snapshot" JSONB NOT NULL,
  "contentHash" TEXT,
  "changeSummary" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "ExaminationVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExaminationVersion_examId_version_key" ON "ExaminationVersion"("examId", "version");
CREATE INDEX "ExaminationVersion_schoolId_status_idx" ON "ExaminationVersion"("schoolId", "status");
CREATE INDEX "ExaminationVersion_contentHash_idx" ON "ExaminationVersion"("contentHash");
ALTER TABLE "ExaminationVersion" ADD CONSTRAINT "ExaminationVersion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExaminationVersion" ADD CONSTRAINT "ExaminationVersion_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExaminationVersion" ADD CONSTRAINT "ExaminationVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationVersion" ADD CONSTRAINT "ExaminationVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExaminationVersion" ADD CONSTRAINT "ExaminationVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ExaminationMarkingScheme" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "schemeVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "instructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExaminationMarkingScheme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExaminationMarkingScheme_versionId_key" ON "ExaminationMarkingScheme"("versionId");
ALTER TABLE "ExaminationMarkingScheme" ADD CONSTRAINT "ExaminationMarkingScheme_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExaminationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExaminationMarkingEntry" (
  "id" TEXT NOT NULL,
  "schemeId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "taskLabel" TEXT,
  "expectedAnswer" TEXT NOT NULL,
  "solution" TEXT,
  "criteria" JSONB NOT NULL,
  "alternatives" JSONB,
  "commonErrors" JSONB,
  "specialInstructions" TEXT,
  "marks" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExaminationMarkingEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExaminationMarkingEntry_schemeId_idx" ON "ExaminationMarkingEntry"("schemeId");
CREATE INDEX "ExaminationMarkingEntry_questionId_idx" ON "ExaminationMarkingEntry"("questionId");
ALTER TABLE "ExaminationMarkingEntry" ADD CONSTRAINT "ExaminationMarkingEntry_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "ExaminationMarkingScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExaminationMarkingEntry" ADD CONSTRAINT "ExaminationMarkingEntry_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExaminationDiagram" (
  "id" TEXT NOT NULL,
  "questionId" TEXT,
  "versionId" TEXT,
  "name" TEXT NOT NULL,
  "diagramType" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "definition" JSONB NOT NULL,
  "renderedSvg" TEXT,
  "assetUrl" TEXT,
  "contentHash" TEXT,
  "isTechnicallyVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExaminationDiagram_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExaminationDiagram_questionId_idx" ON "ExaminationDiagram"("questionId");
CREATE INDEX "ExaminationDiagram_versionId_idx" ON "ExaminationDiagram"("versionId");
ALTER TABLE "ExaminationDiagram" ADD CONSTRAINT "ExaminationDiagram_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExaminationDiagram" ADD CONSTRAINT "ExaminationDiagram_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExaminationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExaminationValidationRun" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "validatorVersion" TEXT,
  "summary" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ExaminationValidationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExaminationValidationRun_versionId_status_idx" ON "ExaminationValidationRun"("versionId", "status");
ALTER TABLE "ExaminationValidationRun" ADD CONSTRAINT "ExaminationValidationRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExaminationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExaminationValidationFinding" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "severity" "ExamValidationSeverity" NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "location" TEXT,
  "suggestion" TEXT,
  "isResolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExaminationValidationFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExaminationValidationFinding_runId_severity_idx" ON "ExaminationValidationFinding"("runId", "severity");
ALTER TABLE "ExaminationValidationFinding" ADD CONSTRAINT "ExaminationValidationFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ExaminationValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExaminationModerationRecord" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "comments" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExaminationModerationRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExaminationModerationRecord_versionId_idx" ON "ExaminationModerationRecord"("versionId");
CREATE INDEX "ExaminationModerationRecord_reviewerId_idx" ON "ExaminationModerationRecord"("reviewerId");
ALTER TABLE "ExaminationModerationRecord" ADD CONSTRAINT "ExaminationModerationRecord_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExaminationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExaminationModerationRecord" ADD CONSTRAINT "ExaminationModerationRecord_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ExaminationArtifact" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "type" "ExamArtifactType" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "downloadUrl" TEXT,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExaminationArtifact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExaminationArtifact_versionId_type_key" ON "ExaminationArtifact"("versionId", "type");
CREATE INDEX "ExaminationArtifact_schoolId_idx" ON "ExaminationArtifact"("schoolId");
ALTER TABLE "ExaminationArtifact" ADD CONSTRAINT "ExaminationArtifact_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExaminationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExaminationArtifact" ADD CONSTRAINT "ExaminationArtifact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ExaminationAuditLog" (
  "id" TEXT NOT NULL,
  "versionId" TEXT,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT,
  "action" "ExamAuditAction" NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExaminationAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExaminationAuditLog_schoolId_createdAt_idx" ON "ExaminationAuditLog"("schoolId", "createdAt");
CREATE INDEX "ExaminationAuditLog_versionId_idx" ON "ExaminationAuditLog"("versionId");
ALTER TABLE "ExaminationAuditLog" ADD CONSTRAINT "ExaminationAuditLog_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ExaminationVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExaminationAuditLog" ADD CONSTRAINT "ExaminationAuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExaminationAuditLog" ADD CONSTRAINT "ExaminationAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
