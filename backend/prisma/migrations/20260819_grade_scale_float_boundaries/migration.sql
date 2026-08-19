-- AlterTable: Change GradeScale minScore/maxScore from Int to Float
-- This fixes decimal percentages (e.g. 74.2%) failing to match grade ranges
-- when boundaries are integers (e.g. 70-74, the score 74.2 > 74 fails)
ALTER TABLE "GradeScale" ALTER COLUMN "minScore" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "GradeScale" ALTER COLUMN "maxScore" SET DATA TYPE DOUBLE PRECISION;
