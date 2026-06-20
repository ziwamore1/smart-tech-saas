-- Add new values to existing QuestionType enum
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'PROJECT';
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'CONTEXTUAL';

-- Create new enums for CIE
CREATE TYPE "BloomLevel" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE');
CREATE TYPE "SbaStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'MARKED', 'RETURNED');
CREATE TYPE "LessonPlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'ARCHIVED');

-- CreateTable Topic
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "subjectId" TEXT NOT NULL,
    "academicStageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable Subtopic
CREATE TABLE "Subtopic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "topicId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subtopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable Competency
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "category" TEXT,
    "bloomLevel" "BloomLevel",
    "topicId" TEXT,
    "subtopicId" TEXT,
    "subjectId" TEXT,
    "eocId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable ElementOfConstruct
CREATE TABLE "ElementOfConstruct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "subjectId" TEXT NOT NULL,
    "construct" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ElementOfConstruct_pkey" PRIMARY KEY ("id")
);

-- CreateTable LearningOutcome
CREATE TABLE "LearningOutcome" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "bloomLevel" "BloomLevel",
    "topicId" TEXT,
    "subtopicId" TEXT,
    "subjectId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable AssessmentObjective
CREATE TABLE "AssessmentObjective" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "weight" DOUBLE PRECISION,
    "subjectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable SyllabusDocument
CREATE TABLE "SyllabusDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "curriculum" TEXT NOT NULL DEFAULT 'ECZ',
    "educationLevelId" TEXT,
    "academicStageId" TEXT,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyllabusDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable SyllabusDocumentSubject
CREATE TABLE "SyllabusDocumentSubject" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectCode" TEXT,
    "construct" TEXT,
    "sbaWeight" DOUBLE PRECISION,
    "examWeight" DOUBLE PRECISION,
    "sbaTasks" INTEGER,
    "examItems" INTEGER,
    "metadata" JSONB,
    "schoolId" TEXT,
    CONSTRAINT "SyllabusDocumentSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable SbaTask
CREATE TABLE "SbaTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskNumber" INTEGER NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicStageId" TEXT,
    "termId" TEXT,
    "maxMarks" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "competencyId" TEXT,
    "eocId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SbaTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable CurriculumLessonPlan
CREATE TABLE "CurriculumLessonPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "subtopicId" TEXT,
    "classId" TEXT,
    "teacherId" TEXT,
    "duration" INTEGER,
    "weekNumber" INTEGER,
    "termId" TEXT,
    "academicYearId" TEXT,
    "status" "LessonPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "objectives" TEXT,
    "materials" TEXT,
    "assessmentMethods" TEXT,
    "isGenerated" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CurriculumLessonPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable CurriculumLessonPlanActivity
CREATE TABLE "CurriculumLessonPlanActivity" (
    "id" TEXT NOT NULL,
    "lessonPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER,
    "activityType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CurriculumLessonPlanActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable CurriculumCoverage
CREATE TABLE "CurriculumCoverage" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subtopicId" TEXT DEFAULT '',
    "teacherId" TEXT,
    "termId" TEXT DEFAULT '',
    "isCovered" BOOLEAN NOT NULL DEFAULT false,
    "coverageDate" TIMESTAMP(3),
    "percentage" DOUBLE PRECISION,
    "notes" TEXT,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CurriculumCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for Topic
CREATE UNIQUE INDEX "Topic_name_subjectId_academicStageId_key" ON "Topic"("name", "subjectId", "academicStageId");
CREATE INDEX "Topic_subjectId_idx" ON "Topic"("subjectId");
CREATE INDEX "Topic_academicStageId_idx" ON "Topic"("academicStageId");

-- CreateIndex for Subtopic
CREATE UNIQUE INDEX "Subtopic_name_topicId_key" ON "Subtopic"("name", "topicId");
CREATE INDEX "Subtopic_topicId_idx" ON "Subtopic"("topicId");

-- CreateIndex for Competency
CREATE INDEX "Competency_topicId_idx" ON "Competency"("topicId");
CREATE INDEX "Competency_subtopicId_idx" ON "Competency"("subtopicId");
CREATE INDEX "Competency_subjectId_idx" ON "Competency"("subjectId");
CREATE INDEX "Competency_eocId_idx" ON "Competency"("eocId");

-- CreateIndex for ElementOfConstruct
CREATE INDEX "ElementOfConstruct_subjectId_idx" ON "ElementOfConstruct"("subjectId");

-- CreateIndex for LearningOutcome
CREATE INDEX "LearningOutcome_topicId_idx" ON "LearningOutcome"("topicId");
CREATE INDEX "LearningOutcome_subtopicId_idx" ON "LearningOutcome"("subtopicId");
CREATE INDEX "LearningOutcome_subjectId_idx" ON "LearningOutcome"("subjectId");

-- CreateIndex for AssessmentObjective
CREATE INDEX "AssessmentObjective_subjectId_idx" ON "AssessmentObjective"("subjectId");

-- CreateIndex for SyllabusDocument
CREATE INDEX "SyllabusDocument_documentType_idx" ON "SyllabusDocument"("documentType");
CREATE INDEX "SyllabusDocument_curriculum_idx" ON "SyllabusDocument"("curriculum");

-- CreateIndex for SyllabusDocumentSubject
CREATE INDEX "SyllabusDocumentSubject_documentId_idx" ON "SyllabusDocumentSubject"("documentId");
CREATE INDEX "SyllabusDocumentSubject_subjectId_idx" ON "SyllabusDocumentSubject"("subjectId");

-- CreateIndex for SbaTask
CREATE INDEX "SbaTask_subjectId_idx" ON "SbaTask"("subjectId");
CREATE INDEX "SbaTask_academicStageId_idx" ON "SbaTask"("academicStageId");
CREATE INDEX "SbaTask_termId_idx" ON "SbaTask"("termId");

-- CreateIndex for CurriculumLessonPlan
CREATE INDEX "CurriculumLessonPlan_subjectId_idx" ON "CurriculumLessonPlan"("subjectId");
CREATE INDEX "CurriculumLessonPlan_topicId_idx" ON "CurriculumLessonPlan"("topicId");
CREATE INDEX "CurriculumLessonPlan_classId_idx" ON "CurriculumLessonPlan"("classId");
CREATE INDEX "CurriculumLessonPlan_teacherId_idx" ON "CurriculumLessonPlan"("teacherId");
CREATE INDEX "CurriculumLessonPlan_termId_idx" ON "CurriculumLessonPlan"("termId");

-- CreateIndex for CurriculumLessonPlanActivity
CREATE INDEX "CurriculumLessonPlanActivity_lessonPlanId_idx" ON "CurriculumLessonPlanActivity"("lessonPlanId");

-- CreateIndex for CurriculumCoverage
CREATE UNIQUE INDEX "CurriculumCoverage_classId_subjectId_topicId_subtopicId_termId_key" ON "CurriculumCoverage"("classId", "subjectId", "topicId", "subtopicId", "termId");
CREATE INDEX "CurriculumCoverage_classId_idx" ON "CurriculumCoverage"("classId");
CREATE INDEX "CurriculumCoverage_subjectId_idx" ON "CurriculumCoverage"("subjectId");
CREATE INDEX "CurriculumCoverage_topicId_idx" ON "CurriculumCoverage"("topicId");
CREATE INDEX "CurriculumCoverage_teacherId_idx" ON "CurriculumCoverage"("teacherId");
CREATE INDEX "CurriculumCoverage_termId_idx" ON "CurriculumCoverage"("termId");

-- Add Foreign Key Constraints for Topic
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_academicStageId_fkey" FOREIGN KEY ("academicStageId") REFERENCES "AcademicStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for Subtopic
ALTER TABLE "Subtopic" ADD CONSTRAINT "Subtopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subtopic" ADD CONSTRAINT "Subtopic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for Competency
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_eocId_fkey" FOREIGN KEY ("eocId") REFERENCES "ElementOfConstruct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for ElementOfConstruct
ALTER TABLE "ElementOfConstruct" ADD CONSTRAINT "ElementOfConstruct_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ElementOfConstruct" ADD CONSTRAINT "ElementOfConstruct_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for LearningOutcome
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningOutcome" ADD CONSTRAINT "LearningOutcome_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for AssessmentObjective
ALTER TABLE "AssessmentObjective" ADD CONSTRAINT "AssessmentObjective_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentObjective" ADD CONSTRAINT "AssessmentObjective_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for SyllabusDocument
ALTER TABLE "SyllabusDocument" ADD CONSTRAINT "SyllabusDocument_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyllabusDocument" ADD CONSTRAINT "SyllabusDocument_academicStageId_fkey" FOREIGN KEY ("academicStageId") REFERENCES "AcademicStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SyllabusDocument" ADD CONSTRAINT "SyllabusDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for SyllabusDocumentSubject
ALTER TABLE "SyllabusDocumentSubject" ADD CONSTRAINT "SyllabusDocumentSubject_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SyllabusDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SyllabusDocumentSubject" ADD CONSTRAINT "SyllabusDocumentSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SyllabusDocumentSubject" ADD CONSTRAINT "SyllabusDocumentSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for SbaTask
ALTER TABLE "SbaTask" ADD CONSTRAINT "SbaTask_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SbaTask" ADD CONSTRAINT "SbaTask_academicStageId_fkey" FOREIGN KEY ("academicStageId") REFERENCES "AcademicStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SbaTask" ADD CONSTRAINT "SbaTask_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SbaTask" ADD CONSTRAINT "SbaTask_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SbaTask" ADD CONSTRAINT "SbaTask_eocId_fkey" FOREIGN KEY ("eocId") REFERENCES "ElementOfConstruct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SbaTask" ADD CONSTRAINT "SbaTask_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for CurriculumLessonPlan
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlan" ADD CONSTRAINT "CurriculumLessonPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for CurriculumLessonPlanActivity
ALTER TABLE "CurriculumLessonPlanActivity" ADD CONSTRAINT "CurriculumLessonPlanActivity_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "CurriculumLessonPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurriculumLessonPlanActivity" ADD CONSTRAINT "CurriculumLessonPlanActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Foreign Key Constraints for CurriculumCoverage
ALTER TABLE "CurriculumCoverage" ADD CONSTRAINT "CurriculumCoverage_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumCoverage" ADD CONSTRAINT "CurriculumCoverage_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumCoverage" ADD CONSTRAINT "CurriculumCoverage_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumCoverage" ADD CONSTRAINT "CurriculumCoverage_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumCoverage" ADD CONSTRAINT "CurriculumCoverage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
