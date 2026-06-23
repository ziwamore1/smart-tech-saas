-- =============================================================================
-- Backfill ECZ_COMPETENCY Grading Policy for existing secondary schools
-- Creates the 5-level competency-based policy (Forms 1-4 / New Curriculum)
-- alongside the existing ECZ_ZM (Grades 10-12 / Old Curriculum)
-- Idempotent — safe to re-run
-- Usage: psql $DATABASE_URL -f backend/prisma/backfill-ecz-competency.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
  school_record RECORD;
  policy_id UUID;
BEGIN
  FOR school_record IN
    SELECT s.id AS school_id
    FROM "School" s
    JOIN "InstitutionType" it ON it.id = s."institutionTypeId"
    WHERE it.code::text IN ('SECONDARY_SCHOOL', 'ADVANCED_SECONDARY')
      AND NOT EXISTS (
        SELECT 1 FROM "GradingPolicy" gp
        WHERE gp."schoolId" = s.id AND gp.code = 'ECZ_COMPETENCY'
      )
  LOOP
    policy_id := gen_random_uuid();

    INSERT INTO "GradingPolicy" (id, "schoolId", name, code, type, "isDefault", active, config, "createdAt", "updatedAt")
    VALUES (
      policy_id,
      school_record.school_id,
      'ECZ Competency Based (Forms 1-4)',
      'ECZ_COMPETENCY',
      'COMPETENCY',
      false,
      true,
      '{}'::jsonb,
      NOW(),
      NOW()
    );

    INSERT INTO "GradingScale" (id, "policyId", "minScore", "maxScore", grade, remark, points, gpa, "sortOrder", "createdAt")
    VALUES
      (gen_random_uuid(), policy_id, 70, 100, '1', 'Outstanding',     1, 4.0, 1, NOW()),
      (gen_random_uuid(), policy_id, 60, 69,  '2', 'Advanced',        2, 3.5, 2, NOW()),
      (gen_random_uuid(), policy_id, 50, 59,  '3', 'Basic',           3, 3.0, 3, NOW()),
      (gen_random_uuid(), policy_id, 40, 49,  '4', 'Satisfactory',    4, 2.0, 4, NOW()),
      (gen_random_uuid(), policy_id, 0,  39,  '5', 'Unsatisfactory',  5, 0,   5, NOW());

    RAISE NOTICE 'Created ECZ_COMPETENCY policy for school %', school_record.school_id;
  END LOOP;
END $$;

COMMIT;
