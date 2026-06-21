-- CreateTable CompositeSubject
CREATE TABLE IF NOT EXISTS "CompositeSubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "calculationMethod" TEXT NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompositeSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable CompositeSubjectComponent
CREATE TABLE IF NOT EXISTS "CompositeSubjectComponent" (
    "id" TEXT NOT NULL,
    "compositeSubjectId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompositeSubjectComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompositeSubject_code_curriculumId_key" ON "CompositeSubject"("code", "curriculumId");
CREATE INDEX IF NOT EXISTS "CompositeSubject_curriculumId_idx" ON "CompositeSubject"("curriculumId");
CREATE INDEX IF NOT EXISTS "CompositeSubject_schoolId_idx" ON "CompositeSubject"("schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompositeSubjectComponent_compositeSubjectId_subjectId_key" ON "CompositeSubjectComponent"("compositeSubjectId", "subjectId");
CREATE INDEX IF NOT EXISTS "CompositeSubjectComponent_compositeSubjectId_idx" ON "CompositeSubjectComponent"("compositeSubjectId");
CREATE INDEX IF NOT EXISTS "CompositeSubjectComponent_subjectId_idx" ON "CompositeSubjectComponent"("subjectId");

-- AddForeignKey
ALTER TABLE "CompositeSubject" ADD CONSTRAINT "CompositeSubject_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "CurriculumVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompositeSubject" ADD CONSTRAINT "CompositeSubject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompositeSubjectComponent" ADD CONSTRAINT "CompositeSubjectComponent_compositeSubjectId_fkey" FOREIGN KEY ("compositeSubjectId") REFERENCES "CompositeSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompositeSubjectComponent" ADD CONSTRAINT "CompositeSubjectComponent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
