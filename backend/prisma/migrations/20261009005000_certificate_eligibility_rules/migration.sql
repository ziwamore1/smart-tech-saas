ALTER TABLE "CertificateTemplate"
ADD COLUMN "eligibilityRules" JSONB NOT NULL DEFAULT '{}';

UPDATE "CertificateTemplate" c
SET "eligibilityRules" = CASE
  WHEN lower(t."name") LIKE '%dean%list%' THEN '{"code":"DEANS_LIST","audience":"STUDENT","minimumAverage":80,"minimumSubjectPercentage":70,"minimumAttendance":90,"requiresPublishedResults":true}'::jsonb
  WHEN lower(t."name") LIKE '%honor%roll%' THEN '{"code":"HONOR_ROLL","audience":"STUDENT","minimumAverage":75,"minimumSubjectPercentage":60,"minimumAttendance":85,"requiresPublishedResults":true}'::jsonb
  WHEN lower(t."name") LIKE '%principal%award%' OR lower(t."name") LIKE '%principle%award%' THEN '{"code":"PRINCIPALS_AWARD","audience":"STUDENT","minimumAverage":85,"requiredClassRank":1,"minimumAttendance":90,"minimumSubjectPercentage":50,"requiresPublishedResults":true}'::jsonb
  WHEN lower(t."name") LIKE '%graduation%' THEN '{"code":"GRADUATION","audience":"STUDENT","minimumAverage":50,"minimumSubjectPercentage":40,"minimumAttendance":75,"requiresAllSubjectsPassed":true,"requiresPublishedResults":true}'::jsonb
  WHEN lower(t."name") LIKE '%staff%recognition%' THEN '{"code":"TEACHER_SERVICE","audience":"TEACHER","minimumServiceYears":1}'::jsonb
  WHEN lower(t."name") LIKE '%teacher%recognition%' THEN '{"code":"TEACHER_PERFORMANCE","audience":"TEACHER","minimumStudentAverage":60,"minimumPassRate":70}'::jsonb
  ELSE "eligibilityRules"
END
FROM "ReportTemplate" t
WHERE c."templateId" = t."id";
