-- Drop the old unique constraint on (admissionNumber, schoolId) that still exists from before the per-class migration
-- This constraint blocks re-sequencing admission numbers per class since the same number can exist in different classes
DROP INDEX IF EXISTS "Student_admissionNumber_schoolId_key";
