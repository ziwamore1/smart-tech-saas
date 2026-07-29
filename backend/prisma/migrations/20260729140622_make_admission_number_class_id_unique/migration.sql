-- Replace the non-unique index on (admissionNumber, classId) with a unique constraint
-- to enforce per-class admission number uniqueness at the database level
DROP INDEX IF EXISTS "Student_admissionNumber_classId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Student_admissionNumber_classId_key" ON "Student"("admissionNumber", "classId");
