-- AlterTable: Add missing schoolId column to SchoolRoleAssignment
ALTER TABLE "SchoolRoleAssignment" ADD COLUMN "schoolId" TEXT;

-- AddForeignKey
ALTER TABLE "SchoolRoleAssignment" ADD CONSTRAINT "SchoolRoleAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SchoolRoleAssignment_schoolId_idx" ON "SchoolRoleAssignment"("schoolId");
