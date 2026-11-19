ALTER TABLE "Student"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Student_schoolId_deletedAt_idx" ON "Student"("schoolId", "deletedAt");
