-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "category" TEXT NOT NULL DEFAULT 'System Notifications',
    "userId" TEXT,
    "userIds" JSONB,
    "role" TEXT,
    "classId" TEXT,
    "schoolId" TEXT,
    "schoolIds" JSONB,
    "createdBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationJob_status_idx" ON "NotificationJob"("status");

-- CreateIndex
CREATE INDEX "NotificationJob_scheduledAt_idx" ON "NotificationJob"("scheduledAt");
