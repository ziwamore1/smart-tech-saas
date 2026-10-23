CREATE TABLE "SyllabusEntry" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "formNumber" INTEGER,
    "unitCode" TEXT,
    "subUnitCode" TEXT,
    "competencyCode" TEXT,
    "topic" TEXT NOT NULL,
    "subtopic" TEXT,
    "competency" TEXT,
    "learningActivities" JSONB,
    "expectedStandard" TEXT,
    "sourcePage" INTEGER,
    "rawText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyllabusEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SyllabusEntry_documentId_subjectId_formNumber_competencyCode_topic_subtopic_key"
ON "SyllabusEntry"("documentId", "subjectId", "formNumber", "competencyCode", "topic", "subtopic");
CREATE INDEX "SyllabusEntry_subjectId_formNumber_idx" ON "SyllabusEntry"("subjectId", "formNumber");
CREATE INDEX "SyllabusEntry_documentId_idx" ON "SyllabusEntry"("documentId");
ALTER TABLE "SyllabusEntry" ADD CONSTRAINT "SyllabusEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SyllabusDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyllabusEntry" ADD CONSTRAINT "SyllabusEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
