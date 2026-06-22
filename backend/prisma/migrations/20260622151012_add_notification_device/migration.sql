/*
  Warnings:

  - A unique constraint covering the columns `[name,subjectId]` on the table `AssessmentObjective` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,topicId,subjectId]` on the table `Competency` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,subjectId]` on the table `ElementOfConstruct` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,topicId,subjectId]` on the table `LearningOutcome` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[taskNumber,subjectId,academicStageId,termId]` on the table `SbaTask` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[documentId,subjectId]` on the table `SyllabusDocumentSubject` will be added. If there are existing duplicate values, this will fail.
  - Made the column `subtopicId` on table `CurriculumCoverage` required. This step will fail if there are existing NULL values in that column.
  - Made the column `termId` on table `CurriculumCoverage` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "SyllabusDocumentSubject" DROP CONSTRAINT "SyllabusDocumentSubject_documentId_fkey";

-- AlterTable
ALTER TABLE "CurriculumCoverage" ALTER COLUMN "subtopicId" SET NOT NULL,
ALTER COLUMN "termId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'System Notifications',
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failedError" TEXT,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'sent';

-- CreateTable
CREATE TABLE "NotificationDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "deviceToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationDevice_userId_idx" ON "NotificationDevice"("userId");

-- CreateIndex
CREATE INDEX "NotificationDevice_deviceToken_idx" ON "NotificationDevice"("deviceToken");

-- CreateIndex
CREATE INDEX "NotificationDevice_active_idx" ON "NotificationDevice"("active");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDevice_userId_deviceToken_key" ON "NotificationDevice"("userId", "deviceToken");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentObjective_name_subjectId_key" ON "AssessmentObjective"("name", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_name_topicId_subjectId_key" ON "Competency"("name", "topicId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementOfConstruct_name_subjectId_key" ON "ElementOfConstruct"("name", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningOutcome_name_topicId_subjectId_key" ON "LearningOutcome"("name", "topicId", "subjectId");

-- CreateIndex
CREATE INDEX "Notification_category_idx" ON "Notification"("category");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SbaTask_taskNumber_subjectId_academicStageId_termId_key" ON "SbaTask"("taskNumber", "subjectId", "academicStageId", "termId");

-- CreateIndex
CREATE INDEX "SyllabusDocument_educationLevelId_idx" ON "SyllabusDocument"("educationLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusDocumentSubject_documentId_subjectId_key" ON "SyllabusDocumentSubject"("documentId", "subjectId");

-- AddForeignKey
ALTER TABLE "NotificationDevice" ADD CONSTRAINT "NotificationDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusDocumentSubject" ADD CONSTRAINT "SyllabusDocumentSubject_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SyllabusDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CurriculumCoverage_classId_subjectId_topicId_subtopicId_termId_" RENAME TO "CurriculumCoverage_classId_subjectId_topicId_subtopicId_ter_key";
