-- DropForeignKey
ALTER TABLE "AdaptiveTestResponse" DROP CONSTRAINT "AdaptiveTestResponse_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "AdaptiveTestSession" DROP CONSTRAINT "AdaptiveTestSession_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "AdaptiveTestSession" DROP CONSTRAINT "AdaptiveTestSession_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AdaptiveTestSession" DROP CONSTRAINT "AdaptiveTestSession_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "AiContextMemory" DROP CONSTRAINT "AiContextMemory_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "AiContextMemory" DROP CONSTRAINT "AiContextMemory_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "AiContextMemory" DROP CONSTRAINT "AiContextMemory_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AiRecommendation" DROP CONSTRAINT "AiRecommendation_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "AiRecommendation" DROP CONSTRAINT "AiRecommendation_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "AiRecommendation" DROP CONSTRAINT "AiRecommendation_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AiTopicMastery" DROP CONSTRAINT "AiTopicMastery_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "AiTopicMastery" DROP CONSTRAINT "AiTopicMastery_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AiTutorFeedback" DROP CONSTRAINT "AiTutorFeedback_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "AiTutorMessage" DROP CONSTRAINT "AiTutorMessage_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "AiTutorSession" DROP CONSTRAINT "AiTutorSession_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "AiTutorSession" DROP CONSTRAINT "AiTutorSession_studentId_fkey";

-- DropForeignKey
ALTER TABLE "AiTutorSession" DROP CONSTRAINT "AiTutorSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "BehavioralRecord" DROP CONSTRAINT "BehavioralRecord_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "BehavioralRecord" DROP CONSTRAINT "BehavioralRecord_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CompetencyScore" DROP CONSTRAINT "CompetencyScore_learningAreaId_fkey";

-- DropForeignKey
ALTER TABLE "CompetencyScore" DROP CONSTRAINT "CompetencyScore_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "CompetencyScore" DROP CONSTRAINT "CompetencyScore_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CompetencyScore" DROP CONSTRAINT "CompetencyScore_termId_fkey";

-- DropForeignKey
ALTER TABLE "Intervention" DROP CONSTRAINT "Intervention_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "LearningArea" DROP CONSTRAINT "LearningArea_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "LearningArea" DROP CONSTRAINT "LearningArea_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "LearningStyleProfile" DROP CONSTRAINT "LearningStyleProfile_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "LearningStyleProfile" DROP CONSTRAINT "LearningStyleProfile_studentId_fkey";

-- DropForeignKey
ALTER TABLE "NationalBenchmark" DROP CONSTRAINT "NationalBenchmark_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionBankCategory" DROP CONSTRAINT "QuestionBankCategory_parentId_fkey";

-- DropForeignKey
ALTER TABLE "ReportTemplate" DROP CONSTRAINT "ReportTemplate_parentId_fkey";

-- DropForeignKey
ALTER TABLE "StudentGrowthRecord" DROP CONSTRAINT "StudentGrowthRecord_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "StudentGrowthRecord" DROP CONSTRAINT "StudentGrowthRecord_studentId_fkey";

-- DropForeignKey
ALTER TABLE "StudentGrowthRecord" DROP CONSTRAINT "StudentGrowthRecord_termId_fkey";

-- DropForeignKey
ALTER TABLE "StudentIntervention" DROP CONSTRAINT "StudentIntervention_interventionId_fkey";

-- DropForeignKey
ALTER TABLE "StudentIntervention" DROP CONSTRAINT "StudentIntervention_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "StudentIntervention" DROP CONSTRAINT "StudentIntervention_studentId_fkey";

-- DropForeignKey
ALTER TABLE "StudentPhoto" DROP CONSTRAINT "StudentPhoto_studentId_fkey";

-- DropForeignKey
ALTER TABLE "TemplateComponent" DROP CONSTRAINT "TemplateComponent_parentId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "role" TEXT;

-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "photoPublicId" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "bannerPublicId" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "logoPublicId" TEXT,
ADD COLUMN     "signaturePublicId" TEXT,
ADD COLUMN     "stampPublicId" TEXT;

-- AlterTable
ALTER TABLE "SchoolSetting" ADD COLUMN     "academicStructure" TEXT NOT NULL DEFAULT 'FORM_BASED',
ADD COLUMN     "gradingSystem" TEXT NOT NULL DEFAULT 'SECONDARY_ECZ',
ADD COLUMN     "minAttendancePercentage" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "termsPerYear" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "photoPublicId" TEXT;

-- AlterTable
ALTER TABLE "StudentPhoto" ADD COLUMN     "photoPublicId" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "photoPublicId" TEXT,
ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoPublicId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActingPosition" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "positionType" TEXT NOT NULL,
    "departmentId" TEXT,
    "classId" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActingPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffHrProfile" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "province" TEXT,
    "district" TEXT,
    "station" TEXT,
    "teacherName" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "maritalStatus" TEXT,
    "nrcNumber" TEXT,
    "tsNumber" TEXT,
    "aesNumber" TEXT,
    "substantivePosition" TEXT,
    "substantiveScale" TEXT,
    "actingPosition" TEXT,
    "administration" TEXT,
    "actingType" TEXT,
    "dateOfFirstAppointment" TIMESTAMP(3),
    "dateOfPresentAppointment" TIMESTAMP(3),
    "dateOfActingAppointment" TIMESTAMP(3),
    "confirmed" TEXT,
    "expectedConfirmationDate" TIMESTAMP(3),
    "allowancesEntitled" TEXT,
    "employmentStatus" TEXT DEFAULT 'ACTIVE',
    "employmentType" TEXT DEFAULT 'PERMANENT',
    "contractEffectiveDate" TIMESTAMP(3),
    "contractNormalised" TEXT,
    "contractEnd" TIMESTAMP(3),
    "retirementDate" TIMESTAMP(3),
    "payrollPoint" TEXT,
    "academicQualification" TEXT,
    "professionalQualification" TEXT,
    "yearOfQualification" INTEGER,
    "specialization" TEXT,
    "nationality" TEXT,
    "emailAddress" TEXT,
    "phoneNumber" TEXT,
    "currentPosition" TEXT,
    "gradeLevel" TEXT,
    "step" INTEGER,
    "taxId" TEXT,
    "pensionNumber" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "bankAccount" TEXT,
    "socialSecurityNumber" TEXT,
    "nextOfKin" TEXT,
    "nextOfKinContact" TEXT,
    "nextOfKinRelationship" TEXT,
    "dynamicFields" JSONB DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "syncHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffHrProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSyncLog" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "changes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEmploymentRecord" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolName" TEXT,
    "position" TEXT NOT NULL,
    "scale" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "recordType" TEXT NOT NULL DEFAULT 'EMPLOYMENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEmploymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffReturnTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schoolId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT DEFAULT 'DISTRICT',
    "config" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffReturnTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffReturnColumn" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "columnLabel" TEXT NOT NULL,
    "columnOrder" INTEGER NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'string',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "width" INTEGER DEFAULT 120,
    "alignment" TEXT DEFAULT 'left',
    "fontStyle" TEXT DEFAULT 'normal',
    "backgroundColor" TEXT,
    "defaultValue" TEXT,
    "options" JSONB DEFAULT '[]',
    "validationRules" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffReturnColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffReturnSubmission" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "academicYear" TEXT,
    "term" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "data" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "fileUrl" TEXT,
    "fileVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffReturnSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTransfer" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "fromSchoolId" TEXT NOT NULL,
    "toSchoolId" TEXT NOT NULL,
    "fromSchoolName" TEXT,
    "toSchoolName" TEXT,
    "fromDistrict" TEXT,
    "toDistrict" TEXT,
    "fromProvince" TEXT,
    "toProvince" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffQualification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "qualificationType" TEXT NOT NULL,
    "qualificationName" TEXT NOT NULL,
    "institution" TEXT,
    "yearObtained" INTEGER,
    "grade" TEXT,
    "documentUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPosition" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "positionType" TEXT NOT NULL DEFAULT 'SUBSTANTIVE',
    "scale" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "isActing" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAllowance" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "allowanceName" TEXT NOT NULL,
    "allowanceType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'ZMW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffContract" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAuditLog" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT,
    "profileId" TEXT,
    "schoolId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "performedBy" TEXT,
    "performedByName" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secureUrl" TEXT,
    "resourceType" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "folder" TEXT NOT NULL DEFAULT 'smarttech/system',
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsQueue" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'beem',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppQueue" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "templateName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_schoolId_idx" ON "Department"("schoolId");

-- CreateIndex
CREATE INDEX "Department_category_idx" ON "Department"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Department_schoolId_name_key" ON "Department"("schoolId", "name");

-- CreateIndex
CREATE INDEX "ActingPosition_teacherId_idx" ON "ActingPosition"("teacherId");

-- CreateIndex
CREATE INDEX "ActingPosition_schoolId_idx" ON "ActingPosition"("schoolId");

-- CreateIndex
CREATE INDEX "ActingPosition_positionType_idx" ON "ActingPosition"("positionType");

-- CreateIndex
CREATE INDEX "ActingPosition_departmentId_idx" ON "ActingPosition"("departmentId");

-- CreateIndex
CREATE INDEX "ActingPosition_classId_idx" ON "ActingPosition"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffHrProfile_staffId_key" ON "StaffHrProfile"("staffId");

-- CreateIndex
CREATE INDEX "StaffHrProfile_schoolId_idx" ON "StaffHrProfile"("schoolId");

-- CreateIndex
CREATE INDEX "StaffHrProfile_employmentStatus_idx" ON "StaffHrProfile"("employmentStatus");

-- CreateIndex
CREATE INDEX "StaffHrProfile_gradeLevel_idx" ON "StaffHrProfile"("gradeLevel");

-- CreateIndex
CREATE INDEX "StaffHrProfile_district_idx" ON "StaffHrProfile"("district");

-- CreateIndex
CREATE INDEX "StaffHrProfile_province_idx" ON "StaffHrProfile"("province");

-- CreateIndex
CREATE INDEX "StaffSyncLog_profileId_idx" ON "StaffSyncLog"("profileId");

-- CreateIndex
CREATE INDEX "StaffSyncLog_syncedAt_idx" ON "StaffSyncLog"("syncedAt");

-- CreateIndex
CREATE INDEX "StaffSyncLog_status_idx" ON "StaffSyncLog"("status");

-- CreateIndex
CREATE INDEX "StaffEmploymentRecord_profileId_idx" ON "StaffEmploymentRecord"("profileId");

-- CreateIndex
CREATE INDEX "StaffEmploymentRecord_schoolId_idx" ON "StaffEmploymentRecord"("schoolId");

-- CreateIndex
CREATE INDEX "StaffReturnTemplate_schoolId_idx" ON "StaffReturnTemplate"("schoolId");

-- CreateIndex
CREATE INDEX "StaffReturnTemplate_returnType_idx" ON "StaffReturnTemplate"("returnType");

-- CreateIndex
CREATE INDEX "StaffReturnColumn_templateId_idx" ON "StaffReturnColumn"("templateId");

-- CreateIndex
CREATE INDEX "StaffReturnColumn_columnOrder_idx" ON "StaffReturnColumn"("columnOrder");

-- CreateIndex
CREATE INDEX "StaffReturnSubmission_templateId_idx" ON "StaffReturnSubmission"("templateId");

-- CreateIndex
CREATE INDEX "StaffReturnSubmission_schoolId_idx" ON "StaffReturnSubmission"("schoolId");

-- CreateIndex
CREATE INDEX "StaffReturnSubmission_period_idx" ON "StaffReturnSubmission"("period");

-- CreateIndex
CREATE INDEX "StaffReturnSubmission_status_idx" ON "StaffReturnSubmission"("status");

-- CreateIndex
CREATE INDEX "StaffTransfer_profileId_idx" ON "StaffTransfer"("profileId");

-- CreateIndex
CREATE INDEX "StaffTransfer_fromSchoolId_idx" ON "StaffTransfer"("fromSchoolId");

-- CreateIndex
CREATE INDEX "StaffTransfer_toSchoolId_idx" ON "StaffTransfer"("toSchoolId");

-- CreateIndex
CREATE INDEX "StaffTransfer_status_idx" ON "StaffTransfer"("status");

-- CreateIndex
CREATE INDEX "StaffQualification_profileId_idx" ON "StaffQualification"("profileId");

-- CreateIndex
CREATE INDEX "StaffQualification_qualificationType_idx" ON "StaffQualification"("qualificationType");

-- CreateIndex
CREATE INDEX "StaffPosition_profileId_idx" ON "StaffPosition"("profileId");

-- CreateIndex
CREATE INDEX "StaffPosition_isCurrent_idx" ON "StaffPosition"("isCurrent");

-- CreateIndex
CREATE INDEX "StaffAllowance_profileId_idx" ON "StaffAllowance"("profileId");

-- CreateIndex
CREATE INDEX "StaffContract_profileId_idx" ON "StaffContract"("profileId");

-- CreateIndex
CREATE INDEX "StaffAuditLog_submissionId_idx" ON "StaffAuditLog"("submissionId");

-- CreateIndex
CREATE INDEX "StaffAuditLog_profileId_idx" ON "StaffAuditLog"("profileId");

-- CreateIndex
CREATE INDEX "StaffAuditLog_schoolId_idx" ON "StaffAuditLog"("schoolId");

-- CreateIndex
CREATE INDEX "StaffAuditLog_action_idx" ON "StaffAuditLog"("action");

-- CreateIndex
CREATE INDEX "StaffAuditLog_createdAt_idx" ON "StaffAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Media_publicId_key" ON "Media"("publicId");

-- CreateIndex
CREATE INDEX "Media_folder_idx" ON "Media"("folder");

-- CreateIndex
CREATE INDEX "Media_publicId_idx" ON "Media"("publicId");

-- CreateIndex
CREATE INDEX "Media_uploadedBy_idx" ON "Media"("uploadedBy");

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");

-- CreateIndex
CREATE INDEX "EmailQueue_status_idx" ON "EmailQueue"("status");

-- CreateIndex
CREATE INDEX "EmailQueue_scheduledAt_idx" ON "EmailQueue"("scheduledAt");

-- CreateIndex
CREATE INDEX "SmsQueue_status_idx" ON "SmsQueue"("status");

-- CreateIndex
CREATE INDEX "SmsQueue_scheduledAt_idx" ON "SmsQueue"("scheduledAt");

-- CreateIndex
CREATE INDEX "WhatsAppQueue_status_idx" ON "WhatsAppQueue"("status");

-- CreateIndex
CREATE INDEX "WhatsAppQueue_scheduledAt_idx" ON "WhatsAppQueue"("scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_role_idx" ON "Notification"("role");

-- CreateIndex
CREATE INDEX "Teacher_departmentId_idx" ON "Teacher"("departmentId");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActingPosition" ADD CONSTRAINT "ActingPosition_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActingPosition" ADD CONSTRAINT "ActingPosition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActingPosition" ADD CONSTRAINT "ActingPosition_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActingPosition" ADD CONSTRAINT "ActingPosition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPhoto" ADD CONSTRAINT "StudentPhoto_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ReportTemplate"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TemplateComponent" ADD CONSTRAINT "TemplateComponent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TemplateComponent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "QuestionBankCategory" ADD CONSTRAINT "QuestionBankCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "QuestionBankCategory"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LearningArea" ADD CONSTRAINT "LearningArea_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningArea" ADD CONSTRAINT "LearningArea_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_learningAreaId_fkey" FOREIGN KEY ("learningAreaId") REFERENCES "LearningArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyScore" ADD CONSTRAINT "CompetencyScore_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIntervention" ADD CONSTRAINT "StudentIntervention_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralRecord" ADD CONSTRAINT "BehavioralRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehavioralRecord" ADD CONSTRAINT "BehavioralRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrowthRecord" ADD CONSTRAINT "StudentGrowthRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrowthRecord" ADD CONSTRAINT "StudentGrowthRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGrowthRecord" ADD CONSTRAINT "StudentGrowthRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NationalBenchmark" ADD CONSTRAINT "NationalBenchmark_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTutorSession" ADD CONSTRAINT "AiTutorSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTutorSession" ADD CONSTRAINT "AiTutorSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTutorSession" ADD CONSTRAINT "AiTutorSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTutorMessage" ADD CONSTRAINT "AiTutorMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiTutorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTutorFeedback" ADD CONSTRAINT "AiTutorFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiTutorSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningStyleProfile" ADD CONSTRAINT "LearningStyleProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningStyleProfile" ADD CONSTRAINT "LearningStyleProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveTestSession" ADD CONSTRAINT "AdaptiveTestSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveTestSession" ADD CONSTRAINT "AdaptiveTestSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveTestSession" ADD CONSTRAINT "AdaptiveTestSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveTestResponse" ADD CONSTRAINT "AdaptiveTestResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdaptiveTestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiContextMemory" ADD CONSTRAINT "AiContextMemory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiContextMemory" ADD CONSTRAINT "AiContextMemory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiContextMemory" ADD CONSTRAINT "AiContextMemory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiTutorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AiTutorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTopicMastery" ADD CONSTRAINT "AiTopicMastery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTopicMastery" ADD CONSTRAINT "AiTopicMastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSyncLog" ADD CONSTRAINT "StaffSyncLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffHrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmploymentRecord" ADD CONSTRAINT "StaffEmploymentRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffHrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReturnColumn" ADD CONSTRAINT "StaffReturnColumn_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StaffReturnTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReturnSubmission" ADD CONSTRAINT "StaffReturnSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StaffReturnTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTransfer" ADD CONSTRAINT "StaffTransfer_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffHrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffQualification" ADD CONSTRAINT "StaffQualification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffHrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPosition" ADD CONSTRAINT "StaffPosition_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffHrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAllowance" ADD CONSTRAINT "StaffAllowance_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffHrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffContract" ADD CONSTRAINT "StaffContract_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StaffHrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "StaffReturnSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
