/*
  Warnings:

  - A unique constraint covering the columns `[schoolId,academicYearId,classId]` on the table `AdmissionSequence` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[admissionNumber,classId]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `classId` to the `AdmissionSequence` table without a default value. This is not possible if the table is not empty.
  - Added the required column `classId` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AdmissionSequence_schoolId_academicYearId_key";

-- DropIndex
DROP INDEX "AdmissionSequence_schoolId_year_key";

-- DropIndex
DROP INDEX "AssessmentDefinition_examType_idx";

-- DropIndex
DROP INDEX "Student_admissionNumber_schoolId_key";

-- AlterTable
ALTER TABLE "AdmissionSequence" ADD COLUMN     "classId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GeneratedReport" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "classId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSequence_schoolId_academicYearId_classId_key" ON "AdmissionSequence"("schoolId", "academicYearId", "classId");

-- CreateIndex
CREATE INDEX "Student_classId_idx" ON "Student"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_admissionNumber_classId_key" ON "Student"("admissionNumber", "classId");
