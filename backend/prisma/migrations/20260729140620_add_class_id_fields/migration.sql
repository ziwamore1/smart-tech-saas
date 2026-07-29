-- Add classId column to Student (nullable for backward compatibility with existing data)
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "classId" TEXT;

-- Add classId column to AdmissionSequence (nullable for backward compatibility)
ALTER TABLE "AdmissionSequence" ADD COLUMN IF NOT EXISTS "classId" TEXT;

-- Backfill existing Student rows with a sentinel value so future NOT NULL migration is safe
UPDATE "Student" SET "classId" = '__SCHOOL__' WHERE "classId" IS NULL;

-- Backfill existing AdmissionSequence rows
UPDATE "AdmissionSequence" SET "classId" = '__SCHOOL__' WHERE "classId" IS NULL;

-- Make classId NOT NULL on AdmissionSequence (required for unique constraint)
ALTER TABLE "AdmissionSequence" ALTER COLUMN "classId" SET NOT NULL;

-- Drop old unique constraints on AdmissionSequence that conflict with new one
DROP INDEX IF EXISTS "AdmissionSequence_schoolId_academicYearId_key";
DROP INDEX IF EXISTS "AdmissionSequence_schoolId_year_key";

-- Create new unique constraint on AdmissionSequence including classId
CREATE UNIQUE INDEX IF NOT EXISTS "AdmissionSequence_schoolId_academicYearId_classId_key" ON "AdmissionSequence"("schoolId", "academicYearId", "classId");

-- Create index on Student.classId
CREATE INDEX IF NOT EXISTS "Student_classId_idx" ON "Student"("classId");

-- Create index for admissionNumber + classId lookups
CREATE INDEX IF NOT EXISTS "Student_admissionNumber_classId_idx" ON "Student"("admissionNumber", "classId");
