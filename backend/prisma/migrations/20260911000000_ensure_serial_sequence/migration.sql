-- Ensures the SerialSequence table exists.
--
-- Some production databases created the stamp-engine tables via `prisma db push`
-- against an older schema snapshot that predated this relation, so
-- migrate-deploy cannot assume the original migration already materialised it.
-- Every statement below is idempotent, so the migration is safe to apply even
-- when some or all of the objects already exist.

CREATE TABLE IF NOT EXISTS "SerialSequence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SerialSequence_schoolId_scopeKey_key" ON "SerialSequence"("schoolId", "scopeKey");
CREATE INDEX IF NOT EXISTS "SerialSequence_schoolId_idx" ON "SerialSequence"("schoolId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SerialSequence_schoolId_fkey'
  ) THEN
    ALTER TABLE "SerialSequence"
      ADD CONSTRAINT "SerialSequence_schoolId_fkey" FOREIGN KEY ("schoolId")
      REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;