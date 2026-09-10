-- Seeds SerialSequence past every serial number already issued.
--
-- The counter was recreated empty (migration 20260911000000 and/or an earlier
-- reset) while DocumentSerial still holds historical rows, so fresh allocations
-- restart at sequence 1 and collide with existing serial numbers. This backfills
-- each scope to MAX(sequence) + 1, then adds an index so the runtime self-heal
-- in SerialNumberService.allocate can find the per-school/type/year maximum.

INSERT INTO "SerialSequence" ("id", "schoolId", "scopeKey", "prefix", "nextValue", "updatedAt")
SELECT
  gen_random_uuid(),
  "schoolId",
  "documentType" || ':' || COALESCE("year"::text, 'NONE'),
  'STS',
  MAX("sequence") + 2,
  NOW()
FROM "DocumentSerial"
GROUP BY "schoolId", "documentType", "year"
ON CONFLICT ("schoolId", "scopeKey")
DO UPDATE SET
  "nextValue" = GREATEST("SerialSequence"."nextValue", EXCLUDED."nextValue"),
  "prefix" = COALESCE("SerialSequence"."prefix", EXCLUDED."prefix"),
  "updatedAt" = NOW();

CREATE INDEX IF NOT EXISTS "DocumentSerial_school_type_year_idx"
  ON "DocumentSerial"("schoolId", "documentType", "year");