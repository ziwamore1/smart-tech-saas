CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "schoolMembershipId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPermissionOverride_schoolMembershipId_permission_key"
  ON "UserPermissionOverride"("schoolMembershipId", "permission");
CREATE INDEX "UserPermissionOverride_permission_idx"
  ON "UserPermissionOverride"("permission");

ALTER TABLE "UserPermissionOverride"
  ADD CONSTRAINT "UserPermissionOverride_schoolMembershipId_fkey"
  FOREIGN KEY ("schoolMembershipId") REFERENCES "SchoolUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride"
  ADD CONSTRAINT "UserPermissionOverride_assignedBy_fkey"
  FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
