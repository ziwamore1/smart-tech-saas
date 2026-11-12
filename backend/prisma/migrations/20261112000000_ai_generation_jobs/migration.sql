-- Durable provider request history. This does not alter examination records.
CREATE TYPE "AiGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "AiGenerationJob" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "blueprintId" TEXT,
  "requestedById" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "status" "AiGenerationStatus" NOT NULL DEFAULT 'QUEUED',
  "request" JSONB NOT NULL,
  "response" JSONB,
  "error" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCost" DOUBLE PRECISION,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiGenerationJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiGenerationJob_schoolId_status_idx" ON "AiGenerationJob"("schoolId", "status");
CREATE INDEX "AiGenerationJob_subjectId_idx" ON "AiGenerationJob"("subjectId");
CREATE INDEX "AiGenerationJob_blueprintId_idx" ON "AiGenerationJob"("blueprintId");
ALTER TABLE "AiGenerationJob" ADD CONSTRAINT "AiGenerationJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiGenerationJob" ADD CONSTRAINT "AiGenerationJob_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiGenerationJob" ADD CONSTRAINT "AiGenerationJob_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiGenerationJob" ADD CONSTRAINT "AiGenerationJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExaminationVersion" ADD COLUMN "generationJobId" TEXT;
CREATE INDEX "ExaminationVersion_generationJobId_idx" ON "ExaminationVersion"("generationJobId");
ALTER TABLE "ExaminationVersion" ADD CONSTRAINT "ExaminationVersion_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "AiGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
