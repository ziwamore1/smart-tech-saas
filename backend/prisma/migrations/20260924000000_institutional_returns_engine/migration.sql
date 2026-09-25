ALTER TABLE "StaffReturnTemplate"
  ADD COLUMN "templateCode" TEXT,
  ADD COLUMN "version" TEXT NOT NULL DEFAULT '1',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "authority" TEXT,
  ADD COLUMN "fileType" TEXT NOT NULL DEFAULT 'xlsx';

ALTER TABLE "StaffReturnSubmission"
  ADD COLUMN "snapshot" JSONB,
  ADD COLUMN "templateVersion" TEXT NOT NULL DEFAULT '1';

ALTER TABLE "School"
  ADD COLUMN "constituency" TEXT,
  ADD COLUMN "ward" TEXT,
  ADD COLUMN "zone" TEXT,
  ADD COLUMN "locationType" TEXT,
  ADD COLUMN "runningAgency" TEXT,
  ADD COLUMN "schoolType" TEXT,
  ADD COLUMN "emisNumber" TEXT,
  ADD COLUMN "distanceFromDebOffice" DOUBLE PRECISION;
