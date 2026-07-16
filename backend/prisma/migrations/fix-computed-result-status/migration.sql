-- One-time migration: Fix ComputedResult records with invalid 'COMPLETED' status
-- These were created by result.service.ts which used 'COMPLETED' instead of 'COMPUTED'
-- The ComputedResultStatus enum only allows: PENDING, COMPUTING, COMPUTED, VERIFIED, LOCKED

UPDATE "ComputedResult"
SET "status" = 'COMPUTED', "computedAt" = COALESCE("computedAt", NOW())
WHERE "status"::text = 'COMPLETED';

-- Fix StudentAssessmentResult records stuck as DRAFT
-- Assessment engine now saves as SUBMITTED; existing DRAFT records with scores should be SUBMITTED
-- so grading engine and report card engine can include them

UPDATE "StudentAssessmentResult"
SET "status" = 'SUBMITTED'
WHERE "status" = 'DRAFT' AND "rawScore" IS NOT NULL;
