-- Preserve existing computed rows as End-of-Term results, then allow one
-- computed result per student, subject, term, and exam type.
ALTER TABLE "ComputedResult" ADD COLUMN "examType" TEXT NOT NULL DEFAULT 'END_TERM';

DROP INDEX IF EXISTS "ComputedResult_studentId_subjectId_termId_key";

CREATE UNIQUE INDEX "ComputedResult_studentId_subjectId_termId_examType_key"
  ON "ComputedResult"("studentId", "subjectId", "termId", "examType");

CREATE INDEX "ComputedResult_examType_idx" ON "ComputedResult"("examType");
