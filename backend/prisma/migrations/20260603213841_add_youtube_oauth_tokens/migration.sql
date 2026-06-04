-- CreateEnum
CREATE TYPE "InstitutionTypeCode" AS ENUM ('PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY');

-- AlterEnum
ALTER TYPE "EducationLevelCategory" ADD VALUE 'ADVANCED_SECONDARY';

-- AlterTable
ALTER TABLE "CommunicationSettings" ADD COLUMN     "youtubeAccessToken" TEXT,
ADD COLUMN     "youtubeRefreshToken" TEXT,
ADD COLUMN     "youtubeTokenExpiry" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DashboardConfig" ADD COLUMN     "enabledDashboards" JSONB DEFAULT '[]',
ADD COLUMN     "enabledModules" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "institutionTypeId" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "specialization" TEXT,
ADD COLUMN     "staffType" TEXT DEFAULT 'TEACHING',
ADD COLUMN     "yearsOfExperience" INTEGER;

-- CreateTable
CREATE TABLE "InstitutionRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionDashboard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "layout" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionModule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionFeature" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" "InstitutionTypeCode" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionTypeModule" (
    "id" TEXT NOT NULL,
    "institutionTypeId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InstitutionTypeModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionTypeFeature" (
    "id" TEXT NOT NULL,
    "institutionTypeId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InstitutionTypeFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionTypeRole" (
    "id" TEXT NOT NULL,
    "institutionTypeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "InstitutionTypeRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionTypeDashboard" (
    "id" TEXT NOT NULL,
    "institutionTypeId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "roleId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InstitutionTypeDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionSetting" (
    "id" TEXT NOT NULL,
    "institutionTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InstitutionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionRole_code_key" ON "InstitutionRole"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionDashboard_code_key" ON "InstitutionDashboard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionModule_code_key" ON "InstitutionModule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionFeature_code_key" ON "InstitutionFeature"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionType_code_key" ON "InstitutionType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionTypeModule_institutionTypeId_moduleId_key" ON "InstitutionTypeModule"("institutionTypeId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionTypeFeature_institutionTypeId_featureId_key" ON "InstitutionTypeFeature"("institutionTypeId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionTypeRole_institutionTypeId_roleId_key" ON "InstitutionTypeRole"("institutionTypeId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionTypeDashboard_institutionTypeId_dashboardId_key" ON "InstitutionTypeDashboard"("institutionTypeId", "dashboardId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionSetting_institutionTypeId_key_key" ON "InstitutionSetting"("institutionTypeId", "key");

-- CreateIndex
CREATE INDEX "School_institutionTypeId_idx" ON "School"("institutionTypeId");

-- CreateIndex
CREATE INDEX "Teacher_staffType_idx" ON "Teacher"("staffType");

-- AddForeignKey
ALTER TABLE "InstitutionTypeModule" ADD CONSTRAINT "InstitutionTypeModule_institutionTypeId_fkey" FOREIGN KEY ("institutionTypeId") REFERENCES "InstitutionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeModule" ADD CONSTRAINT "InstitutionTypeModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "InstitutionModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeFeature" ADD CONSTRAINT "InstitutionTypeFeature_institutionTypeId_fkey" FOREIGN KEY ("institutionTypeId") REFERENCES "InstitutionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeFeature" ADD CONSTRAINT "InstitutionTypeFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "InstitutionFeature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeRole" ADD CONSTRAINT "InstitutionTypeRole_institutionTypeId_fkey" FOREIGN KEY ("institutionTypeId") REFERENCES "InstitutionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeRole" ADD CONSTRAINT "InstitutionTypeRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "InstitutionRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeDashboard" ADD CONSTRAINT "InstitutionTypeDashboard_institutionTypeId_fkey" FOREIGN KEY ("institutionTypeId") REFERENCES "InstitutionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeDashboard" ADD CONSTRAINT "InstitutionTypeDashboard_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "InstitutionDashboard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionTypeDashboard" ADD CONSTRAINT "InstitutionTypeDashboard_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "InstitutionRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionSetting" ADD CONSTRAINT "InstitutionSetting_institutionTypeId_fkey" FOREIGN KEY ("institutionTypeId") REFERENCES "InstitutionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_institutionTypeId_fkey" FOREIGN KEY ("institutionTypeId") REFERENCES "InstitutionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
