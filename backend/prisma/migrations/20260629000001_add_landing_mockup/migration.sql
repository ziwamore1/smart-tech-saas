-- CreateTable
CREATE TABLE "LandingMockup" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "category" TEXT NOT NULL DEFAULT 'dashboard',
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingMockup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingMockup_role_category_idx" ON "LandingMockup"("role", "category");

-- CreateIndex
CREATE INDEX "LandingMockup_isActive_order_idx" ON "LandingMockup"("isActive", "order");
