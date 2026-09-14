-- Upgrade CalendarActivityStatus to richer lifecycle
ALTER TYPE "CalendarActivityStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "CalendarActivityStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "CalendarActivityStatus" ADD VALUE 'PARTIALLY_COMPLETED';
ALTER TYPE "CalendarActivityStatus" ADD VALUE 'DELAYED';
ALTER TYPE "CalendarActivityStatus" ADD VALUE 'POSTPONED';
ALTER TYPE "CalendarActivityStatus" ADD VALUE 'NOT_COMPLETED';

-- Activity intelligence fields
ALTER TABLE "CalendarActivity" ADD COLUMN "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CalendarActivity" ADD COLUMN "target" DOUBLE PRECISION;
ALTER TABLE "CalendarActivity" ADD COLUMN "targetUnit" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "expectedOutcome" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "actualOutcome" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "actualCompletionDate" TIMESTAMP(3);
ALTER TABLE "CalendarActivity" ADD COLUMN "delayReason" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "remarks" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "responsibleRole" TEXT;

-- Term goals
CREATE TABLE "CalendarGoal" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "calendarId" TEXT NOT NULL,
  "termId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "targetPercentage" DOUBLE PRECISION NOT NULL DEFAULT 90,
  "category" TEXT NOT NULL DEFAULT 'OVERALL',
  "departmentId" TEXT,
  "responsibleId" TEXT,
  "deadline" TIMESTAMP(3),
  "status" "CalendarActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "currentProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarGoal_pkey" PRIMARY KEY ("id")
);

-- Activity lifecycle timeline
CREATE TABLE "CalendarActivityTimeline" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "previousPercentage" DOUBLE PRECISION,
  "newPercentage" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CalendarActivityTimeline_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarGoal_schoolId_calendarId_idx" ON "CalendarGoal"("schoolId", "calendarId");
CREATE INDEX "CalendarGoal_termId_idx" ON "CalendarGoal"("termId");
CREATE INDEX "CalendarActivityTimeline_activityId_createdAt_idx" ON "CalendarActivityTimeline"("activityId", "createdAt");
CREATE INDEX "CalendarActivityTimeline_schoolId_createdAt_idx" ON "CalendarActivityTimeline"("schoolId", "createdAt");
CREATE INDEX "CalendarActivity_startDate_status_index" ON "CalendarActivity"("schoolId", "startDate", "status");

ALTER TABLE "CalendarGoal" ADD CONSTRAINT "CalendarGoal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarGoal" ADD CONSTRAINT "CalendarGoal_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "SchoolBusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarGoal" ADD CONSTRAINT "CalendarGoal_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarGoal" ADD CONSTRAINT "CalendarGoal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarGoal" ADD CONSTRAINT "CalendarGoal_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivityTimeline" ADD CONSTRAINT "CalendarActivityTimeline_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CalendarActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivityTimeline" ADD CONSTRAINT "CalendarActivityTimeline_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivityTimeline" ADD CONSTRAINT "CalendarActivityTimeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;