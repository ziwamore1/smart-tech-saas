-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED', 'DECEASED');

-- CreateTable
CREATE TABLE "AdmissionSequence" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionSequence_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "studentUuid" TEXT NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "Student" ADD COLUMN "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN "streamId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSequence_schoolId_academicYearId_key" ON "AdmissionSequence"("schoolId", "academicYearId");
CREATE UNIQUE INDEX "AdmissionSequence_schoolId_year_key" ON "AdmissionSequence"("schoolId", "year");
CREATE INDEX "AdmissionSequence_schoolId_idx" ON "AdmissionSequence"("schoolId");
CREATE INDEX "AdmissionSequence_academicYearId_idx" ON "AdmissionSequence"("academicYearId");
CREATE UNIQUE INDEX "Student_studentUuid_key" ON "Student"("studentUuid");
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- AddForeignKey
ALTER TABLE "AdmissionSequence" ADD CONSTRAINT "AdmissionSequence_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "AdmissionSequence" ADD CONSTRAINT "AdmissionSequence_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
