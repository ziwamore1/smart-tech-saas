-- AlterTable: Add isAbsent to StudentAssessmentResult
ALTER TABLE "StudentAssessmentResult" ADD COLUMN "isAbsent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add isAbsent to ComputedResult
ALTER TABLE "ComputedResult" ADD COLUMN "isAbsent" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex: Drop old unique constraint on Subject (name, schoolId)
DROP INDEX IF EXISTS "Subject_name_schoolId_key";

-- CreateIndex: New unique constraint on Subject (name, code, schoolId)
CREATE UNIQUE INDEX "Subject_name_code_schoolId_key" ON "Subject"("name", "code", "schoolId");
