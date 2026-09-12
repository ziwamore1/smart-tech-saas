CREATE TABLE "CalendarNotificationDelivery" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "calendarVersion" INTEGER NOT NULL,
  "reminderType" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarNotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CalendarNotificationDelivery_idempotencyKey_key" ON "CalendarNotificationDelivery"("idempotencyKey");
CREATE INDEX "CalendarNotificationDelivery_schoolId_createdAt_idx" ON "CalendarNotificationDelivery"("schoolId", "createdAt");
CREATE INDEX "CalendarNotificationDelivery_activityId_reminderType_idx" ON "CalendarNotificationDelivery"("activityId", "reminderType");
ALTER TABLE "CalendarNotificationDelivery" ADD CONSTRAINT "CalendarNotificationDelivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarNotificationDelivery" ADD CONSTRAINT "CalendarNotificationDelivery_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CalendarActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarNotificationDelivery" ADD CONSTRAINT "CalendarNotificationDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
