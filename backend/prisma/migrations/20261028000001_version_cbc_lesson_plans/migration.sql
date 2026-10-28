ALTER TABLE "CurriculumLessonPlan"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "generationInstruction" TEXT,
ADD COLUMN "reusedFromId" TEXT;

CREATE INDEX "CurriculumLessonPlan_reusedFromId_idx"
ON "CurriculumLessonPlan"("reusedFromId");

ALTER TABLE "CurriculumLessonPlan"
ADD CONSTRAINT "CurriculumLessonPlan_reusedFromId_fkey"
FOREIGN KEY ("reusedFromId") REFERENCES "CurriculumLessonPlan"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
