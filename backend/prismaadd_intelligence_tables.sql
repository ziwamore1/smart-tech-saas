-- CreateEnum
CREATE TYPE "InterventionCategory" AS ENUM ('ACADEMIC', 'BEHAVIORAL', 'ATTENDANCE', 'WELLNESS', 'PARENTAL');

-- CreateEnum
CREATE TYPE "InterventionOutcome" AS ENUM ('IMPROVED', 'STABLE', 'DECLINED', 'COMPLETED', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "BehaviorCategory" AS ENUM ('GENERAL', 'POSITIVE', 'NEGATIVE', 'ACADEMIC', 'SOCIAL', 'ATTENDANCE');

-- CreateEnum
CREATE TYPE "BehaviorSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "GrowthStatus" AS ENUM ('EXCELLENT', 'IMPROVING', 'STABLE', 'DECLINING', 'CRITICAL');

-- CreateTable
CREATE TABLE "LearningArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "LearningArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyScore" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "learningAreaId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetencyScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "InterventionCategory" NOT NULL DEFAULT 'ACADEMIC',
    "schoolId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentIntervention" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "outcome" "InterventionOutcome",
    "outcomeScore" DOUBLE PRECISION,
    "notes" TEXT,
    "schoolId" TEXT NOT NULL,

    CONSTRAINT "StudentIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehavioralRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "category" "BehaviorCategory" NOT NULL DEFAULT 'GENERAL',
    "severity" "BehaviorSeverity" NOT NULL DEFAULT 'MILD',
    "description" TEXT,
    "actionTaken" TEXT,
    "recordedById" TEXT,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BehavioralRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGrowthRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "gpa" DOUBLE PRECISION,
    "percentile" DOUBLE PRECISION,
    "classRank" INTEGER,
    "growthRate" DOUBLE PRECISION,
    "status" "GrowthStatus" NOT NULL DEFAULT 'STABLE',
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGrowthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningArea_subjectId_idx" ON "LearningArea"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningArea_name_subjectId_schoolId_key" ON "LearningArea"("name", "subjectId", "schoolId");

-- CreateIndex
CREATE INDEX "CompetencyScore_studentId_idx" ON "CompetencyScore"("studentId");

-- CreateIndex
CREATE INDEX "CompetencyScore_learningAreaId_idx" ON "CompetencyScore"("learningAreaId");

-- CreateIndex
CREATE INDEX "CompetencyScore_termId_idx" ON "CompetencyScore"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyScore_studentId_learningAreaId_termId_key" ON "CompetencyScore"("studentId", "learningAreaId", "termId");

-- CreateIndex
CREATE INDEX "Intervention_schoolId_idx" ON "Intervention"("schoolId");

-- CreateIndex
CREATE INDEX "Intervention_category_idx" ON "Intervention"("category");

-- CreateIndex
CREATE INDEX "StudentIntervention_studentId_idx" ON "StudentIntervention"("studentId");

-- CreateIndex
CREATE INDEX "StudentIntervention_interventionId_idx" ON "StudentIntervention"("interventionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentIntervention_studentId_interventionId_assignedAt_key" ON "StudentIntervention"("studentId", "interventionId", "assignedAt");

-- CreateIndex
CREATE INDEX "BehavioralRecord_studentId_idx" ON "BehavioralRecord"("studentId");

-- CreateIndex
CREATE INDEX "BehavioralRecord_recordDate_idx" ON "BehavioralRecord"("recordDate");

-- CreateIndex
CREATE INDEX "BehavioralRecord_schoolId_idx" ON "BehavioralRecord"("schoolId");

-- CreateIndex
CREATE INDEX "StudentGrowthRecord_studentId_idx" ON "StudentGrowthRecord"("studentId");

-- CreateIndex
CREATE INDEX "StudentGrowthRecord_termId_idx" ON "StudentGrowthRecord"("termId");

-- CreateIndex
CREATE INDEX "StudentGrowthRecord_status_idx" ON "StudentGrowthRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGrowthRecord_studentId_termId_key" ON "StudentGrowthRecord"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "LearningArea" ADD CONSTRAINT "LearningArea_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningArea" ADD CONSTRAINT "LearningArea_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "LearningArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralRecord" ADD CONSTRAINT "BehavioralRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralRecord" ADD CONSTRAINT "BehavioralRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrowthRecord" ADD CONSTRAINT "StudentGrowthRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrowthRecord" ADD CONSTRAINT "StudentGrowthRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrowthRecord" ADD CONSTRAINT "StudentGrowthRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

