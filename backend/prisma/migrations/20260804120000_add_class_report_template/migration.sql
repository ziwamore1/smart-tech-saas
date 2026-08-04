ALTER TABLE "Class" ADD COLUMN "reportTemplateId" TEXT;

CREATE INDEX "Class_reportTemplateId_idx" ON "Class"("reportTemplateId");

ALTER TABLE "Class"
ADD CONSTRAINT "Class_reportTemplateId_fkey"
FOREIGN KEY ("reportTemplateId") REFERENCES "ReportTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
