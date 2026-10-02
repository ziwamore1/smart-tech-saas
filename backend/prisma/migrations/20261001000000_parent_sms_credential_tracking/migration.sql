ALTER TABLE "Parent"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "phoneStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "phoneStatusReason" TEXT,
  ADD COLUMN "phoneValidatedAt" TIMESTAMP(3),
  ADD COLUMN "phoneCorrectionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "phoneCorrectionRequestedById" TEXT,
  ADD COLUMN "credentialDeliveryStatus" TEXT,
  ADD COLUMN "credentialDeliveryError" TEXT,
  ADD COLUMN "credentialDeliveryUpdatedAt" TIMESTAMP(3);

UPDATE "Parent" AS parent
SET "userId" = app_user.id
FROM "User" AS app_user
WHERE LOWER(parent.email) = LOWER(app_user.email)
  AND parent."schoolId" = app_user."schoolId";

CREATE UNIQUE INDEX "Parent_userId_key" ON "Parent"("userId");
CREATE INDEX "Parent_phoneStatus_idx" ON "Parent"("phoneStatus");

ALTER TABLE "Parent"
  ADD CONSTRAINT "Parent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ParentCredentialDelivery" (
  "id" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "requestedById" TEXT,
  "recipientPhone" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'SMS',
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "messageId" TEXT,
  "childCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  CONSTRAINT "ParentCredentialDelivery_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ParentCredentialDelivery" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ParentCredentialDelivery_parentId_createdAt_idx" ON "ParentCredentialDelivery"("parentId", "createdAt");
CREATE INDEX "ParentCredentialDelivery_requestedById_idx" ON "ParentCredentialDelivery"("requestedById");
CREATE INDEX "ParentCredentialDelivery_status_idx" ON "ParentCredentialDelivery"("status");

ALTER TABLE "ParentCredentialDelivery"
  ADD CONSTRAINT "ParentCredentialDelivery_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ParentCredentialDelivery_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
