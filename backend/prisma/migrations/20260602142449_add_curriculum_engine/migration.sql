-- CreateEnum
CREATE TYPE "EducationLevelCategory" AS ENUM ('ECE', 'PRIMARY', 'SECONDARY', 'VOCATIONAL', 'TERTIARY');

-- CreateEnum
CREATE TYPE "CurriculumStatus" AS ENUM ('DRAFT', 'CURRENT', 'ARCHIVED', 'FUTURE');

-- CreateEnum
CREATE TYPE "PathwayType" AS ENUM ('STEM', 'TRADE', 'GENERAL', 'VOCATIONAL', 'SPECIALIZED');

-- CreateEnum
CREATE TYPE "SubjectCategory" AS ENUM ('CORE', 'ELECTIVE', 'VOCATIONAL', 'STEM', 'TRADE', 'SPECIAL_PAPER');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "minEntryScore" DOUBLE PRECISION,
ADD COLUMN     "province" TEXT;

-- CreateTable
CREATE TABLE "EducationLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "EducationLevelCategory" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'DRAFT',
    "educationLevelId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "educationLevelId" TEXT NOT NULL,
    "curriculumVersionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "SubjectCategory" NOT NULL DEFAULT 'CORE',
    "curriculumVersionId" TEXT,
    "minSelection" INTEGER NOT NULL DEFAULT 0,
    "maxSelection" INTEGER,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectGroupSubject" (
    "id" TEXT NOT NULL,
    "subjectGroupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isCompulsory" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "schoolId" TEXT,

    CONSTRAINT "SubjectGroupSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectCombinationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "subjectGroupId" TEXT NOT NULL,
    "includedSubjects" TEXT[],
    "allowedAlternatives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectCombinationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectConversionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "actualMaxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "standardizedMax" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "conversionMultiplier" DOUBLE PRECISION,
    "conversionFormula" TEXT,
    "effectiveYear" INTEGER,
    "curriculumVersionId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectConversionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "description" TEXT,
    "label" TEXT,
    "color" TEXT,
    "curriculumVersionId" TEXT,
    "examStructureId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DivisionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelLocal" TEXT,
    "minScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "description" TEXT,
    "color" TEXT,
    "curriculumVersionId" TEXT,
    "schoolId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "academicStageId" TEXT NOT NULL,
    "curriculumVersionId" TEXT,
    "totalMarks" DOUBLE PRECISION,
    "passMark" DOUBLE PRECISION,
    "duration" INTEGER,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamComponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "examStructureId" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isGroupComponent" BOOLEAN NOT NULL DEFAULT false,
    "groupId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestSubjectSelectionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "count" INTEGER NOT NULL DEFAULT 4,
    "mustIncludeSubjectIds" TEXT[],
    "excludeSubjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "curriculumVersionId" TEXT,
    "examStructureId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BestSubjectSelectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "minSubjects" INTEGER NOT NULL DEFAULT 6,
    "maxFailingSubjects" INTEGER NOT NULL DEFAULT 0,
    "minPassScore" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "mustIncludeSubjectIds" TEXT[],
    "minTotalScore" DOUBLE PRECISION,
    "maxTotalScore" DOUBLE PRECISION,
    "curriculumVersionId" TEXT,
    "examStructureId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "fromStageId" TEXT,
    "toStageId" TEXT,
    "minAverageScore" DOUBLE PRECISION DEFAULT 40,
    "maxFailingSubjects" INTEGER DEFAULT 2,
    "mustPassSubjectIds" TEXT[],
    "curriculumVersionId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "pathwayType" "PathwayType" NOT NULL DEFAULT 'GENERAL',
    "entryStageId" TEXT,
    "exitStageId" TEXT,
    "minEntryScore" DOUBLE PRECISION,
    "recommendedSubjects" TEXT[],
    "compulsorySubjects" TEXT[],
    "curriculumVersionId" TEXT,
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathwayRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade7Result" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "englishConverted" DOUBLE PRECISION,
    "mathematicsConverted" DOUBLE PRECISION,
    "scienceConverted" DOUBLE PRECISION,
    "socialStudiesConverted" DOUBLE PRECISION,
    "zambianLanguageConverted" DOUBLE PRECISION,
    "expressiveArtsConverted" DOUBLE PRECISION,
    "homeEconomicsConverted" DOUBLE PRECISION,
    "technologyStudiesConverted" DOUBLE PRECISION,
    "ctsConverted" DOUBLE PRECISION,
    "sp1Converted" DOUBLE PRECISION,
    "sp2Converted" DOUBLE PRECISION,
    "bestFourTotal" DOUBLE PRECISION,
    "specialPapersTotal" DOUBLE PRECISION,
    "finalAggregate" DOUBLE PRECISION,
    "division" TEXT,
    "divisionScore" DOUBLE PRECISION,
    "performanceCategory" TEXT,
    "schoolRank" INTEGER,
    "districtRank" INTEGER,
    "provinceRank" INTEGER,
    "nationalRank" INTEGER,
    "selectedSchoolId" TEXT,
    "selectionScore" DOUBLE PRECISION,
    "selectionStatus" TEXT,
    "curriculumVersionId" TEXT,
    "examStructureId" TEXT,
    "metadata" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade7Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolEducationLevel" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "educationLevelId" TEXT NOT NULL,
    "curriculumVersionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolEducationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCurriculum" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "curriculumVersionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "phasedInAt" TIMESTAMP(3),
    "phasedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCurriculum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EducationLevel_code_schoolId_key" ON "EducationLevel"("code", "schoolId");

-- CreateIndex
CREATE INDEX "CurriculumVersion_educationLevelId_idx" ON "CurriculumVersion"("educationLevelId");

-- CreateIndex
CREATE INDEX "CurriculumVersion_isCurrent_idx" ON "CurriculumVersion"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumVersion_code_schoolId_key" ON "CurriculumVersion"("code", "schoolId");

-- CreateIndex
CREATE INDEX "AcademicStage_educationLevelId_idx" ON "AcademicStage"("educationLevelId");

-- CreateIndex
CREATE INDEX "AcademicStage_curriculumVersionId_idx" ON "AcademicStage"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicStage_code_curriculumVersionId_schoolId_key" ON "AcademicStage"("code", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "SubjectGroup_curriculumVersionId_idx" ON "SubjectGroup"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectGroup_code_curriculumVersionId_schoolId_key" ON "SubjectGroup"("code", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "SubjectGroupSubject_subjectGroupId_idx" ON "SubjectGroupSubject"("subjectGroupId");

-- CreateIndex
CREATE INDEX "SubjectGroupSubject_subjectId_idx" ON "SubjectGroupSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectGroupSubject_subjectGroupId_subjectId_key" ON "SubjectGroupSubject"("subjectGroupId", "subjectId");

-- CreateIndex
CREATE INDEX "SubjectCombinationRule_subjectGroupId_idx" ON "SubjectCombinationRule"("subjectGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectCombinationRule_code_subjectGroupId_schoolId_key" ON "SubjectCombinationRule"("code", "subjectGroupId", "schoolId");

-- CreateIndex
CREATE INDEX "SubjectConversionRule_subjectId_idx" ON "SubjectConversionRule"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectConversionRule_curriculumVersionId_idx" ON "SubjectConversionRule"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectConversionRule_subjectId_curriculumVersionId_schoolI_key" ON "SubjectConversionRule"("subjectId", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "DivisionRule_curriculumVersionId_idx" ON "DivisionRule"("curriculumVersionId");

-- CreateIndex
CREATE INDEX "DivisionRule_examStructureId_idx" ON "DivisionRule"("examStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "DivisionRule_code_curriculumVersionId_schoolId_key" ON "DivisionRule"("code", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "PerformanceCategory_curriculumVersionId_idx" ON "PerformanceCategory"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceCategory_name_curriculumVersionId_schoolId_key" ON "PerformanceCategory"("name", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "ExamStructure_academicStageId_idx" ON "ExamStructure"("academicStageId");

-- CreateIndex
CREATE INDEX "ExamStructure_curriculumVersionId_idx" ON "ExamStructure"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamStructure_code_academicStageId_schoolId_key" ON "ExamStructure"("code", "academicStageId", "schoolId");

-- CreateIndex
CREATE INDEX "ExamComponent_examStructureId_idx" ON "ExamComponent"("examStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamComponent_code_examStructureId_schoolId_key" ON "ExamComponent"("code", "examStructureId", "schoolId");

-- CreateIndex
CREATE INDEX "BestSubjectSelectionRule_curriculumVersionId_idx" ON "BestSubjectSelectionRule"("curriculumVersionId");

-- CreateIndex
CREATE INDEX "BestSubjectSelectionRule_examStructureId_idx" ON "BestSubjectSelectionRule"("examStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "BestSubjectSelectionRule_code_curriculumVersionId_schoolId_key" ON "BestSubjectSelectionRule"("code", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "CertificationRule_curriculumVersionId_idx" ON "CertificationRule"("curriculumVersionId");

-- CreateIndex
CREATE INDEX "CertificationRule_examStructureId_idx" ON "CertificationRule"("examStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificationRule_code_curriculumVersionId_schoolId_key" ON "CertificationRule"("code", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "PromotionRule_fromStageId_idx" ON "PromotionRule"("fromStageId");

-- CreateIndex
CREATE INDEX "PromotionRule_toStageId_idx" ON "PromotionRule"("toStageId");

-- CreateIndex
CREATE INDEX "PromotionRule_curriculumVersionId_idx" ON "PromotionRule"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRule_code_curriculumVersionId_schoolId_key" ON "PromotionRule"("code", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "PathwayRule_entryStageId_idx" ON "PathwayRule"("entryStageId");

-- CreateIndex
CREATE INDEX "PathwayRule_exitStageId_idx" ON "PathwayRule"("exitStageId");

-- CreateIndex
CREATE INDEX "PathwayRule_curriculumVersionId_idx" ON "PathwayRule"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PathwayRule_code_curriculumVersionId_schoolId_key" ON "PathwayRule"("code", "curriculumVersionId", "schoolId");

-- CreateIndex
CREATE INDEX "Grade7Result_studentId_idx" ON "Grade7Result"("studentId");

-- CreateIndex
CREATE INDEX "Grade7Result_termId_idx" ON "Grade7Result"("termId");

-- CreateIndex
CREATE INDEX "Grade7Result_schoolId_idx" ON "Grade7Result"("schoolId");

-- CreateIndex
CREATE INDEX "Grade7Result_division_idx" ON "Grade7Result"("division");

-- CreateIndex
CREATE INDEX "Grade7Result_finalAggregate_idx" ON "Grade7Result"("finalAggregate");

-- CreateIndex
CREATE INDEX "Grade7Result_schoolRank_idx" ON "Grade7Result"("schoolRank");

-- CreateIndex
CREATE INDEX "Grade7Result_districtRank_idx" ON "Grade7Result"("districtRank");

-- CreateIndex
CREATE INDEX "Grade7Result_provinceRank_idx" ON "Grade7Result"("provinceRank");

-- CreateIndex
CREATE INDEX "Grade7Result_nationalRank_idx" ON "Grade7Result"("nationalRank");

-- CreateIndex
CREATE INDEX "Grade7Result_curriculumVersionId_idx" ON "Grade7Result"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade7Result_studentId_termId_key" ON "Grade7Result"("studentId", "termId");

-- CreateIndex
CREATE INDEX "SchoolEducationLevel_schoolId_idx" ON "SchoolEducationLevel"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolEducationLevel_educationLevelId_idx" ON "SchoolEducationLevel"("educationLevelId");

-- CreateIndex
CREATE INDEX "SchoolEducationLevel_curriculumVersionId_idx" ON "SchoolEducationLevel"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolEducationLevel_schoolId_educationLevelId_key" ON "SchoolEducationLevel"("schoolId", "educationLevelId");

-- CreateIndex
CREATE INDEX "SchoolCurriculum_schoolId_idx" ON "SchoolCurriculum"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolCurriculum_curriculumVersionId_idx" ON "SchoolCurriculum"("curriculumVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCurriculum_schoolId_curriculumVersionId_key" ON "SchoolCurriculum"("schoolId", "curriculumVersionId");

-- AddForeignKey
ALTER TABLE "EducationLevel" ADD CONSTRAINT "EducationLevel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicStage" ADD CONSTRAINT "AcademicStage_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicStage" ADD CONSTRAINT "AcademicStage_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicStage" ADD CONSTRAINT "AcademicStage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectGroup" ADD CONSTRAINT "SubjectGroup_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectGroup" ADD CONSTRAINT "SubjectGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectGroupSubject" ADD CONSTRAINT "SubjectGroupSubject_subjectGroupId_fkey" FOREIGN KEY ("subjectGroupId") REFERENCES "SubjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectGroupSubject" ADD CONSTRAINT "SubjectGroupSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectGroupSubject" ADD CONSTRAINT "SubjectGroupSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectCombinationRule" ADD CONSTRAINT "SubjectCombinationRule_subjectGroupId_fkey" FOREIGN KEY ("subjectGroupId") REFERENCES "SubjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectCombinationRule" ADD CONSTRAINT "SubjectCombinationRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectConversionRule" ADD CONSTRAINT "SubjectConversionRule_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectConversionRule" ADD CONSTRAINT "SubjectConversionRule_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectConversionRule" ADD CONSTRAINT "SubjectConversionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionRule" ADD CONSTRAINT "DivisionRule_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionRule" ADD CONSTRAINT "DivisionRule_examStructureId_fkey" FOREIGN KEY ("examStructureId") REFERENCES "ExamStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionRule" ADD CONSTRAINT "DivisionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceCategory" ADD CONSTRAINT "PerformanceCategory_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceCategory" ADD CONSTRAINT "PerformanceCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStructure" ADD CONSTRAINT "ExamStructure_academicStageId_fkey" FOREIGN KEY ("academicStageId") REFERENCES "AcademicStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStructure" ADD CONSTRAINT "ExamStructure_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamStructure" ADD CONSTRAINT "ExamStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamComponent" ADD CONSTRAINT "ExamComponent_examStructureId_fkey" FOREIGN KEY ("examStructureId") REFERENCES "ExamStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamComponent" ADD CONSTRAINT "ExamComponent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestSubjectSelectionRule" ADD CONSTRAINT "BestSubjectSelectionRule_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestSubjectSelectionRule" ADD CONSTRAINT "BestSubjectSelectionRule_examStructureId_fkey" FOREIGN KEY ("examStructureId") REFERENCES "ExamStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestSubjectSelectionRule" ADD CONSTRAINT "BestSubjectSelectionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationRule" ADD CONSTRAINT "CertificationRule_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationRule" ADD CONSTRAINT "CertificationRule_examStructureId_fkey" FOREIGN KEY ("examStructureId") REFERENCES "ExamStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificationRule" ADD CONSTRAINT "CertificationRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "AcademicStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "AcademicStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayRule" ADD CONSTRAINT "PathwayRule_entryStageId_fkey" FOREIGN KEY ("entryStageId") REFERENCES "AcademicStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayRule" ADD CONSTRAINT "PathwayRule_exitStageId_fkey" FOREIGN KEY ("exitStageId") REFERENCES "AcademicStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayRule" ADD CONSTRAINT "PathwayRule_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayRule" ADD CONSTRAINT "PathwayRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade7Result" ADD CONSTRAINT "Grade7Result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade7Result" ADD CONSTRAINT "Grade7Result_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade7Result" ADD CONSTRAINT "Grade7Result_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade7Result" ADD CONSTRAINT "Grade7Result_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade7Result" ADD CONSTRAINT "Grade7Result_selectedSchoolId_fkey" FOREIGN KEY ("selectedSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade7Result" ADD CONSTRAINT "Grade7Result_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade7Result" ADD CONSTRAINT "Grade7Result_examStructureId_fkey" FOREIGN KEY ("examStructureId") REFERENCES "ExamStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEducationLevel" ADD CONSTRAINT "SchoolEducationLevel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEducationLevel" ADD CONSTRAINT "SchoolEducationLevel_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolEducationLevel" ADD CONSTRAINT "SchoolEducationLevel_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCurriculum" ADD CONSTRAINT "SchoolCurriculum_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCurriculum" ADD CONSTRAINT "SchoolCurriculum_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
