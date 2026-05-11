-- Educational Intelligence & Analytics Platform
-- Migration script to add new tables without resetting existing data
-- Run this against your database, then run: npx prisma db pull && npx prisma generate

-- Enums
DO $$ BEGIN
  CREATE TYPE "InterventionCategory" AS ENUM ('ACADEMIC', 'BEHAVIORAL', 'ATTENDANCE', 'WELLNESS', 'PARENTAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InterventionOutcome" AS ENUM ('IMPROVED', 'STABLE', 'DECLINED', 'COMPLETED', 'DISCONTINUED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BehaviorCategory" AS ENUM ('GENERAL', 'POSITIVE', 'NEGATIVE', 'ACADEMIC', 'SOCIAL', 'ATTENDANCE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BehaviorSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GrowthStatus" AS ENUM ('EXCELLENT', 'IMPROVING', 'STABLE', 'DECLINING', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- LearningArea (sub-topics within subjects, e.g., Algebra under Math)
CREATE TABLE IF NOT EXISTS "LearningArea" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    CONSTRAINT "LearningArea_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"(id) ON DELETE CASCADE,
    CONSTRAINT "LearningArea_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE,
    CONSTRAINT "LearningArea_name_subjectId_schoolId_key" UNIQUE ("name", "subjectId", "schoolId")
);
CREATE INDEX IF NOT EXISTS "LearningArea_subjectId_idx" ON "LearningArea"("subjectId");

-- CompetencyScore (per-student per-learning-area scores per term)
CREATE TABLE IF NOT EXISTS "CompetencyScore" (
    id TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "learningAreaId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetencyScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE,
    CONSTRAINT "CompetencyScore_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "LearningArea"(id) ON DELETE CASCADE,
    CONSTRAINT "CompetencyScore_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"(id) ON DELETE CASCADE,
    CONSTRAINT "CompetencyScore_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE,
    CONSTRAINT "CompetencyScore_studentId_learningAreaId_termId_key" UNIQUE ("studentId", "learningAreaId", "termId")
);
CREATE INDEX IF NOT EXISTS "CompetencyScore_studentId_idx" ON "CompetencyScore"("studentId");
CREATE INDEX IF NOT EXISTS "CompetencyScore_learningAreaId_idx" ON "CompetencyScore"("learningAreaId");
CREATE INDEX IF NOT EXISTS "CompetencyScore_termId_idx" ON "CompetencyScore"("termId");

-- Intervention (intervention programs)
CREATE TABLE IF NOT EXISTS "Intervention" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category "InterventionCategory" NOT NULL DEFAULT 'ACADEMIC',
    "schoolId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Intervention_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Intervention_schoolId_idx" ON "Intervention"("schoolId");
CREATE INDEX IF NOT EXISTS "Intervention_category_idx" ON "Intervention"("category");

-- StudentIntervention (linking interventions to students)
CREATE TABLE IF NOT EXISTS "StudentIntervention" (
    id TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    outcome "InterventionOutcome",
    "outcomeScore" DOUBLE PRECISION,
    notes TEXT,
    "schoolId" TEXT NOT NULL,
    CONSTRAINT "StudentIntervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE,
    CONSTRAINT "StudentIntervention_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"(id) ON DELETE CASCADE,
    CONSTRAINT "StudentIntervention_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE,
    CONSTRAINT "StudentIntervention_studentId_interventionId_assignedAt_key" UNIQUE ("studentId", "interventionId", "assignedAt")
);
CREATE INDEX IF NOT EXISTS "StudentIntervention_studentId_idx" ON "StudentIntervention"("studentId");
CREATE INDEX IF NOT EXISTS "StudentIntervention_interventionId_idx" ON "StudentIntervention"("interventionId");

-- BehavioralRecord (student behavior tracking)
CREATE TABLE IF NOT EXISTS "BehavioralRecord" (
    id TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    category "BehaviorCategory" NOT NULL DEFAULT 'GENERAL',
    severity "BehaviorSeverity" NOT NULL DEFAULT 'MILD',
    description TEXT,
    "actionTaken" TEXT,
    "recordedById" TEXT,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BehavioralRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE,
    CONSTRAINT "BehavioralRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "BehavioralRecord_studentId_idx" ON "BehavioralRecord"("studentId");
CREATE INDEX IF NOT EXISTS "BehavioralRecord_recordDate_idx" ON "BehavioralRecord"("recordDate");
CREATE INDEX IF NOT EXISTS "BehavioralRecord_schoolId_idx" ON "BehavioralRecord"("schoolId");

-- StudentGrowthRecord (longitudinal performance snapshots)
CREATE TABLE IF NOT EXISTS "StudentGrowthRecord" (
    id TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    gpa DOUBLE PRECISION,
    percentile DOUBLE PRECISION,
    "classRank" INTEGER,
    "growthRate" DOUBLE PRECISION,
    status "GrowthStatus" NOT NULL DEFAULT 'STABLE',
    snapshot JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentGrowthRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE,
    CONSTRAINT "StudentGrowthRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"(id) ON DELETE CASCADE,
    CONSTRAINT "StudentGrowthRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE,
    CONSTRAINT "StudentGrowthRecord_studentId_termId_key" UNIQUE ("studentId", "termId")
);
CREATE INDEX IF NOT EXISTS "StudentGrowthRecord_studentId_idx" ON "StudentGrowthRecord"("studentId");
CREATE INDEX IF NOT EXISTS "StudentGrowthRecord_termId_idx" ON "StudentGrowthRecord"("termId");
CREATE INDEX IF NOT EXISTS "StudentGrowthRecord_status_idx" ON "StudentGrowthRecord"("status");
