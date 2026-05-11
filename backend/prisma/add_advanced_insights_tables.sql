-- Advanced Educational Intelligence features
-- Run this against your database after steps 1-3 from previous migration
-- Then run: npx prisma db pull && npx prisma generate

-- National Benchmarking
CREATE TABLE IF NOT EXISTS "NationalBenchmark" (
    id TEXT NOT NULL PRIMARY KEY,
    "subjectId" TEXT NOT NULL,
    year INTEGER NOT NULL,
    "termName" TEXT,
    average DOUBLE PRECISION NOT NULL,
    "stdDev" DOUBLE PRECISION,
    "passRate" DOUBLE PRECISION,
    median DOUBLE PRECISION,
    "schoolType" TEXT,
    region TEXT,
    source TEXT,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NationalBenchmark_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"(id) ON DELETE CASCADE,
    CONSTRAINT "NationalBenchmark_subjectId_year_termName_key" UNIQUE ("subjectId", "year", "termName")
);
CREATE INDEX IF NOT EXISTS "NationalBenchmark_subjectId_idx" ON "NationalBenchmark"("subjectId");
CREATE INDEX IF NOT EXISTS "NationalBenchmark_year_idx" ON "NationalBenchmark"("year");

-- AI Tutor Session
CREATE TABLE IF NOT EXISTS "AiTutorSession" (
    id TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT,
    topic TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiTutorSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE,
    CONSTRAINT "AiTutorSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "AiTutorSession_studentId_idx" ON "AiTutorSession"("studentId");
CREATE INDEX IF NOT EXISTS "AiTutorSession_schoolId_idx" ON "AiTutorSession"("schoolId");

-- AI Tutor Message
CREATE TABLE IF NOT EXISTS "AiTutorMessage" (
    id TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiTutorMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiTutorSession"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "AiTutorMessage_sessionId_idx" ON "AiTutorMessage"("sessionId");

-- AI Tutor Feedback
CREATE TABLE IF NOT EXISTS "AiTutorFeedback" (
    id TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL UNIQUE,
    rating INTEGER,
    helpful BOOLEAN,
    comment TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiTutorFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiTutorSession"(id) ON DELETE CASCADE
);

-- Learning Style Profile
CREATE TABLE IF NOT EXISTS "LearningStyleProfile" (
    id TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL UNIQUE,
    "visualScore" INTEGER NOT NULL DEFAULT 0,
    "auralScore" INTEGER NOT NULL DEFAULT 0,
    "readWriteScore" INTEGER NOT NULL DEFAULT 0,
    "kinestheticScore" INTEGER NOT NULL DEFAULT 0,
    "dominantStyle" TEXT,
    "lastAssessed" TIMESTAMP(3),
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningStyleProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE,
    CONSTRAINT "LearningStyleProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "LearningStyleProfile_schoolId_idx" ON "LearningStyleProfile"("schoolId");

-- Adaptive Test Session
DO $$ BEGIN
  CREATE TYPE "AdaptiveTestStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AdaptiveTestSession" (
    id TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "abilityEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abilitySE" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    status "AdaptiveTestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "schoolId" TEXT NOT NULL,
    CONSTRAINT "AdaptiveTestSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"(id) ON DELETE CASCADE,
    CONSTRAINT "AdaptiveTestSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"(id) ON DELETE CASCADE,
    CONSTRAINT "AdaptiveTestSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdaptiveTestSession_studentId_idx" ON "AdaptiveTestSession"("studentId");
CREATE INDEX IF NOT EXISTS "AdaptiveTestSession_schoolId_idx" ON "AdaptiveTestSession"("schoolId");

-- Adaptive Test Response
CREATE TABLE IF NOT EXISTS "AdaptiveTestResponse" (
    id TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "studentAnswer" TEXT,
    "isCorrect" BOOLEAN,
    difficulty DOUBLE PRECISION NOT NULL,
    discrimination DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    guessed BOOLEAN NOT NULL DEFAULT false,
    "responseTime" INTEGER,
    CONSTRAINT "AdaptiveTestResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveTestSession"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdaptiveTestResponse_sessionId_idx" ON "AdaptiveTestResponse"("sessionId");
