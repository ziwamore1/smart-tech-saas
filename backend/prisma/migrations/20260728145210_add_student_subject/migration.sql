/*
  Warnings:

  - Made the column `status` on table `GeneratedReport` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "SchoolRoleAssignment_schoolId_idx";

-- AlterTable
ALTER TABLE "GeneratedReport" ALTER COLUMN "status" SET NOT NULL;
