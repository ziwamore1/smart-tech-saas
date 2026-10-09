-- Repair legacy system certificate recipient/category metadata and document type.
UPDATE "CertificateTemplate" c
SET
  "audience" = CASE WHEN lower(t."name") LIKE '%teacher%' OR lower(t."name") LIKE '%staff%' THEN 'TEACHER' ELSE 'STUDENT' END,
  "awardCategory" = CASE
    WHEN lower(t."name") LIKE '%teacher%' THEN 'TEACHER_PERFORMANCE'
    WHEN lower(t."name") LIKE '%staff%' THEN 'TEACHER_SERVICE'
    WHEN lower(t."name") LIKE '%attendance%' THEN 'ATTENDANCE'
    WHEN lower(t."name") LIKE '%sports%' THEN 'SPORTS'
    WHEN lower(t."name") LIKE '%leadership%' THEN 'LEADERSHIP'
    WHEN lower(t."name") LIKE '%graduation%' THEN 'GRADUATION'
    WHEN lower(t."name") LIKE '%service%' THEN 'COMMUNITY_SERVICE'
    ELSE 'OVERALL_AVERAGE'
  END
FROM "ReportTemplate" t
WHERE t."id" = c."templateId" AND t."schoolId" IS NULL AND t."templateType" = 'CERTIFICATE';

UPDATE "TemplateMarketplace" m
SET
  "documentType" = 'CERTIFICATE'::"DocumentType",
  "recipientType" = c."audience",
  "awardCategory" = c."awardCategory"
FROM "ReportTemplate" t
JOIN "CertificateTemplate" c ON c."templateId" = t."id"
WHERE m."templateId" = t."id" AND t."templateType" = 'CERTIFICATE';
