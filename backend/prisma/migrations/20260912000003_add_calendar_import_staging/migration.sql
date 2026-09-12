CREATE TYPE "CalendarImportMode" AS ENUM ('UPDATE_EXISTING', 'FULL_SYNC');
CREATE TYPE "CalendarImportStatus" AS ENUM ('VALIDATING', 'VALID', 'INVALID', 'COMMITTED', 'FAILED');
CREATE TYPE "CalendarImportRowStatus" AS ENUM ('VALID', 'WARNING', 'ERROR', 'COMMITTED');
CREATE TYPE "CalendarImportChangeType" AS ENUM ('CREATE', 'UPDATE', 'UNCHANGED', 'CONFLICT', 'CANCEL');

ALTER TABLE "CalendarActivity" ADD COLUMN "activityCode" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "officerId" TEXT;
CREATE UNIQUE INDEX "CalendarActivity_calendarId_activityCode_key" ON "CalendarActivity"("calendarId", "activityCode");
CREATE INDEX "CalendarActivity_departmentId_idx" ON "CalendarActivity"("departmentId");
CREATE INDEX "CalendarActivity_officerId_idx" ON "CalendarActivity"("officerId");

CREATE TABLE "CalendarImport" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "calendarId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "filename" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "mode" "CalendarImportMode" NOT NULL DEFAULT 'UPDATE_EXISTING',
  "status" "CalendarImportStatus" NOT NULL DEFAULT 'VALIDATING',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "warningRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "unchangedCount" INTEGER NOT NULL DEFAULT 0,
  "conflictCount" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" JSONB,
  "committedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarImport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CalendarImportRow" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "status" "CalendarImportRowStatus" NOT NULL DEFAULT 'ERROR',
  "errors" JSONB,
  "changeType" "CalendarImportChangeType",
  "existingActivityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarImportRow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CalendarImportRow_importId_rowNumber_key" ON "CalendarImportRow"("importId", "rowNumber");
CREATE INDEX "CalendarImport_schoolId_calendarId_createdAt_idx" ON "CalendarImport"("schoolId", "calendarId", "createdAt");
CREATE INDEX "CalendarImport_uploadedById_idx" ON "CalendarImport"("uploadedById");
CREATE INDEX "CalendarImportRow_existingActivityId_idx" ON "CalendarImportRow"("existingActivityId");
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarImport" ADD CONSTRAINT "CalendarImport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarImport" ADD CONSTRAINT "CalendarImport_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "SchoolBusinessCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarImport" ADD CONSTRAINT "CalendarImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarImportRow" ADD CONSTRAINT "CalendarImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CalendarImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarImportRow" ADD CONSTRAINT "CalendarImportRow_existingActivityId_fkey" FOREIGN KEY ("existingActivityId") REFERENCES "CalendarActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
