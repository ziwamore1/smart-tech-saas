CREATE TABLE "AgeBand" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minAge" INTEGER NOT NULL,
    "maxAgeExclusive" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgeBand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgeBand_schoolId_label_key" ON "AgeBand"("schoolId", "label");
CREATE INDEX "AgeBand_schoolId_isActive_order_idx" ON "AgeBand"("schoolId", "isActive", "order");
ALTER TABLE "AgeBand" ADD CONSTRAINT "AgeBand_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
