CREATE TABLE "SchoolActivityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolActivityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SchoolActivityEvent_schoolId_timestamp_idx" ON "SchoolActivityEvent"("schoolId", "timestamp");
CREATE INDEX "SchoolActivityEvent_schoolId_category_timestamp_idx" ON "SchoolActivityEvent"("schoolId", "category", "timestamp");
