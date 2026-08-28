CREATE TABLE "ResultEntryPermission" (
    "id" TEXT NOT NULL,
    "schoolMembershipId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResultEntryPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResultEntryPermission_schoolMembershipId_classId_subjectId_academicYearId_key"
  ON "ResultEntryPermission"("schoolMembershipId", "classId", "subjectId", "academicYearId");
CREATE INDEX "ResultEntryPermission_classId_subjectId_academicYearId_idx"
  ON "ResultEntryPermission"("classId", "subjectId", "academicYearId");
ALTER TABLE "ResultEntryPermission" ADD CONSTRAINT "ResultEntryPermission_schoolMembershipId_fkey"
  FOREIGN KEY ("schoolMembershipId") REFERENCES "SchoolUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultEntryPermission" ADD CONSTRAINT "ResultEntryPermission_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultEntryPermission" ADD CONSTRAINT "ResultEntryPermission_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultEntryPermission" ADD CONSTRAINT "ResultEntryPermission_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultEntryPermission" ADD CONSTRAINT "ResultEntryPermission_assignedBy_fkey"
  FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
