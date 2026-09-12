ALTER TABLE "SchoolBusinessCalendar" ADD COLUMN "classId" TEXT;
ALTER TABLE "SchoolBusinessCalendar" ADD COLUMN "teacherId" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "academicYearId" TEXT;
ALTER TABLE "CalendarActivity" ADD COLUMN "teacherId" TEXT;
ALTER TABLE "SchoolBusinessCalendar" ADD CONSTRAINT "SchoolBusinessCalendar_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchoolBusinessCalendar" ADD CONSTRAINT "SchoolBusinessCalendar_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarActivity" ADD CONSTRAINT "CalendarActivity_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;