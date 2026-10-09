DO $$
DECLARE
  template_id TEXT := '00000000-0000-4000-8000-000000000060';
  category_id TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ReportTemplate" WHERE "id" = template_id) THEN
    SELECT "id" INTO category_id
    FROM "TemplateCategory"
    WHERE "slug" = 'certificates' AND "schoolId" IS NULL
    ORDER BY "createdAt"
    LIMIT 1;

    INSERT INTO "ReportTemplate" (
      "id", "name", "description", "documentType", "isDefault", "primaryColor", "secondaryColor",
      "templateType", "orientation", "categoryId", "status", "version", "metadata", "updatedAt"
    ) VALUES (
      template_id,
      'Certificate of Completion',
      'Portrait academic completion certificate listing every subject taken and completed at the school.',
      'CERTIFICATE', true, '#164e63', '#ecfeff', 'CERTIFICATE', 'portrait', category_id,
      'PUBLISHED', 1,
      '{"source":"system-seed","educationLevel":"secondary-school","completionSubjectList":true}'::jsonb,
      CURRENT_TIMESTAMP
    );

    INSERT INTO "CertificateTemplate" (
      "id", "templateId", "certificateType", "audience", "awardCategory", "eligibilityRules", "borderStyle", "borderColor",
      "showQrCode", "autoNumbering", "showPhoto", "signature1Label", "signature2Label", "awardText", "updatedAt"
    ) VALUES (
      '00000000-0000-4000-8000-000000000061', template_id, 'CUSTOM', 'STUDENT', 'COMPLETION',
      '{"code":"COMPLETION","audience":"STUDENT","minimumAverage":50,"minimumSubjectPercentage":40,"minimumAttendance":75,"requiresAllSubjectsPassed":true,"requiresPublishedResults":true,"requiresSecondaryFinalClass":true}'::jsonb,
      'academic', '#164e63', true, true, true, 'Principal', 'School Director',
      'This certifies the successful completion of secondary education by', CURRENT_TIMESTAMP
    );
  END IF;
END $$;
