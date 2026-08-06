-- Store the durable position of a student within a class register.
ALTER TABLE "Enrollment" ADD COLUMN "sequenceNumber" INTEGER;

-- Null values are intentionally allowed during the one-time backfill and
-- while a register is being resequenced inside a transaction.
CREATE UNIQUE INDEX "Enrollment_classId_academicYearId_sequenceNumber_key"
ON "Enrollment"("classId", "academicYearId", "sequenceNumber");
