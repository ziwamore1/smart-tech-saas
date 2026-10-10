-- Ensure the platform sequence exists before repairing legacy schools.
CREATE TABLE IF NOT EXISTS "SchoolRegistrationSequence" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL DEFAULT 'SCHOOL',
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolRegistrationSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRegistrationSequence_key_key"
  ON "SchoolRegistrationSequence"("key");

-- Assign numbers only to schools that have no usable platform number.
WITH current_max AS (
  SELECT COALESCE(MAX((substring("registrationNumber" FROM '^ST-AUTO-[0-9]{4}-([0-9]+)$'))::integer), 0) AS value
  FROM "School"
), missing AS (
  SELECT
    s."id",
    s."createdAt",
    current_max.value + ROW_NUMBER() OVER (ORDER BY s."createdAt", s."id") AS sequence_value
  FROM "School" s
  CROSS JOIN current_max
  WHERE NULLIF(BTRIM(s."registrationNumber"), '') IS NULL
)
UPDATE "School" s
SET "registrationNumber" = 'ST-AUTO-'
  || EXTRACT(YEAR FROM COALESCE(missing."createdAt", CURRENT_TIMESTAMP))::text
  || '-'
  || LPAD(missing.sequence_value::text, 6, '0')
FROM missing
WHERE s."id" = missing."id";

-- Keep future allocations above every assigned automatic number.
INSERT INTO "SchoolRegistrationSequence" ("key", "nextValue")
VALUES (
  'SCHOOL',
  (SELECT COALESCE(MAX((substring("registrationNumber" FROM '^ST-AUTO-[0-9]{4}-([0-9]+)$'))::integer), 0) + 1 FROM "School")
)
ON CONFLICT ("key") DO UPDATE
SET "nextValue" = GREATEST(
  "SchoolRegistrationSequence"."nextValue",
  EXCLUDED."nextValue"
);
