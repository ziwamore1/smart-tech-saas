-- Preserve source handwriting separately from its processed transparent asset.
ALTER TABLE "DigitalSignature" ADD COLUMN "userId" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "originalImageUrl" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "processedImageUrl" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "transparentImageUrl" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "originalAssetId" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "processedAssetId" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "thumbnailAssetId" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "width" INTEGER;
ALTER TABLE "DigitalSignature" ADD COLUMN "height" INTEGER;
ALTER TABLE "DigitalSignature" ADD COLUMN "aspectRatio" DOUBLE PRECISION;
ALTER TABLE "DigitalSignature" ADD COLUMN "processingVersion" TEXT;
ALTER TABLE "DigitalSignature" ADD COLUMN "processingMetadata" JSONB;
ALTER TABLE "DigitalSignature" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX "DigitalSignature_schoolId_status_idx" ON "DigitalSignature"("schoolId", "status");
