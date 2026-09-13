-- CreateEnum
CREATE TYPE "PlanSchoolType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "PlanBillingInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "PlanPricing" (
    "id" TEXT NOT NULL,
    "schoolType" "PlanSchoolType" NOT NULL DEFAULT 'SECONDARY',
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'BASIC',
    "interval" "PlanBillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "priceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceZwK" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanPricing_schoolType_tier_idx" ON "PlanPricing"("schoolType", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPricing_schoolType_tier_interval_key" ON "PlanPricing"("schoolType", "tier", "interval");

