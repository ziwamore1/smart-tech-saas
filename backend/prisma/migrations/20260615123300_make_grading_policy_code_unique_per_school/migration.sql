-- Drop the global unique constraint on GradingPolicy.code
ALTER TABLE "GradingPolicy" DROP CONSTRAINT IF EXISTS "GradingPolicy_code_key";

-- Drop the index if it exists as an index rather than a constraint
DROP INDEX IF EXISTS "GradingPolicy_code_key";

-- Create a unique constraint on (schoolId, code)
CREATE UNIQUE INDEX "GradingPolicy_schoolId_code_key" ON "GradingPolicy" ("schoolId", "code");
