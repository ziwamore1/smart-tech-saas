-- AlterTable: Add examType column to AssessmentDefinition
ALTER TABLE "AssessmentDefinition" ADD COLUMN "examType" "ExamType";

-- CreateIndex
CREATE INDEX "AssessmentDefinition_examType_idx" ON "AssessmentDefinition"("examType");
