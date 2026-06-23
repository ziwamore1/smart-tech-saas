-- =============================================================================
-- Smart Tech SaaS — Seed Data Script (Production-safe)
-- Idempotent — safe to re-run multiple times on production
-- Usage: psql $DATABASE_URL -f backend/prisma/seed_production.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ROLES
-- =============================================================================
INSERT INTO "Role" ("id", "name") VALUES
  (gen_random_uuid(), 'Director'),
  (gen_random_uuid(), 'Deputy Director'),
  (gen_random_uuid(), 'Head Teacher'),
  (gen_random_uuid(), 'Deputy'),
  (gen_random_uuid(), 'Accountant'),
  (gen_random_uuid(), 'Secretary'),
  (gen_random_uuid(), 'Teacher'),
  (gen_random_uuid(), 'Class Teacher'),
  (gen_random_uuid(), 'HOD'),
  (gen_random_uuid(), 'Student'),
  (gen_random_uuid(), 'Parent'),
  (gen_random_uuid(), 'SuperAdmin')
ON CONFLICT ("name") DO NOTHING;

-- =============================================================================
-- 2. SUBSCRIPTION PLANS
-- =============================================================================
INSERT INTO "SubscriptionPlan" (
  "id", "name", "displayName", "description",
  "monthlyPrice", "yearlyPrice",
  "maxStudents", "maxTeachers", "maxClasses", "maxStorageGB",
  "features", "isActive", "isPopular",
  "updatedAt"
) VALUES
(
  gen_random_uuid(), 'BASIC', 'Basic',
  'Perfect for small schools getting started',
  990, 9900, 100, 10, 8, 5,
  '["Basic Timetable","Student Management","Teacher Management","Results Management","Email Support"]'::jsonb,
  true, false, NOW()
),
(
  gen_random_uuid(), 'STANDARD', 'Standard',
  'For growing schools with more needs',
  1990, 19900, 500, 50, 25, 15,
  '["Everything in Basic","Advanced Timetable AI","Parent Portal","Fee Management","Notice Board","Priority Support"]'::jsonb,
  true, true, NOW()
),
(
  gen_random_uuid(), 'PREMIUM', 'Premium',
  'Full-featured for large institutions',
  3990, 39900, -1, -1, -1, 100,
  '["Everything in Standard","Unlimited Users","Custom Branding","API Access","Dedicated Support","White-label Options"]'::jsonb,
  true, false, NOW()
)
ON CONFLICT ("name") DO UPDATE SET
  "displayName"   = EXCLUDED."displayName",
  "description"   = EXCLUDED."description",
  "monthlyPrice"  = EXCLUDED."monthlyPrice",
  "yearlyPrice"   = EXCLUDED."yearlyPrice",
  "maxStudents"   = EXCLUDED."maxStudents",
  "maxTeachers"   = EXCLUDED."maxTeachers",
  "maxClasses"    = EXCLUDED."maxClasses",
  "maxStorageGB"  = EXCLUDED."maxStorageGB",
  "features"      = EXCLUDED."features",
  "isActive"      = EXCLUDED."isActive",
  "isPopular"     = EXCLUDED."isPopular",
  "updatedAt"     = NOW();

-- =============================================================================
-- 3. INSTITUTION TYPES
-- =============================================================================
INSERT INTO "InstitutionType" ("id", "name", "code", "description") VALUES
  (gen_random_uuid(), 'Primary School',       'PRIMARY_SCHOOL'::"InstitutionTypeCode",     'Early childhood and primary education (Grade 1-7)'),
  (gen_random_uuid(), 'Secondary School',     'SECONDARY_SCHOOL'::"InstitutionTypeCode",   'Secondary education (Grade 8-12)'),
  (gen_random_uuid(), 'Advanced Secondary',   'ADVANCED_SECONDARY'::"InstitutionTypeCode", 'Advanced secondary education (Form 5-6)'),
  (gen_random_uuid(), 'College',              'COLLEGE'::"InstitutionTypeCode",            'College and tertiary education'),
  (gen_random_uuid(), 'University',           'UNIVERSITY'::"InstitutionTypeCode",         'University education (undergraduate and postgraduate)')
ON CONFLICT ("code") DO UPDATE SET
  "name"        = EXCLUDED."name",
  "description" = EXCLUDED."description";

-- =============================================================================
-- 4. EDUCATION LEVELS (global, used for stats and curriculum)
-- =============================================================================
INSERT INTO "EducationLevel" ("id", "name", "code", "description", "updatedAt")
SELECT gen_random_uuid(), 'Early Childhood Education', 'ECE'::"EducationLevelCategory", 'Early childhood education (Pre-school)', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EducationLevel" WHERE "code" = 'ECE'::"EducationLevelCategory" AND "schoolId" IS NULL);

INSERT INTO "EducationLevel" ("id", "name", "code", "description", "updatedAt")
SELECT gen_random_uuid(), 'Primary Education', 'PRIMARY'::"EducationLevelCategory", 'Primary education (Grade 1-7)', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EducationLevel" WHERE "code" = 'PRIMARY'::"EducationLevelCategory" AND "schoolId" IS NULL);

INSERT INTO "EducationLevel" ("id", "name", "code", "description", "updatedAt")
SELECT gen_random_uuid(), 'Secondary Education', 'SECONDARY'::"EducationLevelCategory", 'Secondary education (Grade 8-12)', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EducationLevel" WHERE "code" = 'SECONDARY'::"EducationLevelCategory" AND "schoolId" IS NULL);

INSERT INTO "EducationLevel" ("id", "name", "code", "description", "updatedAt")
SELECT gen_random_uuid(), 'Advanced Secondary', 'ADVANCED_SECONDARY'::"EducationLevelCategory", 'Advanced secondary education (Form 5-6)', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EducationLevel" WHERE "code" = 'ADVANCED_SECONDARY'::"EducationLevelCategory" AND "schoolId" IS NULL);

INSERT INTO "EducationLevel" ("id", "name", "code", "description", "updatedAt")
SELECT gen_random_uuid(), 'Vocational Education', 'VOCATIONAL'::"EducationLevelCategory", 'Vocational and technical education', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EducationLevel" WHERE "code" = 'VOCATIONAL'::"EducationLevelCategory" AND "schoolId" IS NULL);

INSERT INTO "EducationLevel" ("id", "name", "code", "description", "updatedAt")
SELECT gen_random_uuid(), 'Tertiary Education', 'TERTIARY'::"EducationLevelCategory", 'Tertiary and higher education', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "EducationLevel" WHERE "code" = 'TERTIARY'::"EducationLevelCategory" AND "schoolId" IS NULL);

-- =============================================================================
-- 5. INSTITUTION MODULES
-- =============================================================================
INSERT INTO "InstitutionModule" ("id", "code", "name", "category", "description") VALUES
  -- Core Modules
  (gen_random_uuid(), 'CORE_ATTENDANCE',       'Core Attendance',           'CORE',      'Basic attendance tracking'),
  (gen_random_uuid(), 'CORE_USER_MANAGEMENT',  'User Management',           'CORE',      'User account management'),
  (gen_random_uuid(), 'CORE_ROLE_MANAGEMENT',   'Role Management',           'CORE',      'Role-based access control'),
  (gen_random_uuid(), 'CORE_SUBSCRIPTION',      'Subscription Management',   'CORE',      'Subscription and billing'),
  (gen_random_uuid(), 'CORE_NOTIFICATIONS',     'Notifications',             'CORE',      'Push and email notifications'),
  (gen_random_uuid(), 'CORE_AUDIT',             'Audit Trail',               'CORE',      'Audit logging and security'),
  -- Academic Modules
  (gen_random_uuid(), 'ACADEMIC_CLASSES',       'Class Management',          'ACADEMIC',  'Class and grade management'),
  (gen_random_uuid(), 'ACADEMIC_SUBJECTS',      'Subject Management',        'ACADEMIC',  'Subject and curriculum management'),
  (gen_random_uuid(), 'ACADEMIC_TIMETABLE',     'Timetable',                 'ACADEMIC',  'Class timetable scheduling'),
  (gen_random_uuid(), 'ACADEMIC_ENROLLMENT',    'Enrollment',                'ACADEMIC',  'Student enrollment management'),
  (gen_random_uuid(), 'ACADEMIC_ACADEMIC_YEAR', 'Academic Year',             'ACADEMIC',  'Academic year and term management'),
  -- Primary-Specific Modules
  (gen_random_uuid(), 'PRIMARY_ATTENDANCE',             'Primary Attendance',             'PRIMARY',  'Primary school attendance tracking'),
  (gen_random_uuid(), 'PRIMARY_REPORT_CARDS',           'Primary Report Cards',           'PRIMARY',  'Primary school report card generation'),
  (gen_random_uuid(), 'PRIMARY_ECZ_ANALYTICS',          'Grade 7 ECZ Analytics',           'PRIMARY',  'Grade 7 ECZ examination analytics'),
  (gen_random_uuid(), 'PRIMARY_DASHBOARD_LOWER',        'Lower Primary Dashboard',         'PRIMARY',  'Lower primary (Grade 1-4) dashboards'),
  (gen_random_uuid(), 'PRIMARY_EXAMINATIONS',           'Primary Examinations',            'PRIMARY',  'Primary school examination system'),
  (gen_random_uuid(), 'PRIMARY_GRADING',                'Primary Grading System',          'PRIMARY',  'Primary school grading system'),
  (gen_random_uuid(), 'PRIMARY_SUBJECT_COMBINATIONS',   'Primary Subject Combinations',    'PRIMARY',  'Primary subject combination management'),
  (gen_random_uuid(), 'PRIMARY_TEACHER_DASHBOARD',      'Primary Teacher Dashboard',       'PRIMARY',  'Primary teacher analytics dashboard'),
  (gen_random_uuid(), 'PRIMARY_PARENT_DASHBOARD',       'Parent Dashboard',                'PRIMARY',  'Primary parent portal dashboard'),
  (gen_random_uuid(), 'PRIMARY_LEARNER_DASHBOARD',      'Learner Dashboard',               'PRIMARY',  'Primary learner dashboard'),
  -- Secondary-Specific Modules
  (gen_random_uuid(), 'SECONDARY_ATTENDANCE',            'Secondary Attendance',             'SECONDARY', 'Secondary school attendance tracking'),
  (gen_random_uuid(), 'SECONDARY_ANALYTICS',             'Secondary Analytics',              'SECONDARY', 'Secondary school analytics dashboard'),
  (gen_random_uuid(), 'SECONDARY_REPORT_CARDS',          'Secondary Report Cards',           'SECONDARY', 'Secondary school report card generation'),
  (gen_random_uuid(), 'SECONDARY_FORM_PROGRESSION',      'Form Progression',                 'SECONDARY', 'Form progression tracking system'),
  (gen_random_uuid(), 'SECONDARY_GRADE12_ANALYTICS',     'Grade 12 Analytics',               'SECONDARY', 'Grade 12 examination analytics'),
  (gen_random_uuid(), 'SECONDARY_EXAMINATIONS',          'Secondary Examinations',           'SECONDARY', 'Secondary school examination system'),
  (gen_random_uuid(), 'SECONDARY_SUBJECT_COMBINATIONS',  'Secondary Subject Combinations',   'SECONDARY', 'Secondary subject combination management'),
  (gen_random_uuid(), 'SECONDARY_CAREER_GUIDANCE',       'Career Guidance',                  'SECONDARY', 'Secondary career guidance and counseling'),
  (gen_random_uuid(), 'SECONDARY_TEACHER_DASHBOARD',     'Secondary Teacher Dashboard',      'SECONDARY', 'Secondary teacher analytics dashboard'),
  (gen_random_uuid(), 'SECONDARY_HOD_DASHBOARD',         'HOD Dashboard',                    'SECONDARY', 'Head of Department analytics dashboard'),
  (gen_random_uuid(), 'SECONDARY_PARENT_DASHBOARD',      'Secondary Parent Dashboard',       'SECONDARY', 'Secondary parent portal dashboard'),
  (gen_random_uuid(), 'SECONDARY_STUDENT_DASHBOARD',     'Student Dashboard',                'SECONDARY', 'Secondary student dashboard'),
  -- Advanced Secondary Modules
  (gen_random_uuid(), 'ADVANCED_FORM5_6',                'Form 5 & 6 Structures',            'ADVANCED',  'Form 5 and Form 6 academic structures'),
  (gen_random_uuid(), 'ADVANCED_STEM_SPECIALIZATION',    'STEM Specialization',              'ADVANCED',  'STEM specialization pathways'),
  (gen_random_uuid(), 'ADVANCED_ANALYTICS',              'Advanced Analytics',               'ADVANCED',  'Advanced academic analytics'),
  (gen_random_uuid(), 'ADVANCED_UNI_PREPARATION',        'University Preparation',           'ADVANCED',  'University preparation analytics and guidance'),
  (gen_random_uuid(), 'ADVANCED_SPECIALIZED_SUBJECTS',   'Specialized Subjects',             'ADVANCED',  'Advanced specialized subject management'),
  (gen_random_uuid(), 'ADVANCED_RESEARCH_MODULES',       'Research Modules',                 'ADVANCED',  'Advanced research and project modules'),
  (gen_random_uuid(), 'ADVANCED_TEACHER_DASHBOARD',      'Advanced Teacher Dashboard',       'ADVANCED',  'Advanced secondary teacher dashboard'),
  (gen_random_uuid(), 'ADVANCED_STUDENT_DASHBOARD',      'Advanced Student Dashboard',       'ADVANCED',  'Advanced secondary student dashboard'),
  -- College Modules
  (gen_random_uuid(), 'COLLEGE_DEPARTMENTS',             'Departments',                     'COLLEGE',   'College department management'),
  (gen_random_uuid(), 'COLLEGE_COURSES',                 'Courses',                         'COLLEGE',   'College course management'),
  (gen_random_uuid(), 'COLLEGE_SEMESTERS',               'Semesters',                       'COLLEGE',   'College semester management'),
  (gen_random_uuid(), 'COLLEGE_CREDITS',                 'Credits',                         'COLLEGE',   'College credit system'),
  (gen_random_uuid(), 'COLLEGE_GPA',                     'GPA System',                      'COLLEGE',   'College GPA calculation and tracking'),
  (gen_random_uuid(), 'COLLEGE_LECTURER_SYSTEM',          'Lecturer System',                 'COLLEGE',   'College lecturer management'),
  (gen_random_uuid(), 'COLLEGE_COURSE_REGISTRATION',      'Course Registration',             'COLLEGE',   'College course registration system'),
  (gen_random_uuid(), 'COLLEGE_ACADEMIC_TRANSCRIPTS',     'Academic Transcripts',            'COLLEGE',   'College academic transcript generation'),
  (gen_random_uuid(), 'COLLEGE_LECTURER_DASHBOARD',       'Lecturer Dashboard',              'COLLEGE',   'College lecturer dashboard'),
  (gen_random_uuid(), 'COLLEGE_STUDENT_DASHBOARD',        'College Student Dashboard',       'COLLEGE',   'College student dashboard'),
  -- University Modules
  (gen_random_uuid(), 'UNI_FACULTIES',                   'Faculties',                       'UNIVERSITY', 'University faculty management'),
  (gen_random_uuid(), 'UNI_SCHOOLS',                     'Schools',                         'UNIVERSITY', 'University school management'),
  (gen_random_uuid(), 'UNI_DEGREE_PROGRAMS',             'Degree Programs',                 'UNIVERSITY', 'University degree program management'),
  (gen_random_uuid(), 'UNI_RESEARCH_SYSTEMS',            'Research Systems',                'UNIVERSITY', 'University research management'),
  (gen_random_uuid(), 'UNI_SEMESTER_SYSTEM',             'Semester System',                 'UNIVERSITY', 'University semester management'),
  (gen_random_uuid(), 'UNI_CREDIT_SYSTEM',               'Credit System',                   'UNIVERSITY', 'University credit and unit system'),
  (gen_random_uuid(), 'UNI_GPA_CGPA',                    'GPA/CGPA System',                 'UNIVERSITY', 'University GPA and CGPA calculation'),
  (gen_random_uuid(), 'UNI_LECTURER_PORTAL',             'Lecturer Portal',                 'UNIVERSITY', 'University lecturer portal'),
  (gen_random_uuid(), 'UNI_STUDENT_PORTAL',              'Student Portal',                  'UNIVERSITY', 'University student portal'),
  (gen_random_uuid(), 'UNI_RESEARCH_SUPERVISION',        'Research Supervision',            'UNIVERSITY', 'University research supervision system'),
  (gen_random_uuid(), 'UNI_DEAN_DASHBOARD',              'Dean Dashboard',                  'UNIVERSITY', 'University dean analytics dashboard'),
  (gen_random_uuid(), 'UNI_LECTURER_DASHBOARD',          'University Lecturer Dashboard',   'UNIVERSITY', 'University lecturer dashboard'),
  (gen_random_uuid(), 'UNI_STUDENT_DASHBOARD',           'University Student Dashboard',    'UNIVERSITY', 'University student dashboard'),
  (gen_random_uuid(), 'UNI_VC_DASHBOARD',                'Vice Chancellor Dashboard',       'UNIVERSITY', 'Vice Chancellor analytics dashboard')
ON CONFLICT ("code") DO UPDATE SET
  "name"        = EXCLUDED."name",
  "category"    = EXCLUDED."category",
  "description" = EXCLUDED."description";

-- =============================================================================
-- 6. INSTITUTION ROLES
-- =============================================================================
INSERT INTO "InstitutionRole" ("id", "code", "name", "category", "description") VALUES
  -- Primary School Roles
  (gen_random_uuid(), 'PRIMARY_HEAD_TEACHER',  'Head Teacher',   'PRIMARY',    'Primary school head teacher'),
  (gen_random_uuid(), 'PRIMARY_DEPUTY_HEAD',   'Deputy Head',    'PRIMARY',    'Primary school deputy head'),
  (gen_random_uuid(), 'PRIMARY_TEACHER',        'Primary Teacher', 'PRIMARY',  'Primary school teacher'),
  (gen_random_uuid(), 'PRIMARY_PARENT',         'Parent',         'PRIMARY',   'Primary school parent/guardian'),
  (gen_random_uuid(), 'PRIMARY_LEARNER',        'Learner',        'PRIMARY',   'Primary school learner/student'),
  -- Secondary School Roles
  (gen_random_uuid(), 'SECONDARY_DIRECTOR',       'Director',       'SECONDARY', 'Secondary school director'),
  (gen_random_uuid(), 'SECONDARY_DEPUTY_DIRECTOR','Deputy Director', 'SECONDARY','Secondary school deputy director'),
  (gen_random_uuid(), 'SECONDARY_HOD',            'HOD',             'SECONDARY','Secondary school head of department'),
  (gen_random_uuid(), 'SECONDARY_TEACHER',        'Teacher',         'SECONDARY','Secondary school teacher'),
  (gen_random_uuid(), 'SECONDARY_CLASS_TEACHER',  'Class Teacher',   'SECONDARY','Secondary school class teacher'),
  (gen_random_uuid(), 'SECONDARY_PARENT',         'Parent',          'SECONDARY','Secondary school parent/guardian'),
  (gen_random_uuid(), 'SECONDARY_STUDENT',        'Student',         'SECONDARY','Secondary school student'),
  -- Advanced Secondary Roles
  (gen_random_uuid(), 'ADVANCED_DIRECTOR',        'Director',        'ADVANCED', 'Advanced secondary director'),
  (gen_random_uuid(), 'ADVANCED_DEPUTY_DIRECTOR', 'Deputy Director', 'ADVANCED', 'Advanced secondary deputy director'),
  (gen_random_uuid(), 'ADVANCED_HOD',             'HOD',             'ADVANCED', 'Advanced secondary head of department'),
  (gen_random_uuid(), 'ADVANCED_TEACHER',         'Teacher',         'ADVANCED', 'Advanced secondary teacher'),
  (gen_random_uuid(), 'ADVANCED_CLASS_TEACHER',   'Class Teacher',   'ADVANCED', 'Advanced secondary class teacher'),
  (gen_random_uuid(), 'ADVANCED_PARENT',          'Parent',          'ADVANCED', 'Advanced secondary parent/guardian'),
  (gen_random_uuid(), 'ADVANCED_STUDENT',         'Student',         'ADVANCED', 'Advanced secondary student'),
  -- College Roles
  (gen_random_uuid(), 'COLLEGE_PRINCIPAL',  'Principal', 'COLLEGE', 'College principal'),
  (gen_random_uuid(), 'COLLEGE_REGISTRAR',  'Registrar', 'COLLEGE', 'College registrar'),
  (gen_random_uuid(), 'COLLEGE_LECTURER',   'Lecturer',  'COLLEGE', 'College lecturer'),
  (gen_random_uuid(), 'COLLEGE_STUDENT',    'Student',   'COLLEGE', 'College student'),
  -- University Roles
  (gen_random_uuid(), 'UNI_VC',                 'Vice Chancellor',    'UNIVERSITY', 'University vice chancellor'),
  (gen_random_uuid(), 'UNI_DEAN',               'Dean',               'UNIVERSITY', 'University dean'),
  (gen_random_uuid(), 'UNI_LECTURER',           'Lecturer',           'UNIVERSITY', 'University lecturer'),
  (gen_random_uuid(), 'UNI_RESEARCH_SUPERVISOR','Research Supervisor','UNIVERSITY', 'University research supervisor'),
  (gen_random_uuid(), 'UNI_STUDENT',            'Student',            'UNIVERSITY', 'University student')
ON CONFLICT ("code") DO UPDATE SET
  "name"        = EXCLUDED."name",
  "category"    = EXCLUDED."category",
  "description" = EXCLUDED."description";

-- =============================================================================
-- 7. INSTITUTION FEATURES
-- =============================================================================
INSERT INTO "InstitutionFeature" ("id", "code", "name", "category", "description") VALUES
  (gen_random_uuid(), 'AI_TUTOR',               'AI Tutor',              'AI',           'AI-powered tutoring assistance'),
  (gen_random_uuid(), 'AI_ANALYTICS',           'AI Analytics',          'AI',           'AI-powered analytics engine'),
  (gen_random_uuid(), 'AI_RESEARCH',            'AI Research Assistant', 'AI',           'AI research assistance'),
  (gen_random_uuid(), 'BLOCKCHAIN_VERIFICATION','Blockchain Verification','SECURITY',     'Blockchain-based certificate and result verification'),
  (gen_random_uuid(), 'DIGITAL_SIGNATURES',     'Digital Signatures',    'SECURITY',     'Digital signature capabilities'),
  (gen_random_uuid(), 'MULTI_LANGUAGE',         'Multi-Language Support','SYSTEM',       'Multi-language interface support'),
  (gen_random_uuid(), 'CUSTOM_BRANDING',        'Custom Branding',       'SYSTEM',       'Custom school branding and theming'),
  (gen_random_uuid(), 'SMS_NOTIFICATIONS',      'SMS Notifications',     'COMMUNICATION','SMS-based notifications'),
  (gen_random_uuid(), 'EMAIL_NOTIFICATIONS',    'Email Notifications',   'COMMUNICATION','Email-based notifications'),
  (gen_random_uuid(), 'WHATSAPP_NOTIFICATIONS', 'WhatsApp Notifications','COMMUNICATION','WhatsApp-based notifications'),
  (gen_random_uuid(), 'BULK_IMPORT',            'Bulk Import',           'ADMIN',        'Bulk data import capabilities'),
  (gen_random_uuid(), 'API_ACCESS',             'API Access',            'ADMIN',        'External API access'),
  (gen_random_uuid(), 'AUDIT_TRAIL',            'Audit Trail',           'SECURITY',     'Detailed audit trail logging'),
  (gen_random_uuid(), 'TEMPLATE_MARKETPLACE',   'Template Marketplace',  'REPORT',       'Report template marketplace access'),
  (gen_random_uuid(), 'PARENT_PORTAL',          'Parent Portal',         'PORTAL',       'Parent portal access'),
  (gen_random_uuid(), 'STUDENT_PORTAL',         'Student Portal',        'PORTAL',       'Student portal access'),
  (gen_random_uuid(), 'MOBILE_APP',             'Mobile App Access',     'MOBILE',       'Mobile application access')
ON CONFLICT ("code") DO UPDATE SET
  "name"        = EXCLUDED."name",
  "category"    = EXCLUDED."category",
  "description" = EXCLUDED."description";

-- =============================================================================
-- 8. INSTITUTION DASHBOARDS
-- =============================================================================
INSERT INTO "InstitutionDashboard" ("id", "code", "name", "description") VALUES
  -- Primary School Dashboards
  (gen_random_uuid(), 'PRIMARY_HEAD_TEACHER_DASHBOARD',  'Head Teacher Dashboard',    'Primary head teacher overview dashboard'),
  (gen_random_uuid(), 'PRIMARY_DEPUTY_HEAD_DASHBOARD',   'Deputy Head Dashboard',     'Primary deputy head overview dashboard'),
  (gen_random_uuid(), 'PRIMARY_TEACHER_DASHBOARD',        'Primary Teacher Dashboard', 'Primary teacher class dashboard'),
  (gen_random_uuid(), 'PRIMARY_PARENT_DASHBOARD',         'Parent Dashboard',          'Primary parent/guardian dashboard'),
  (gen_random_uuid(), 'PRIMARY_LEARNER_DASHBOARD',        'Learner Dashboard',         'Primary learner dashboard'),
  -- Secondary School Dashboards
  (gen_random_uuid(), 'SECONDARY_DIRECTOR_DASHBOARD',         'Director Dashboard',          'Secondary director overview dashboard'),
  (gen_random_uuid(), 'SECONDARY_DEPUTY_DIRECTOR_DASHBOARD',  'Deputy Director Dashboard',   'Secondary deputy director dashboard'),
  (gen_random_uuid(), 'SECONDARY_HOD_DASHBOARD',              'HOD Dashboard',               'Head of Department dashboard'),
  (gen_random_uuid(), 'SECONDARY_TEACHER_DASHBOARD',          'Secondary Teacher Dashboard', 'Secondary teacher class dashboard'),
  (gen_random_uuid(), 'SECONDARY_CLASS_TEACHER_DASHBOARD',    'Class Teacher Dashboard',     'Secondary class teacher dashboard'),
  (gen_random_uuid(), 'SECONDARY_PARENT_DASHBOARD',           'Secondary Parent Dashboard',  'Secondary parent dashboard'),
  (gen_random_uuid(), 'SECONDARY_STUDENT_DASHBOARD',          'Student Dashboard',           'Secondary student dashboard'),
  -- Advanced Secondary Dashboards
  (gen_random_uuid(), 'ADVANCED_DIRECTOR_DASHBOARD',         'Director Dashboard',          'Advanced secondary director dashboard'),
  (gen_random_uuid(), 'ADVANCED_DEPUTY_DIRECTOR_DASHBOARD',  'Deputy Director Dashboard',   'Advanced secondary deputy director dashboard'),
  (gen_random_uuid(), 'ADVANCED_HOD_DASHBOARD',              'HOD Dashboard',               'Advanced secondary head of department dashboard'),
  (gen_random_uuid(), 'ADVANCED_TEACHER_DASHBOARD',          'Teacher Dashboard',           'Advanced secondary teacher dashboard'),
  (gen_random_uuid(), 'ADVANCED_CLASS_TEACHER_DASHBOARD',    'Class Teacher Dashboard',     'Advanced secondary class teacher dashboard'),
  (gen_random_uuid(), 'ADVANCED_PARENT_DASHBOARD',           'Parent Dashboard',            'Advanced secondary parent dashboard'),
  (gen_random_uuid(), 'ADVANCED_STUDENT_DASHBOARD',          'Student Dashboard',           'Advanced secondary student dashboard'),
  -- College Dashboards
  (gen_random_uuid(), 'COLLEGE_PRINCIPAL_DASHBOARD',  'Principal Dashboard',    'College principal overview dashboard'),
  (gen_random_uuid(), 'COLLEGE_REGISTRAR_DASHBOARD',  'Registrar Dashboard',    'College registrar dashboard'),
  (gen_random_uuid(), 'COLLEGE_LECTURER_DASHBOARD',   'Lecturer Dashboard',     'College lecturer dashboard'),
  (gen_random_uuid(), 'COLLEGE_STUDENT_DASHBOARD',    'College Student Dashboard','College student dashboard'),
  -- University Dashboards
  (gen_random_uuid(), 'UNI_VC_DASHBOARD',                   'Vice Chancellor Dashboard',        'University vice chancellor overview dashboard'),
  (gen_random_uuid(), 'UNI_DEAN_DASHBOARD',                 'Dean Dashboard',                   'University dean dashboard'),
  (gen_random_uuid(), 'UNI_LECTURER_DASHBOARD',             'University Lecturer Dashboard',    'University lecturer dashboard'),
  (gen_random_uuid(), 'UNI_RESEARCH_SUPERVISOR_DASHBOARD',  'Research Supervisor Dashboard',    'University research supervisor dashboard'),
  (gen_random_uuid(), 'UNI_STUDENT_DASHBOARD',              'University Student Dashboard',     'University student dashboard')
ON CONFLICT ("code") DO UPDATE SET
  "name"        = EXCLUDED."name",
  "description" = EXCLUDED."description";

-- =============================================================================
-- 9. INSTITUTION TYPE → MODULES (junction)
-- =============================================================================
INSERT INTO "InstitutionTypeModule" ("id", "institutionTypeId", "moduleId", "isActive", "sortOrder")
SELECT gen_random_uuid(), it.id, m.id, true, t.sort_order
FROM (VALUES
  ('PRIMARY_SCHOOL', 'CORE_ATTENDANCE', 0),
  ('PRIMARY_SCHOOL', 'CORE_USER_MANAGEMENT', 1),
  ('PRIMARY_SCHOOL', 'CORE_ROLE_MANAGEMENT', 2),
  ('PRIMARY_SCHOOL', 'CORE_SUBSCRIPTION', 3),
  ('PRIMARY_SCHOOL', 'CORE_NOTIFICATIONS', 4),
  ('PRIMARY_SCHOOL', 'CORE_AUDIT', 5),
  ('PRIMARY_SCHOOL', 'ACADEMIC_CLASSES', 6),
  ('PRIMARY_SCHOOL', 'ACADEMIC_SUBJECTS', 7),
  ('PRIMARY_SCHOOL', 'ACADEMIC_TIMETABLE', 8),
  ('PRIMARY_SCHOOL', 'ACADEMIC_ENROLLMENT', 9),
  ('PRIMARY_SCHOOL', 'ACADEMIC_ACADEMIC_YEAR', 10),
  ('PRIMARY_SCHOOL', 'PRIMARY_ATTENDANCE', 11),
  ('PRIMARY_SCHOOL', 'PRIMARY_REPORT_CARDS', 12),
  ('PRIMARY_SCHOOL', 'PRIMARY_ECZ_ANALYTICS', 13),
  ('PRIMARY_SCHOOL', 'PRIMARY_DASHBOARD_LOWER', 14),
  ('PRIMARY_SCHOOL', 'PRIMARY_EXAMINATIONS', 15),
  ('PRIMARY_SCHOOL', 'PRIMARY_GRADING', 16),
  ('PRIMARY_SCHOOL', 'PRIMARY_SUBJECT_COMBINATIONS', 17),
  ('PRIMARY_SCHOOL', 'PRIMARY_TEACHER_DASHBOARD', 18),
  ('PRIMARY_SCHOOL', 'PRIMARY_PARENT_DASHBOARD', 19),
  ('PRIMARY_SCHOOL', 'PRIMARY_LEARNER_DASHBOARD', 20),
  ('SECONDARY_SCHOOL', 'CORE_ATTENDANCE', 0),
  ('SECONDARY_SCHOOL', 'CORE_USER_MANAGEMENT', 1),
  ('SECONDARY_SCHOOL', 'CORE_ROLE_MANAGEMENT', 2),
  ('SECONDARY_SCHOOL', 'CORE_SUBSCRIPTION', 3),
  ('SECONDARY_SCHOOL', 'CORE_NOTIFICATIONS', 4),
  ('SECONDARY_SCHOOL', 'CORE_AUDIT', 5),
  ('SECONDARY_SCHOOL', 'ACADEMIC_CLASSES', 6),
  ('SECONDARY_SCHOOL', 'ACADEMIC_SUBJECTS', 7),
  ('SECONDARY_SCHOOL', 'ACADEMIC_TIMETABLE', 8),
  ('SECONDARY_SCHOOL', 'ACADEMIC_ENROLLMENT', 9),
  ('SECONDARY_SCHOOL', 'ACADEMIC_ACADEMIC_YEAR', 10),
  ('SECONDARY_SCHOOL', 'SECONDARY_ATTENDANCE', 11),
  ('SECONDARY_SCHOOL', 'SECONDARY_ANALYTICS', 12),
  ('SECONDARY_SCHOOL', 'SECONDARY_REPORT_CARDS', 13),
  ('SECONDARY_SCHOOL', 'SECONDARY_FORM_PROGRESSION', 14),
  ('SECONDARY_SCHOOL', 'SECONDARY_GRADE12_ANALYTICS', 15),
  ('SECONDARY_SCHOOL', 'SECONDARY_EXAMINATIONS', 16),
  ('SECONDARY_SCHOOL', 'SECONDARY_SUBJECT_COMBINATIONS', 17),
  ('SECONDARY_SCHOOL', 'SECONDARY_CAREER_GUIDANCE', 18),
  ('SECONDARY_SCHOOL', 'SECONDARY_TEACHER_DASHBOARD', 19),
  ('SECONDARY_SCHOOL', 'SECONDARY_HOD_DASHBOARD', 20),
  ('SECONDARY_SCHOOL', 'SECONDARY_PARENT_DASHBOARD', 21),
  ('SECONDARY_SCHOOL', 'SECONDARY_STUDENT_DASHBOARD', 22),
  ('ADVANCED_SECONDARY', 'CORE_ATTENDANCE', 0),
  ('ADVANCED_SECONDARY', 'CORE_USER_MANAGEMENT', 1),
  ('ADVANCED_SECONDARY', 'CORE_ROLE_MANAGEMENT', 2),
  ('ADVANCED_SECONDARY', 'CORE_SUBSCRIPTION', 3),
  ('ADVANCED_SECONDARY', 'CORE_NOTIFICATIONS', 4),
  ('ADVANCED_SECONDARY', 'CORE_AUDIT', 5),
  ('ADVANCED_SECONDARY', 'ACADEMIC_CLASSES', 6),
  ('ADVANCED_SECONDARY', 'ACADEMIC_SUBJECTS', 7),
  ('ADVANCED_SECONDARY', 'ACADEMIC_TIMETABLE', 8),
  ('ADVANCED_SECONDARY', 'ACADEMIC_ENROLLMENT', 9),
  ('ADVANCED_SECONDARY', 'ACADEMIC_ACADEMIC_YEAR', 10),
  ('ADVANCED_SECONDARY', 'ADVANCED_FORM5_6', 11),
  ('ADVANCED_SECONDARY', 'ADVANCED_STEM_SPECIALIZATION', 12),
  ('ADVANCED_SECONDARY', 'ADVANCED_ANALYTICS', 13),
  ('ADVANCED_SECONDARY', 'ADVANCED_UNI_PREPARATION', 14),
  ('ADVANCED_SECONDARY', 'ADVANCED_SPECIALIZED_SUBJECTS', 15),
  ('ADVANCED_SECONDARY', 'ADVANCED_RESEARCH_MODULES', 16),
  ('ADVANCED_SECONDARY', 'ADVANCED_TEACHER_DASHBOARD', 17),
  ('ADVANCED_SECONDARY', 'ADVANCED_STUDENT_DASHBOARD', 18),
  ('COLLEGE', 'CORE_ATTENDANCE', 0),
  ('COLLEGE', 'CORE_USER_MANAGEMENT', 1),
  ('COLLEGE', 'CORE_ROLE_MANAGEMENT', 2),
  ('COLLEGE', 'CORE_SUBSCRIPTION', 3),
  ('COLLEGE', 'CORE_NOTIFICATIONS', 4),
  ('COLLEGE', 'CORE_AUDIT', 5),
  ('COLLEGE', 'ACADEMIC_CLASSES', 6),
  ('COLLEGE', 'ACADEMIC_SUBJECTS', 7),
  ('COLLEGE', 'ACADEMIC_TIMETABLE', 8),
  ('COLLEGE', 'ACADEMIC_ENROLLMENT', 9),
  ('COLLEGE', 'ACADEMIC_ACADEMIC_YEAR', 10),
  ('COLLEGE', 'COLLEGE_DEPARTMENTS', 11),
  ('COLLEGE', 'COLLEGE_COURSES', 12),
  ('COLLEGE', 'COLLEGE_SEMESTERS', 13),
  ('COLLEGE', 'COLLEGE_CREDITS', 14),
  ('COLLEGE', 'COLLEGE_GPA', 15),
  ('COLLEGE', 'COLLEGE_LECTURER_SYSTEM', 16),
  ('COLLEGE', 'COLLEGE_COURSE_REGISTRATION', 17),
  ('COLLEGE', 'COLLEGE_ACADEMIC_TRANSCRIPTS', 18),
  ('COLLEGE', 'COLLEGE_LECTURER_DASHBOARD', 19),
  ('COLLEGE', 'COLLEGE_STUDENT_DASHBOARD', 20),
  ('UNIVERSITY', 'CORE_ATTENDANCE', 0),
  ('UNIVERSITY', 'CORE_USER_MANAGEMENT', 1),
  ('UNIVERSITY', 'CORE_ROLE_MANAGEMENT', 2),
  ('UNIVERSITY', 'CORE_SUBSCRIPTION', 3),
  ('UNIVERSITY', 'CORE_NOTIFICATIONS', 4),
  ('UNIVERSITY', 'CORE_AUDIT', 5),
  ('UNIVERSITY', 'ACADEMIC_CLASSES', 6),
  ('UNIVERSITY', 'ACADEMIC_SUBJECTS', 7),
  ('UNIVERSITY', 'ACADEMIC_TIMETABLE', 8),
  ('UNIVERSITY', 'ACADEMIC_ENROLLMENT', 9),
  ('UNIVERSITY', 'ACADEMIC_ACADEMIC_YEAR', 10),
  ('UNIVERSITY', 'UNI_FACULTIES', 11),
  ('UNIVERSITY', 'UNI_SCHOOLS', 12),
  ('UNIVERSITY', 'UNI_DEGREE_PROGRAMS', 13),
  ('UNIVERSITY', 'UNI_RESEARCH_SYSTEMS', 14),
  ('UNIVERSITY', 'UNI_SEMESTER_SYSTEM', 15),
  ('UNIVERSITY', 'UNI_CREDIT_SYSTEM', 16),
  ('UNIVERSITY', 'UNI_GPA_CGPA', 17),
  ('UNIVERSITY', 'UNI_LECTURER_PORTAL', 18),
  ('UNIVERSITY', 'UNI_STUDENT_PORTAL', 19),
  ('UNIVERSITY', 'UNI_RESEARCH_SUPERVISION', 20),
  ('UNIVERSITY', 'UNI_DEAN_DASHBOARD', 21),
  ('UNIVERSITY', 'UNI_LECTURER_DASHBOARD', 22),
  ('UNIVERSITY', 'UNI_STUDENT_DASHBOARD', 23),
  ('UNIVERSITY', 'UNI_VC_DASHBOARD', 24)
) AS t(type_code, mod_code, sort_order)
JOIN "InstitutionType" it ON it.code = t.type_code::"InstitutionTypeCode"
JOIN "InstitutionModule" m ON m.code = t.mod_code
ON CONFLICT ("institutionTypeId", "moduleId") DO UPDATE SET
  "isActive"  = true,
  "sortOrder" = EXCLUDED."sortOrder";

-- =============================================================================
-- 10. INSTITUTION TYPE → FEATURES (junction)
-- =============================================================================
INSERT INTO "InstitutionTypeFeature" ("id", "institutionTypeId", "featureId", "isEnabled")
SELECT gen_random_uuid(), it.id, f.id, true
FROM (VALUES
  ('PRIMARY_SCHOOL', 'DIGITAL_SIGNATURES'),
  ('PRIMARY_SCHOOL', 'AUDIT_TRAIL'),
  ('PRIMARY_SCHOOL', 'EMAIL_NOTIFICATIONS'),
  ('PRIMARY_SCHOOL', 'PARENT_PORTAL'),
  ('PRIMARY_SCHOOL', 'STUDENT_PORTAL'),
  ('PRIMARY_SCHOOL', 'MOBILE_APP'),
  ('PRIMARY_SCHOOL', 'AI_TUTOR'),
  ('PRIMARY_SCHOOL', 'SMS_NOTIFICATIONS'),
  ('SECONDARY_SCHOOL', 'DIGITAL_SIGNATURES'),
  ('SECONDARY_SCHOOL', 'AUDIT_TRAIL'),
  ('SECONDARY_SCHOOL', 'EMAIL_NOTIFICATIONS'),
  ('SECONDARY_SCHOOL', 'PARENT_PORTAL'),
  ('SECONDARY_SCHOOL', 'STUDENT_PORTAL'),
  ('SECONDARY_SCHOOL', 'MOBILE_APP'),
  ('SECONDARY_SCHOOL', 'AI_TUTOR'),
  ('SECONDARY_SCHOOL', 'AI_ANALYTICS'),
  ('SECONDARY_SCHOOL', 'SMS_NOTIFICATIONS'),
  ('SECONDARY_SCHOOL', 'WHATSAPP_NOTIFICATIONS'),
  ('ADVANCED_SECONDARY', 'DIGITAL_SIGNATURES'),
  ('ADVANCED_SECONDARY', 'AUDIT_TRAIL'),
  ('ADVANCED_SECONDARY', 'EMAIL_NOTIFICATIONS'),
  ('ADVANCED_SECONDARY', 'PARENT_PORTAL'),
  ('ADVANCED_SECONDARY', 'STUDENT_PORTAL'),
  ('ADVANCED_SECONDARY', 'MOBILE_APP'),
  ('ADVANCED_SECONDARY', 'AI_TUTOR'),
  ('ADVANCED_SECONDARY', 'AI_ANALYTICS'),
  ('ADVANCED_SECONDARY', 'SMS_NOTIFICATIONS'),
  ('ADVANCED_SECONDARY', 'BULK_IMPORT'),
  ('COLLEGE', 'DIGITAL_SIGNATURES'),
  ('COLLEGE', 'AUDIT_TRAIL'),
  ('COLLEGE', 'EMAIL_NOTIFICATIONS'),
  ('COLLEGE', 'PARENT_PORTAL'),
  ('COLLEGE', 'STUDENT_PORTAL'),
  ('COLLEGE', 'MOBILE_APP'),
  ('COLLEGE', 'AI_ANALYTICS'),
  ('COLLEGE', 'BULK_IMPORT'),
  ('COLLEGE', 'API_ACCESS'),
  ('COLLEGE', 'TEMPLATE_MARKETPLACE'),
  ('UNIVERSITY', 'DIGITAL_SIGNATURES'),
  ('UNIVERSITY', 'AUDIT_TRAIL'),
  ('UNIVERSITY', 'EMAIL_NOTIFICATIONS'),
  ('UNIVERSITY', 'PARENT_PORTAL'),
  ('UNIVERSITY', 'STUDENT_PORTAL'),
  ('UNIVERSITY', 'MOBILE_APP'),
  ('UNIVERSITY', 'AI_TUTOR'),
  ('UNIVERSITY', 'AI_ANALYTICS'),
  ('UNIVERSITY', 'AI_RESEARCH'),
  ('UNIVERSITY', 'BLOCKCHAIN_VERIFICATION'),
  ('UNIVERSITY', 'BULK_IMPORT'),
  ('UNIVERSITY', 'API_ACCESS'),
  ('UNIVERSITY', 'TEMPLATE_MARKETPLACE'),
  ('UNIVERSITY', 'CUSTOM_BRANDING')
) AS t(type_code, feat_code)
JOIN "InstitutionType" it ON it.code = t.type_code::"InstitutionTypeCode"
JOIN "InstitutionFeature" f ON f.code = t.feat_code
ON CONFLICT ("institutionTypeId", "featureId") DO UPDATE SET
  "isEnabled" = true;

-- =============================================================================
-- 11. INSTITUTION TYPE → ROLES (junction)
-- =============================================================================
INSERT INTO "InstitutionTypeRole" ("id", "institutionTypeId", "roleId", "isActive")
SELECT gen_random_uuid(), it.id, ir.id, true
FROM (VALUES
  ('PRIMARY_SCHOOL', 'PRIMARY_HEAD_TEACHER'),
  ('PRIMARY_SCHOOL', 'PRIMARY_DEPUTY_HEAD'),
  ('PRIMARY_SCHOOL', 'PRIMARY_TEACHER'),
  ('PRIMARY_SCHOOL', 'PRIMARY_PARENT'),
  ('PRIMARY_SCHOOL', 'PRIMARY_LEARNER'),
  ('SECONDARY_SCHOOL', 'SECONDARY_DIRECTOR'),
  ('SECONDARY_SCHOOL', 'SECONDARY_DEPUTY_DIRECTOR'),
  ('SECONDARY_SCHOOL', 'SECONDARY_HOD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_TEACHER'),
  ('SECONDARY_SCHOOL', 'SECONDARY_CLASS_TEACHER'),
  ('SECONDARY_SCHOOL', 'SECONDARY_PARENT'),
  ('SECONDARY_SCHOOL', 'SECONDARY_STUDENT'),
  ('ADVANCED_SECONDARY', 'ADVANCED_DIRECTOR'),
  ('ADVANCED_SECONDARY', 'ADVANCED_DEPUTY_DIRECTOR'),
  ('ADVANCED_SECONDARY', 'ADVANCED_HOD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_TEACHER'),
  ('ADVANCED_SECONDARY', 'ADVANCED_CLASS_TEACHER'),
  ('ADVANCED_SECONDARY', 'ADVANCED_PARENT'),
  ('ADVANCED_SECONDARY', 'ADVANCED_STUDENT'),
  ('COLLEGE', 'COLLEGE_PRINCIPAL'),
  ('COLLEGE', 'COLLEGE_REGISTRAR'),
  ('COLLEGE', 'COLLEGE_LECTURER'),
  ('COLLEGE', 'COLLEGE_STUDENT'),
  ('UNIVERSITY', 'UNI_VC'),
  ('UNIVERSITY', 'UNI_DEAN'),
  ('UNIVERSITY', 'UNI_LECTURER'),
  ('UNIVERSITY', 'UNI_RESEARCH_SUPERVISOR'),
  ('UNIVERSITY', 'UNI_STUDENT')
) AS t(type_code, role_code)
JOIN "InstitutionType" it ON it.code = t.type_code::"InstitutionTypeCode"
JOIN "InstitutionRole" ir ON ir.code = t.role_code
ON CONFLICT ("institutionTypeId", "roleId") DO UPDATE SET
  "isActive" = true;

-- =============================================================================
-- 12. INSTITUTION TYPE → DASHBOARDS (junction)
-- =============================================================================
INSERT INTO "InstitutionTypeDashboard" ("id", "institutionTypeId", "dashboardId", "isDefault")
SELECT gen_random_uuid(), it.id, d.id, true
FROM (VALUES
  ('PRIMARY_SCHOOL', 'PRIMARY_HEAD_TEACHER_DASHBOARD'),
  ('PRIMARY_SCHOOL', 'PRIMARY_DEPUTY_HEAD_DASHBOARD'),
  ('PRIMARY_SCHOOL', 'PRIMARY_TEACHER_DASHBOARD'),
  ('PRIMARY_SCHOOL', 'PRIMARY_PARENT_DASHBOARD'),
  ('PRIMARY_SCHOOL', 'PRIMARY_LEARNER_DASHBOARD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_DIRECTOR_DASHBOARD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_DEPUTY_DIRECTOR_DASHBOARD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_HOD_DASHBOARD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_TEACHER_DASHBOARD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_CLASS_TEACHER_DASHBOARD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_PARENT_DASHBOARD'),
  ('SECONDARY_SCHOOL', 'SECONDARY_STUDENT_DASHBOARD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_DIRECTOR_DASHBOARD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_DEPUTY_DIRECTOR_DASHBOARD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_HOD_DASHBOARD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_TEACHER_DASHBOARD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_CLASS_TEACHER_DASHBOARD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_PARENT_DASHBOARD'),
  ('ADVANCED_SECONDARY', 'ADVANCED_STUDENT_DASHBOARD'),
  ('COLLEGE', 'COLLEGE_PRINCIPAL_DASHBOARD'),
  ('COLLEGE', 'COLLEGE_REGISTRAR_DASHBOARD'),
  ('COLLEGE', 'COLLEGE_LECTURER_DASHBOARD'),
  ('COLLEGE', 'COLLEGE_STUDENT_DASHBOARD'),
  ('UNIVERSITY', 'UNI_VC_DASHBOARD'),
  ('UNIVERSITY', 'UNI_DEAN_DASHBOARD'),
  ('UNIVERSITY', 'UNI_LECTURER_DASHBOARD'),
  ('UNIVERSITY', 'UNI_RESEARCH_SUPERVISOR_DASHBOARD'),
  ('UNIVERSITY', 'UNI_STUDENT_DASHBOARD')
) AS t(type_code, dash_code)
JOIN "InstitutionType" it ON it.code = t.type_code::"InstitutionTypeCode"
JOIN "InstitutionDashboard" d ON d.code = t.dash_code
ON CONFLICT ("institutionTypeId", "dashboardId") DO UPDATE SET
  "isDefault" = true;

-- =============================================================================
-- 13. INSTITUTION SETTINGS
-- =============================================================================
INSERT INTO "InstitutionSetting" ("id", "institutionTypeId", "key", "value", "isRequired")
SELECT gen_random_uuid(), it.id, t.setting_key, t.setting_value, t.is_required
FROM (VALUES
  ('PRIMARY_SCHOOL',    'grading_system',           '"PRIMARY_ECZ"'::jsonb,         true),
  ('PRIMARY_SCHOOL',    'academic_structure',       '"GRADE_BASED"'::jsonb,         true),
  ('PRIMARY_SCHOOL',    'terms_per_year',           '3'::jsonb,                     true),
  ('PRIMARY_SCHOOL',    'min_attendance_percentage', '80'::jsonb,                   true),
  ('SECONDARY_SCHOOL',  'grading_system',           '"SECONDARY_ECZ"'::jsonb,       true),
  ('SECONDARY_SCHOOL',  'academic_structure',       '"FORM_BASED"'::jsonb,          true),
  ('SECONDARY_SCHOOL',  'terms_per_year',           '3'::jsonb,                     true),
  ('SECONDARY_SCHOOL',  'min_attendance_percentage', '80'::jsonb,                   true),
  ('ADVANCED_SECONDARY','grading_system',            '"ADVANCED_A_LEVEL"'::jsonb,   true),
  ('ADVANCED_SECONDARY','academic_structure',        '"FORM_BASED"'::jsonb,          true),
  ('ADVANCED_SECONDARY','terms_per_year',            '3'::jsonb,                    true),
  ('ADVANCED_SECONDARY','stem_pathway_enabled',      'true'::jsonb,                 false),
  ('COLLEGE',           'grading_system',            '"COLLEGE_GPA"'::jsonb,        true),
  ('COLLEGE',           'academic_structure',        '"SEMESTER_BASED"'::jsonb,     true),
  ('COLLEGE',           'credit_system',             'true'::jsonb,                 true),
  ('COLLEGE',           'max_credits_per_semester',  '18'::jsonb,                   false),
  ('UNIVERSITY',        'grading_system',            '"UNIVERSITY_CGPA"'::jsonb,    true),
  ('UNIVERSITY',        'academic_structure',        '"SEMESTER_BASED"'::jsonb,     true),
  ('UNIVERSITY',        'credit_system',             'true'::jsonb,                 true),
  ('UNIVERSITY',        'research_system',           'true'::jsonb,                 false),
  ('UNIVERSITY',        'max_credits_per_semester',  '24'::jsonb,                   false)
) AS t(type_code, setting_key, setting_value, is_required)
JOIN "InstitutionType" it ON it.code = t.type_code::"InstitutionTypeCode"
ON CONFLICT ("institutionTypeId", "key") DO UPDATE SET
  "value"      = EXCLUDED."value",
  "isRequired" = EXCLUDED."isRequired";

-- =============================================================================
-- 14. SYSTEM SETTINGS
-- =============================================================================
INSERT INTO "SystemSetting" ("id", "key", "value", "isPublic", "updatedAt") VALUES
  (gen_random_uuid(), 'messaging_sandbox_mode', '"false"'::jsonb,        false, NOW()),
  (gen_random_uuid(), 'beem_enabled',           '"true"'::jsonb,         false, NOW()),
  (gen_random_uuid(), 'beem_sender_name',       '"SmartTech"'::jsonb,    false, NOW()),
  (gen_random_uuid(), 'system_name',            '"Smart Tech SaaS"'::jsonb, false, NOW()),
  (gen_random_uuid(), 'session_timeout',        '"60"'::jsonb,           false, NOW()),
  (gen_random_uuid(), 'max_login_attempts',     '"5"'::jsonb,            false, NOW()),
  (gen_random_uuid(), 'password_min_length',    '"8"'::jsonb,            false, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "value"    = EXCLUDED."value",
  "isPublic" = EXCLUDED."isPublic",
  "updatedAt" = NOW();

-- =============================================================================
-- 15. SYSTEM COMMUNICATION PROVIDERS
-- =============================================================================
INSERT INTO "SystemProvider" (
  "id", "name", "type", "channel",
  "host", "port", "username", "password",
  "apiKey", "apiSecret", "senderEmail", "senderName",
  "status", "isDefault", "config",
  "updatedAt"
) VALUES
(
  gen_random_uuid(),
  'Zoho Mail', 'SMTP', 'EMAIL',
  'smtp.zoho.com', 587, 'noreply@smarttechsaas.com', 'your_zoho_app_password',
  NULL, NULL, 'noreply@smarttechsaas.com', 'Smart Tech',
  'Connected', true,
  '{"secure":false,"requireTLS":true}'::jsonb,
  NOW()
),
(
  gen_random_uuid(),
  'SendGrid', 'API', 'EMAIL',
  NULL, NULL, NULL, NULL,
  'your_sendgrid_api_key', NULL, 'noreply@smarttechsaas.com', 'Smart Tech',
  'Connected', false,
  '{"rateLimit":100,"monthlyLimit":50000}'::jsonb,
  NOW()
),
(
  gen_random_uuid(),
  'Beem Africa SMS', 'API', 'SMS',
  NULL, NULL, NULL, NULL,
  'your_beem_api_key', 'your_beem_api_secret', NULL, 'SmartTech',
  'Connected', true,
  '{"twoWay":true,"deliveryReports":true}'::jsonb,
  NOW()
),
(
  gen_random_uuid(),
  'Beem Africa WhatsApp', 'API', 'WHATSAPP',
  NULL, NULL, NULL, NULL,
  'your_beem_api_key', 'your_beem_api_secret', NULL, 'SmartTech',
  'Connected', true,
  '{"templateBased":true,"rateLimit":250}'::jsonb,
  NOW()
)
ON CONFLICT ("name", "channel") DO UPDATE SET
  "type"        = EXCLUDED."type",
  "host"        = EXCLUDED."host",
  "port"        = EXCLUDED."port",
  "username"    = EXCLUDED."username",
  "password"    = EXCLUDED."password",
  "apiKey"      = EXCLUDED."apiKey",
  "apiSecret"   = EXCLUDED."apiSecret",
  "senderEmail" = EXCLUDED."senderEmail",
  "senderName"  = EXCLUDED."senderName",
  "status"      = EXCLUDED."status",
  "isDefault"   = EXCLUDED."isDefault",
  "config"      = EXCLUDED."config",
  "updatedAt"   = NOW();

COMMIT;
