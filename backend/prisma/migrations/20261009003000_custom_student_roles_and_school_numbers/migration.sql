CREATE TABLE IF NOT EXISTS "StudentLeadershipRole" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "schoolId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "title" TEXT NOT NULL, "institutionTier" TEXT NOT NULL DEFAULT 'SECONDARY_SCHOOL', "minimumPoints" INTEGER NOT NULL DEFAULT 10,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentLeadershipRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentLeadershipRole_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentLeadershipRole_schoolId_code_key" ON "StudentLeadershipRole"("schoolId", "code");
CREATE INDEX IF NOT EXISTS "StudentLeadershipRole_schoolId_institutionTier_isActive_idx" ON "StudentLeadershipRole"("schoolId", "institutionTier", "isActive");

CREATE TABLE IF NOT EXISTS "SchoolRegistrationSequence" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "key" TEXT NOT NULL DEFAULT 'SCHOOL', "nextValue" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolRegistrationSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRegistrationSequence_key_key" ON "SchoolRegistrationSequence"("key");

-- Existing schools without identifiers receive deterministic, collision-free IDs.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n
  FROM "School"
  WHERE "registrationNumber" IS NULL
)
UPDATE "School" s
SET "registrationNumber" = 'ST-AUTO-' || EXTRACT(YEAR FROM COALESCE(s."createdAt", CURRENT_TIMESTAMP))::text || '-' || LPAD(numbered.n::text, 6, '0')
FROM numbered
WHERE s."id" = numbered."id";

INSERT INTO "SchoolRegistrationSequence" ("key", "nextValue")
VALUES ('SCHOOL', (SELECT COALESCE(MAX((substring("registrationNumber" FROM 'ST-AUTO-[0-9]{4}-([0-9]+)$'))::integer), 0) + 1 FROM "School"))
ON CONFLICT ("key") DO UPDATE SET "nextValue" = GREATEST("SchoolRegistrationSequence"."nextValue", EXCLUDED."nextValue");
