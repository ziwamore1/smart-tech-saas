CREATE TYPE "CalendarStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CalendarActivityStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CalendarActivityPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "CalendarRecurrenceRule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "CalendarAudienceType" AS ENUM ('SCHOOL', 'STAFF', 'STUDENTS', 'PARENTS', 'DEPARTMENT', 'USER');

CREATE TABLE "SchoolBusinessCalendar" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "termId" TEXT,
  "name" TEXT NOT NULL, "description" TEXT, "status" "CalendarStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT DEFAULT 'UTC', "publishedAt" TIMESTAMP(3), "archivedAt" TIMESTAMP(3),
  "createdById" TEXT, "updatedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SchoolBusinessCalendar_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarCategory" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "calendarId" TEXT, "name" TEXT NOT NULL,
  "color" TEXT, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarCategory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarActivity" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "calendarId" TEXT NOT NULL, "termId" TEXT,
  "categoryId" TEXT, "parentId" TEXT, "title" TEXT NOT NULL, "description" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL, "startTime" TEXT, "endTime" TEXT,
  "deadline" TIMESTAMP(3), "allDay" BOOLEAN NOT NULL DEFAULT true, "recurrenceRule" "CalendarRecurrenceRule" NOT NULL DEFAULT 'NONE',
  "recurrenceConfig" JSONB, "status" "CalendarActivityStatus" NOT NULL DEFAULT 'PLANNED',
  "priority" "CalendarActivityPriority" NOT NULL DEFAULT 'NORMAL', "reminderMinutes" JSONB,
  "attachments" JSONB, "notes" TEXT, "createdById" TEXT, "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarActivity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarActivityAudience" (
  "id" TEXT NOT NULL, "activityId" TEXT NOT NULL, "type" "CalendarAudienceType" NOT NULL,
  "userId" TEXT, "departmentId" TEXT, "label" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarActivityAudience_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarActivitySubItem" (
  "id" TEXT NOT NULL, "activityId" TEXT NOT NULL, "title" TEXT NOT NULL, "notes" TEXT,
  "dueDate" TIMESTAMP(3), "isComplete" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarActivitySubItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarColumnConfig" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "calendarId" TEXT NOT NULL, "key" TEXT NOT NULL,
  "label" TEXT NOT NULL, "dataType" TEXT NOT NULL DEFAULT 'text', "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "isRequired" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0, "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarColumnConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarAuditEvent" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "calendarId" TEXT, "userId" TEXT, "action" TEXT NOT NULL,
  "changes" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CalendarColumnConfig_calendarId_key_key" ON "CalendarColumnConfig"("calendarId", "key");
CREATE INDEX "SchoolBusinessCalendar_schoolId_status_idx" ON "SchoolBusinessCalendar"("schoolId", "status");
CREATE INDEX "SchoolBusinessCalendar_academicYearId_startDate_endDate_idx" ON "SchoolBusinessCalendar"("academicYearId", "startDate", "endDate");
CREATE INDEX "CalendarActivity_schoolId_calendarId_startDate_idx" ON "CalendarActivity"("schoolId", "calendarId", "startDate");
CREATE INDEX "CalendarActivity_parentId_idx" ON "CalendarActivity"("parentId");
CREATE INDEX "CalendarActivityAudience_activityId_idx" ON "CalendarActivityAudience"("activityId");
CREATE INDEX "CalendarActivityAudience_userId_departmentId_idx" ON "CalendarActivityAudience"("userId", "departmentId");
CREATE INDEX "CalendarActivitySubItem_activityId_sortOrder_idx" ON "CalendarActivitySubItem"("activityId", "sortOrder");
CREATE INDEX "CalendarCategory_schoolId_isActive_idx" ON "CalendarCategory"("schoolId", "isActive");
CREATE INDEX "CalendarColumnConfig_schoolId_calendarId_idx" ON "CalendarColumnConfig"("schoolId", "calendarId");
CREATE INDEX "CalendarAuditEvent_schoolId_createdAt_idx" ON "CalendarAuditEvent"("schoolId", "createdAt");
CREATE INDEX "CalendarAuditEvent_calendarId_createdAt_idx" ON "CalendarAuditEvent"("calendarId", "createdAt");
ALTER TABLE "SchoolBusinessCalendar" ADD CONSTRAINT "SchoolBusinessCalendar_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolBusinessCalendar" ADD CONSTRAINT "SchoolBusinessCalendar_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON UPDATE CASCADE;
ALTER TABLE "SchoolBusinessCalendar" ADD CONSTRAINT "SchoolBusinessCalendar_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON UPDATE CASCADE;
ALTER TABLE "CalendarCategory" ADD CONSTRAINT "CalendarCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarCategory" ADD CONSTRAINT "CalendarCategory_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "SchoolBusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "SchoolBusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CalendarCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CalendarActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivityAudience" ADD CONSTRAINT "CalendarActivityAudience_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CalendarActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivityAudience" ADD CONSTRAINT "CalendarActivityAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivityAudience" ADD CONSTRAINT "CalendarActivityAudience_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarActivitySubItem" ADD CONSTRAINT "CalendarActivitySubItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CalendarActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarColumnConfig" ADD CONSTRAINT "CalendarColumnConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarColumnConfig" ADD CONSTRAINT "CalendarColumnConfig_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "SchoolBusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAuditEvent" ADD CONSTRAINT "CalendarAuditEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAuditEvent" ADD CONSTRAINT "CalendarAuditEvent_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "SchoolBusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarAuditEvent" ADD CONSTRAINT "CalendarAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
