import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    'Director',
    'Deputy Director',
    'Head Teacher',
    'Deputy',
    'Accountant',
    'Secretary',
    'Teacher',
    'Class Teacher',
    'HOD',
    'Student',
    'Parent',
    'SuperAdmin',
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }

  const plans = [
    {
      name: 'BASIC',
      displayName: 'Basic',
      description: 'Perfect for small schools getting started',
      monthlyPrice: 990,
      yearlyPrice: 9900,
      maxStudents: 100,
      maxTeachers: 10,
      maxClasses: 8,
      maxStorageGB: 5,
      features: JSON.stringify([
        'Basic Timetable',
        'Student Management',
        'Teacher Management',
        'Results Management',
        'Email Support',
      ]),
      isActive: true,
      isPopular: false,
    },
    {
      name: 'STANDARD',
      displayName: 'Standard',
      description: 'For growing schools with more needs',
      monthlyPrice: 1990,
      yearlyPrice: 19900,
      maxStudents: 500,
      maxTeachers: 50,
      maxClasses: 25,
      maxStorageGB: 15,
      features: JSON.stringify([
        'Everything in Basic',
        'Advanced Timetable AI',
        'Parent Portal',
        'Fee Management',
        'Notice Board',
        'Priority Support',
      ]),
      isActive: true,
      isPopular: true,
    },
    {
      name: 'PREMIUM',
      displayName: 'Premium',
      description: 'Full-featured for large institutions',
      monthlyPrice: 3990,
      yearlyPrice: 39900,
      maxStudents: -1,
      maxTeachers: -1,
      maxClasses: -1,
      maxStorageGB: 100,
      features: JSON.stringify([
        'Everything in Standard',
        'Unlimited Users',
        'Custom Branding',
        'API Access',
        'Dedicated Support',
        'White-label Options',
      ]),
      isActive: true,
      isPopular: false,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  // =============================================
  // INSTITUTION TYPE ENGINE SEED
  // =============================================

  // Institution Types
  const institutionTypes = [
    { code: 'PRIMARY_SCHOOL' as const, name: 'Primary School', description: 'Early childhood and primary education (Grade 1-7)' },
    { code: 'SECONDARY_SCHOOL' as const, name: 'Secondary School', description: 'Secondary education (Grade 8-12)' },
    { code: 'ADVANCED_SECONDARY' as const, name: 'Advanced Secondary', description: 'Advanced secondary education (Form 5-6)' },
    { code: 'COLLEGE' as const, name: 'College', description: 'College and tertiary education' },
    { code: 'UNIVERSITY' as const, name: 'University', description: 'University education (undergraduate and postgraduate)' },
  ];

  for (const type of institutionTypes) {
    await prisma.institutionType.upsert({
      where: { code: type.code },
      update: { name: type.name, description: type.description },
      create: type,
    });
  }

  // Institution Modules
  const modules = [
    // Core Modules
    { code: 'CORE_ATTENDANCE', name: 'Core Attendance', category: 'CORE', description: 'Basic attendance tracking' },
    { code: 'CORE_USER_MANAGEMENT', name: 'User Management', category: 'CORE', description: 'User account management' },
    { code: 'CORE_ROLE_MANAGEMENT', name: 'Role Management', category: 'CORE', description: 'Role-based access control' },
    { code: 'CORE_SUBSCRIPTION', name: 'Subscription Management', category: 'CORE', description: 'Subscription and billing' },
    { code: 'CORE_NOTIFICATIONS', name: 'Notifications', category: 'CORE', description: 'Push and email notifications' },
    { code: 'CORE_AUDIT', name: 'Audit Trail', category: 'CORE', description: 'Audit logging and security' },

    // Academic Modules
    { code: 'ACADEMIC_CLASSES', name: 'Class Management', category: 'ACADEMIC', description: 'Class and grade management' },
    { code: 'ACADEMIC_SUBJECTS', name: 'Subject Management', category: 'ACADEMIC', description: 'Subject and curriculum management' },
    { code: 'ACADEMIC_TIMETABLE', name: 'Timetable', category: 'ACADEMIC', description: 'Class timetable scheduling' },
    { code: 'ACADEMIC_ENROLLMENT', name: 'Enrollment', category: 'ACADEMIC', description: 'Student enrollment management' },
    { code: 'ACADEMIC_ACADEMIC_YEAR', name: 'Academic Year', category: 'ACADEMIC', description: 'Academic year and term management' },

    // Primary-Specific Modules
    { code: 'PRIMARY_ATTENDANCE', name: 'Primary Attendance', category: 'PRIMARY', description: 'Primary school attendance tracking' },
    { code: 'PRIMARY_REPORT_CARDS', name: 'Primary Report Cards', category: 'PRIMARY', description: 'Primary school report card generation' },
    { code: 'PRIMARY_ECZ_ANALYTICS', name: 'Grade 7 ECZ Analytics', category: 'PRIMARY', description: 'Grade 7 ECZ examination analytics' },
    { code: 'PRIMARY_DASHBOARD_LOWER', name: 'Lower Primary Dashboard', category: 'PRIMARY', description: 'Lower primary (Grade 1-4) dashboards' },
    { code: 'PRIMARY_EXAMINATIONS', name: 'Primary Examinations', category: 'PRIMARY', description: 'Primary school examination system' },
    { code: 'PRIMARY_GRADING', name: 'Primary Grading System', category: 'PRIMARY', description: 'Primary school grading system' },
    { code: 'PRIMARY_SUBJECT_COMBINATIONS', name: 'Primary Subject Combinations', category: 'PRIMARY', description: 'Primary subject combination management' },
    { code: 'PRIMARY_TEACHER_DASHBOARD', name: 'Primary Teacher Dashboard', category: 'PRIMARY', description: 'Primary teacher analytics dashboard' },
    { code: 'PRIMARY_PARENT_DASHBOARD', name: 'Parent Dashboard', category: 'PRIMARY', description: 'Primary parent portal dashboard' },
    { code: 'PRIMARY_LEARNER_DASHBOARD', name: 'Learner Dashboard', category: 'PRIMARY', description: 'Primary learner dashboard' },

    // Secondary-Specific Modules
    { code: 'SECONDARY_ATTENDANCE', name: 'Secondary Attendance', category: 'SECONDARY', description: 'Secondary school attendance tracking' },
    { code: 'SECONDARY_ANALYTICS', name: 'Secondary Analytics', category: 'SECONDARY', description: 'Secondary school analytics dashboard' },
    { code: 'SECONDARY_REPORT_CARDS', name: 'Secondary Report Cards', category: 'SECONDARY', description: 'Secondary school report card generation' },
    { code: 'SECONDARY_FORM_PROGRESSION', name: 'Form Progression', category: 'SECONDARY', description: 'Form progression tracking system' },
    { code: 'SECONDARY_GRADE12_ANALYTICS', name: 'Grade 12 Analytics', category: 'SECONDARY', description: 'Grade 12 examination analytics' },
    { code: 'SECONDARY_EXAMINATIONS', name: 'Secondary Examinations', category: 'SECONDARY', description: 'Secondary school examination system' },
    { code: 'SECONDARY_SUBJECT_COMBINATIONS', name: 'Secondary Subject Combinations', category: 'SECONDARY', description: 'Secondary subject combination management' },
    { code: 'SECONDARY_CAREER_GUIDANCE', name: 'Career Guidance', category: 'SECONDARY', description: 'Secondary career guidance and counseling' },
    { code: 'SECONDARY_TEACHER_DASHBOARD', name: 'Secondary Teacher Dashboard', category: 'SECONDARY', description: 'Secondary teacher analytics dashboard' },
    { code: 'SECONDARY_HOD_DASHBOARD', name: 'HOD Dashboard', category: 'SECONDARY', description: 'Head of Department analytics dashboard' },
    { code: 'SECONDARY_PARENT_DASHBOARD', name: 'Secondary Parent Dashboard', category: 'SECONDARY', description: 'Secondary parent portal dashboard' },
    { code: 'SECONDARY_STUDENT_DASHBOARD', name: 'Student Dashboard', category: 'SECONDARY', description: 'Secondary student dashboard' },

    // Advanced Secondary Modules
    { code: 'ADVANCED_FORM5_6', name: 'Form 5 & 6 Structures', category: 'ADVANCED', description: 'Form 5 and Form 6 academic structures' },
    { code: 'ADVANCED_STEM_SPECIALIZATION', name: 'STEM Specialization', category: 'ADVANCED', description: 'STEM specialization pathways' },
    { code: 'ADVANCED_ANALYTICS', name: 'Advanced Analytics', category: 'ADVANCED', description: 'Advanced academic analytics' },
    { code: 'ADVANCED_UNI_PREPARATION', name: 'University Preparation', category: 'ADVANCED', description: 'University preparation analytics and guidance' },
    { code: 'ADVANCED_SPECIALIZED_SUBJECTS', name: 'Specialized Subjects', category: 'ADVANCED', description: 'Advanced specialized subject management' },
    { code: 'ADVANCED_RESEARCH_MODULES', name: 'Research Modules', category: 'ADVANCED', description: 'Advanced research and project modules' },
    { code: 'ADVANCED_TEACHER_DASHBOARD', name: 'Advanced Teacher Dashboard', category: 'ADVANCED', description: 'Advanced secondary teacher dashboard' },
    { code: 'ADVANCED_STUDENT_DASHBOARD', name: 'Advanced Student Dashboard', category: 'ADVANCED', description: 'Advanced secondary student dashboard' },

    // College Modules
    { code: 'COLLEGE_DEPARTMENTS', name: 'Departments', category: 'COLLEGE', description: 'College department management' },
    { code: 'COLLEGE_COURSES', name: 'Courses', category: 'COLLEGE', description: 'College course management' },
    { code: 'COLLEGE_SEMESTERS', name: 'Semesters', category: 'COLLEGE', description: 'College semester management' },
    { code: 'COLLEGE_CREDITS', name: 'Credits', category: 'COLLEGE', description: 'College credit system' },
    { code: 'COLLEGE_GPA', name: 'GPA System', category: 'COLLEGE', description: 'College GPA calculation and tracking' },
    { code: 'COLLEGE_LECTURER_SYSTEM', name: 'Lecturer System', category: 'COLLEGE', description: 'College lecturer management' },
    { code: 'COLLEGE_COURSE_REGISTRATION', name: 'Course Registration', category: 'COLLEGE', description: 'College course registration system' },
    { code: 'COLLEGE_ACADEMIC_TRANSCRIPTS', name: 'Academic Transcripts', category: 'COLLEGE', description: 'College academic transcript generation' },
    { code: 'COLLEGE_LECTURER_DASHBOARD', name: 'Lecturer Dashboard', category: 'COLLEGE', description: 'College lecturer dashboard' },
    { code: 'COLLEGE_STUDENT_DASHBOARD', name: 'College Student Dashboard', category: 'COLLEGE', description: 'College student dashboard' },

    // University Modules
    { code: 'UNI_FACULTIES', name: 'Faculties', category: 'UNIVERSITY', description: 'University faculty management' },
    { code: 'UNI_SCHOOLS', name: 'Schools', category: 'UNIVERSITY', description: 'University school management' },
    { code: 'UNI_DEGREE_PROGRAMS', name: 'Degree Programs', category: 'UNIVERSITY', description: 'University degree program management' },
    { code: 'UNI_RESEARCH_SYSTEMS', name: 'Research Systems', category: 'UNIVERSITY', description: 'University research management' },
    { code: 'UNI_SEMESTER_SYSTEM', name: 'Semester System', category: 'UNIVERSITY', description: 'University semester management' },
    { code: 'UNI_CREDIT_SYSTEM', name: 'Credit System', category: 'UNIVERSITY', description: 'University credit and unit system' },
    { code: 'UNI_GPA_CGPA', name: 'GPA/CGPA System', category: 'UNIVERSITY', description: 'University GPA and CGPA calculation' },
    { code: 'UNI_LECTURER_PORTAL', name: 'Lecturer Portal', category: 'UNIVERSITY', description: 'University lecturer portal' },
    { code: 'UNI_STUDENT_PORTAL', name: 'Student Portal', category: 'UNIVERSITY', description: 'University student portal' },
    { code: 'UNI_RESEARCH_SUPERVISION', name: 'Research Supervision', category: 'UNIVERSITY', description: 'University research supervision system' },
    { code: 'UNI_DEAN_DASHBOARD', name: 'Dean Dashboard', category: 'UNIVERSITY', description: 'University dean analytics dashboard' },
    { code: 'UNI_LECTURER_DASHBOARD', name: 'University Lecturer Dashboard', category: 'UNIVERSITY', description: 'University lecturer dashboard' },
    { code: 'UNI_STUDENT_DASHBOARD', name: 'University Student Dashboard', category: 'UNIVERSITY', description: 'University student dashboard' },
    { code: 'UNI_VC_DASHBOARD', name: 'Vice Chancellor Dashboard', category: 'UNIVERSITY', description: 'Vice Chancellor analytics dashboard' },
  ];

  for (const mod of modules) {
    await prisma.institutionModule.upsert({
      where: { code: mod.code },
      update: { name: mod.name, category: mod.category, description: mod.description },
      create: mod,
    });
  }

  // Institution Roles
  const institutionRolesData = [
    // Primary School Roles
    { code: 'PRIMARY_HEAD_TEACHER', name: 'Head Teacher', category: 'PRIMARY', description: 'Primary school head teacher' },
    { code: 'PRIMARY_DEPUTY_HEAD', name: 'Deputy Head', category: 'PRIMARY', description: 'Primary school deputy head' },
    { code: 'PRIMARY_TEACHER', name: 'Primary Teacher', category: 'PRIMARY', description: 'Primary school teacher' },
    { code: 'PRIMARY_PARENT', name: 'Parent', category: 'PRIMARY', description: 'Primary school parent/guardian' },
    { code: 'PRIMARY_LEARNER', name: 'Learner', category: 'PRIMARY', description: 'Primary school learner/student' },

    // Secondary School Roles
    { code: 'SECONDARY_DIRECTOR', name: 'Director', category: 'SECONDARY', description: 'Secondary school director' },
    { code: 'SECONDARY_DEPUTY_DIRECTOR', name: 'Deputy Director', category: 'SECONDARY', description: 'Secondary school deputy director' },
    { code: 'SECONDARY_HOD', name: 'HOD', category: 'SECONDARY', description: 'Secondary school head of department' },
    { code: 'SECONDARY_TEACHER', name: 'Teacher', category: 'SECONDARY', description: 'Secondary school teacher' },
    { code: 'SECONDARY_CLASS_TEACHER', name: 'Class Teacher', category: 'SECONDARY', description: 'Secondary school class teacher' },
    { code: 'SECONDARY_PARENT', name: 'Parent', category: 'SECONDARY', description: 'Secondary school parent/guardian' },
    { code: 'SECONDARY_STUDENT', name: 'Student', category: 'SECONDARY', description: 'Secondary school student' },

    // Advanced Secondary Roles (same structure as Secondary)
    { code: 'ADVANCED_DIRECTOR', name: 'Director', category: 'ADVANCED', description: 'Advanced secondary director' },
    { code: 'ADVANCED_DEPUTY_DIRECTOR', name: 'Deputy Director', category: 'ADVANCED', description: 'Advanced secondary deputy director' },
    { code: 'ADVANCED_HOD', name: 'HOD', category: 'ADVANCED', description: 'Advanced secondary head of department' },
    { code: 'ADVANCED_TEACHER', name: 'Teacher', category: 'ADVANCED', description: 'Advanced secondary teacher' },
    { code: 'ADVANCED_CLASS_TEACHER', name: 'Class Teacher', category: 'ADVANCED', description: 'Advanced secondary class teacher' },
    { code: 'ADVANCED_PARENT', name: 'Parent', category: 'ADVANCED', description: 'Advanced secondary parent/guardian' },
    { code: 'ADVANCED_STUDENT', name: 'Student', category: 'ADVANCED', description: 'Advanced secondary student' },

    // College Roles
    { code: 'COLLEGE_PRINCIPAL', name: 'Principal', category: 'COLLEGE', description: 'College principal' },
    { code: 'COLLEGE_REGISTRAR', name: 'Registrar', category: 'COLLEGE', description: 'College registrar' },
    { code: 'COLLEGE_LECTURER', name: 'Lecturer', category: 'COLLEGE', description: 'College lecturer' },
    { code: 'COLLEGE_STUDENT', name: 'Student', category: 'COLLEGE', description: 'College student' },

    // University Roles
    { code: 'UNI_VC', name: 'Vice Chancellor', category: 'UNIVERSITY', description: 'University vice chancellor' },
    { code: 'UNI_DEAN', name: 'Dean', category: 'UNIVERSITY', description: 'University dean' },
    { code: 'UNI_LECTURER', name: 'Lecturer', category: 'UNIVERSITY', description: 'University lecturer' },
    { code: 'UNI_RESEARCH_SUPERVISOR', name: 'Research Supervisor', category: 'UNIVERSITY', description: 'University research supervisor' },
    { code: 'UNI_STUDENT', name: 'Student', category: 'UNIVERSITY', description: 'University student' },
  ];

  for (const r of institutionRolesData) {
    await prisma.institutionRole.upsert({
      where: { code: r.code },
      update: { name: r.name, category: r.category, description: r.description },
      create: r,
    });
  }

  // Institution Features
  const features = [
    { code: 'AI_TUTOR', name: 'AI Tutor', category: 'AI', description: 'AI-powered tutoring assistance' },
    { code: 'AI_ANALYTICS', name: 'AI Analytics', category: 'AI', description: 'AI-powered analytics engine' },
    { code: 'AI_RESEARCH', name: 'AI Research Assistant', category: 'AI', description: 'AI research assistance' },
    { code: 'BLOCKCHAIN_VERIFICATION', name: 'Blockchain Verification', category: 'SECURITY', description: 'Blockchain-based certificate and result verification' },
    { code: 'DIGITAL_SIGNATURES', name: 'Digital Signatures', category: 'SECURITY', description: 'Digital signature capabilities' },
    { code: 'MULTI_LANGUAGE', name: 'Multi-Language Support', category: 'SYSTEM', description: 'Multi-language interface support' },
    { code: 'CUSTOM_BRANDING', name: 'Custom Branding', category: 'SYSTEM', description: 'Custom school branding and theming' },
    { code: 'SMS_NOTIFICATIONS', name: 'SMS Notifications', category: 'COMMUNICATION', description: 'SMS-based notifications' },
    { code: 'EMAIL_NOTIFICATIONS', name: 'Email Notifications', category: 'COMMUNICATION', description: 'Email-based notifications' },
    { code: 'WHATSAPP_NOTIFICATIONS', name: 'WhatsApp Notifications', category: 'COMMUNICATION', description: 'WhatsApp-based notifications' },
    { code: 'BULK_IMPORT', name: 'Bulk Import', category: 'ADMIN', description: 'Bulk data import capabilities' },
    { code: 'API_ACCESS', name: 'API Access', category: 'ADMIN', description: 'External API access' },
    { code: 'AUDIT_TRAIL', name: 'Audit Trail', category: 'SECURITY', description: 'Detailed audit trail logging' },
    { code: 'TEMPLATE_MARKETPLACE', name: 'Template Marketplace', category: 'REPORT', description: 'Report template marketplace access' },
    { code: 'PARENT_PORTAL', name: 'Parent Portal', category: 'PORTAL', description: 'Parent portal access' },
    { code: 'STUDENT_PORTAL', name: 'Student Portal', category: 'PORTAL', description: 'Student portal access' },
    { code: 'MOBILE_APP', name: 'Mobile App Access', category: 'MOBILE', description: 'Mobile application access' },
  ];

  for (const feature of features) {
    await prisma.institutionFeature.upsert({
      where: { code: feature.code },
      update: { name: feature.name, category: feature.category, description: feature.description },
      create: feature,
    });
  }

  // Institution Dashboards
  const dashboards = [
    // Primary School Dashboards
    { code: 'PRIMARY_HEAD_TEACHER_DASHBOARD', name: 'Head Teacher Dashboard', description: 'Primary head teacher overview dashboard' },
    { code: 'PRIMARY_DEPUTY_HEAD_DASHBOARD', name: 'Deputy Head Dashboard', description: 'Primary deputy head overview dashboard' },
    { code: 'PRIMARY_TEACHER_DASHBOARD', name: 'Primary Teacher Dashboard', description: 'Primary teacher class dashboard' },
    { code: 'PRIMARY_PARENT_DASHBOARD', name: 'Parent Dashboard', description: 'Primary parent/guardian dashboard' },
    { code: 'PRIMARY_LEARNER_DASHBOARD', name: 'Learner Dashboard', description: 'Primary learner dashboard' },

    // Secondary School Dashboards
    { code: 'SECONDARY_DIRECTOR_DASHBOARD', name: 'Director Dashboard', description: 'Secondary director overview dashboard' },
    { code: 'SECONDARY_DEPUTY_DIRECTOR_DASHBOARD', name: 'Deputy Director Dashboard', description: 'Secondary deputy director dashboard' },
    { code: 'SECONDARY_HOD_DASHBOARD', name: 'HOD Dashboard', description: 'Head of Department dashboard' },
    { code: 'SECONDARY_TEACHER_DASHBOARD', name: 'Secondary Teacher Dashboard', description: 'Secondary teacher class dashboard' },
    { code: 'SECONDARY_CLASS_TEACHER_DASHBOARD', name: 'Class Teacher Dashboard', description: 'Secondary class teacher dashboard' },
    { code: 'SECONDARY_PARENT_DASHBOARD', name: 'Secondary Parent Dashboard', description: 'Secondary parent dashboard' },
    { code: 'SECONDARY_STUDENT_DASHBOARD', name: 'Student Dashboard', description: 'Secondary student dashboard' },

    // Advanced Secondary Dashboards
    { code: 'ADVANCED_DIRECTOR_DASHBOARD', name: 'Director Dashboard', description: 'Advanced secondary director dashboard' },
    { code: 'ADVANCED_DEPUTY_DIRECTOR_DASHBOARD', name: 'Deputy Director Dashboard', description: 'Advanced secondary deputy director dashboard' },
    { code: 'ADVANCED_HOD_DASHBOARD', name: 'HOD Dashboard', description: 'Advanced secondary head of department dashboard' },
    { code: 'ADVANCED_TEACHER_DASHBOARD', name: 'Teacher Dashboard', description: 'Advanced secondary teacher dashboard' },
    { code: 'ADVANCED_CLASS_TEACHER_DASHBOARD', name: 'Class Teacher Dashboard', description: 'Advanced secondary class teacher dashboard' },
    { code: 'ADVANCED_PARENT_DASHBOARD', name: 'Parent Dashboard', description: 'Advanced secondary parent dashboard' },
    { code: 'ADVANCED_STUDENT_DASHBOARD', name: 'Student Dashboard', description: 'Advanced secondary student dashboard' },

    // College Dashboards
    { code: 'COLLEGE_PRINCIPAL_DASHBOARD', name: 'Principal Dashboard', description: 'College principal overview dashboard' },
    { code: 'COLLEGE_REGISTRAR_DASHBOARD', name: 'Registrar Dashboard', description: 'College registrar dashboard' },
    { code: 'COLLEGE_LECTURER_DASHBOARD', name: 'Lecturer Dashboard', description: 'College lecturer dashboard' },
    { code: 'COLLEGE_STUDENT_DASHBOARD', name: 'College Student Dashboard', description: 'College student dashboard' },

    // University Dashboards
    { code: 'UNI_VC_DASHBOARD', name: 'Vice Chancellor Dashboard', description: 'University vice chancellor overview dashboard' },
    { code: 'UNI_DEAN_DASHBOARD', name: 'Dean Dashboard', description: 'University dean dashboard' },
    { code: 'UNI_LECTURER_DASHBOARD', name: 'University Lecturer Dashboard', description: 'University lecturer dashboard' },
    { code: 'UNI_RESEARCH_SUPERVISOR_DASHBOARD', name: 'Research Supervisor Dashboard', description: 'University research supervisor dashboard' },
    { code: 'UNI_STUDENT_DASHBOARD', name: 'University Student Dashboard', description: 'University student dashboard' },
  ];

  for (const db of dashboards) {
    await prisma.institutionDashboard.upsert({
      where: { code: db.code },
      update: { name: db.name, description: db.description },
      create: db,
    });
  }

  // =============================================
  // PROVISION INSTITUTION TYPE MODULES
  // =============================================

  // All institution types get core modules
  const coreModuleCodes = [
    'CORE_ATTENDANCE', 'CORE_USER_MANAGEMENT', 'CORE_ROLE_MANAGEMENT',
    'CORE_SUBSCRIPTION', 'CORE_NOTIFICATIONS', 'CORE_AUDIT',
    'ACADEMIC_CLASSES', 'ACADEMIC_SUBJECTS', 'ACADEMIC_TIMETABLE',
    'ACADEMIC_ENROLLMENT', 'ACADEMIC_ACADEMIC_YEAR',
  ];

  const primaryModules = [
    ...coreModuleCodes,
    'PRIMARY_ATTENDANCE', 'PRIMARY_REPORT_CARDS', 'PRIMARY_ECZ_ANALYTICS',
    'PRIMARY_DASHBOARD_LOWER', 'PRIMARY_EXAMINATIONS', 'PRIMARY_GRADING',
    'PRIMARY_SUBJECT_COMBINATIONS', 'PRIMARY_TEACHER_DASHBOARD',
    'PRIMARY_PARENT_DASHBOARD', 'PRIMARY_LEARNER_DASHBOARD',
  ];

  const secondaryModules = [
    ...coreModuleCodes,
    'SECONDARY_ATTENDANCE', 'SECONDARY_ANALYTICS', 'SECONDARY_REPORT_CARDS',
    'SECONDARY_FORM_PROGRESSION', 'SECONDARY_GRADE12_ANALYTICS', 'SECONDARY_EXAMINATIONS',
    'SECONDARY_SUBJECT_COMBINATIONS', 'SECONDARY_CAREER_GUIDANCE',
    'SECONDARY_TEACHER_DASHBOARD', 'SECONDARY_HOD_DASHBOARD',
    'SECONDARY_PARENT_DASHBOARD', 'SECONDARY_STUDENT_DASHBOARD',
  ];

  const advancedModules = [
    ...coreModuleCodes,
    'ADVANCED_FORM5_6', 'ADVANCED_STEM_SPECIALIZATION', 'ADVANCED_ANALYTICS',
    'ADVANCED_UNI_PREPARATION', 'ADVANCED_SPECIALIZED_SUBJECTS', 'ADVANCED_RESEARCH_MODULES',
    'ADVANCED_TEACHER_DASHBOARD', 'ADVANCED_STUDENT_DASHBOARD',
    'ADVANCED_HOD_DASHBOARD', 'ADVANCED_DEPUTY_DIRECTOR_DASHBOARD',
  ];

  const collegeModules = [
    ...coreModuleCodes,
    'COLLEGE_DEPARTMENTS', 'COLLEGE_COURSES', 'COLLEGE_SEMESTERS',
    'COLLEGE_CREDITS', 'COLLEGE_GPA', 'COLLEGE_LECTURER_SYSTEM',
    'COLLEGE_COURSE_REGISTRATION', 'COLLEGE_ACADEMIC_TRANSCRIPTS',
    'COLLEGE_LECTURER_DASHBOARD', 'COLLEGE_STUDENT_DASHBOARD',
  ];

  const universityModules = [
    ...coreModuleCodes,
    'UNI_FACULTIES', 'UNI_SCHOOLS', 'UNI_DEGREE_PROGRAMS',
    'UNI_RESEARCH_SYSTEMS', 'UNI_SEMESTER_SYSTEM', 'UNI_CREDIT_SYSTEM',
    'UNI_GPA_CGPA', 'UNI_LECTURER_PORTAL', 'UNI_STUDENT_PORTAL',
    'UNI_RESEARCH_SUPERVISION', 'UNI_DEAN_DASHBOARD', 'UNI_LECTURER_DASHBOARD',
    'UNI_STUDENT_DASHBOARD', 'UNI_VC_DASHBOARD',
  ];

  const typeModuleMap: Record<string, string[]> = {
    PRIMARY_SCHOOL: primaryModules,
    SECONDARY_SCHOOL: secondaryModules,
    ADVANCED_SECONDARY: advancedModules,
    COLLEGE: collegeModules,
    UNIVERSITY: universityModules,
  };

  for (const [typeCode, moduleCodes] of Object.entries(typeModuleMap)) {
    const type = await prisma.institutionType.findUnique({ where: { code: typeCode as any } });
    if (!type) continue;

    for (let i = 0; i < moduleCodes.length; i++) {
      const mod = await prisma.institutionModule.findUnique({ where: { code: moduleCodes[i] } });
      if (!mod) continue;

      await prisma.institutionTypeModule.upsert({
        where: { institutionTypeId_moduleId: { institutionTypeId: type.id, moduleId: mod.id } },
        update: { sortOrder: i, isActive: true },
        create: { institutionTypeId: type.id, moduleId: mod.id, sortOrder: i, isActive: true },
      });
    }
  }

  // =============================================
  // PROVISION INSTITUTION TYPE FEATURES
  // =============================================

  const coreFeatureCodes = [
    'DIGITAL_SIGNATURES', 'AUDIT_TRAIL', 'EMAIL_NOTIFICATIONS',
    'PARENT_PORTAL', 'STUDENT_PORTAL', 'MOBILE_APP',
  ];

  const primaryFeatures = [...coreFeatureCodes, 'AI_TUTOR', 'SMS_NOTIFICATIONS'];
  const secondaryFeatures = [...coreFeatureCodes, 'AI_TUTOR', 'AI_ANALYTICS', 'SMS_NOTIFICATIONS', 'WHATSAPP_NOTIFICATIONS'];
  const advancedFeatures = [...coreFeatureCodes, 'AI_TUTOR', 'AI_ANALYTICS', 'SMS_NOTIFICATIONS', 'BULK_IMPORT'];
  const collegeFeatures = [...coreFeatureCodes, 'AI_ANALYTICS', 'BULK_IMPORT', 'API_ACCESS', 'TEMPLATE_MARKETPLACE'];
  const universityFeatures = [...coreFeatureCodes, 'AI_TUTOR', 'AI_ANALYTICS', 'AI_RESEARCH', 'BLOCKCHAIN_VERIFICATION', 'BULK_IMPORT', 'API_ACCESS', 'TEMPLATE_MARKETPLACE', 'CUSTOM_BRANDING'];

  const typeFeatureMap: Record<string, string[]> = {
    PRIMARY_SCHOOL: primaryFeatures,
    SECONDARY_SCHOOL: secondaryFeatures,
    ADVANCED_SECONDARY: advancedFeatures,
    COLLEGE: collegeFeatures,
    UNIVERSITY: universityFeatures,
  };

  for (const [typeCode, featureCodes] of Object.entries(typeFeatureMap)) {
    const type = await prisma.institutionType.findUnique({ where: { code: typeCode as any } });
    if (!type) continue;

    for (const featureCode of featureCodes) {
      const feature = await prisma.institutionFeature.findUnique({ where: { code: featureCode } });
      if (!feature) continue;

      await prisma.institutionTypeFeature.upsert({
        where: { institutionTypeId_featureId: { institutionTypeId: type.id, featureId: feature.id } },
        update: { isEnabled: true },
        create: { institutionTypeId: type.id, featureId: feature.id, isEnabled: true },
      });
    }
  }

  // =============================================
  // PROVISION INSTITUTION TYPE ROLES
  // =============================================

  const primaryRoleCodes = ['PRIMARY_HEAD_TEACHER', 'PRIMARY_DEPUTY_HEAD', 'PRIMARY_TEACHER', 'PRIMARY_PARENT', 'PRIMARY_LEARNER'];
  const secondaryRoleCodes = ['SECONDARY_DIRECTOR', 'SECONDARY_DEPUTY_DIRECTOR', 'SECONDARY_HOD', 'SECONDARY_TEACHER', 'SECONDARY_CLASS_TEACHER', 'SECONDARY_PARENT', 'SECONDARY_STUDENT'];
  const advancedRoleCodes = ['ADVANCED_DIRECTOR', 'ADVANCED_DEPUTY_DIRECTOR', 'ADVANCED_HOD', 'ADVANCED_TEACHER', 'ADVANCED_CLASS_TEACHER', 'ADVANCED_PARENT', 'ADVANCED_STUDENT'];
  const collegeRoleCodes = ['COLLEGE_PRINCIPAL', 'COLLEGE_REGISTRAR', 'COLLEGE_LECTURER', 'COLLEGE_STUDENT'];
  const universityRoleCodes = ['UNI_VC', 'UNI_DEAN', 'UNI_LECTURER', 'UNI_RESEARCH_SUPERVISOR', 'UNI_STUDENT'];

  const typeRoleMap: Record<string, string[]> = {
    PRIMARY_SCHOOL: primaryRoleCodes,
    SECONDARY_SCHOOL: secondaryRoleCodes,
    ADVANCED_SECONDARY: advancedRoleCodes,
    COLLEGE: collegeRoleCodes,
    UNIVERSITY: universityRoleCodes,
  };

  for (const [typeCode, roleCodes] of Object.entries(typeRoleMap)) {
    const type = await prisma.institutionType.findUnique({ where: { code: typeCode as any } });
    if (!type) continue;

    for (const roleCode of roleCodes) {
      const institutionRole = await prisma.institutionRole.findUnique({ where: { code: roleCode } });
      if (!institutionRole) continue;

      await prisma.institutionTypeRole.upsert({
        where: { institutionTypeId_roleId: { institutionTypeId: type.id, roleId: institutionRole.id } },
        update: { isActive: true },
        create: { institutionTypeId: type.id, roleId: institutionRole.id, isActive: true },
      });
    }
  }

  // =============================================
  // PROVISION INSTITUTION TYPE DASHBOARDS
  // =============================================

  const primaryDashboardCodes = ['PRIMARY_HEAD_TEACHER_DASHBOARD', 'PRIMARY_DEPUTY_HEAD_DASHBOARD', 'PRIMARY_TEACHER_DASHBOARD', 'PRIMARY_PARENT_DASHBOARD', 'PRIMARY_LEARNER_DASHBOARD'];
  const secondaryDashboardCodes = ['SECONDARY_DIRECTOR_DASHBOARD', 'SECONDARY_DEPUTY_DIRECTOR_DASHBOARD', 'SECONDARY_HOD_DASHBOARD', 'SECONDARY_TEACHER_DASHBOARD', 'SECONDARY_CLASS_TEACHER_DASHBOARD', 'SECONDARY_PARENT_DASHBOARD', 'SECONDARY_STUDENT_DASHBOARD'];
  const advancedDashboardCodes = ['ADVANCED_DIRECTOR_DASHBOARD', 'ADVANCED_DEPUTY_DIRECTOR_DASHBOARD', 'ADVANCED_HOD_DASHBOARD', 'ADVANCED_TEACHER_DASHBOARD', 'ADVANCED_CLASS_TEACHER_DASHBOARD', 'ADVANCED_PARENT_DASHBOARD', 'ADVANCED_STUDENT_DASHBOARD'];
  const collegeDashboardCodes = ['COLLEGE_PRINCIPAL_DASHBOARD', 'COLLEGE_REGISTRAR_DASHBOARD', 'COLLEGE_LECTURER_DASHBOARD', 'COLLEGE_STUDENT_DASHBOARD'];
  const universityDashboardCodes = ['UNI_VC_DASHBOARD', 'UNI_DEAN_DASHBOARD', 'UNI_LECTURER_DASHBOARD', 'UNI_RESEARCH_SUPERVISOR_DASHBOARD', 'UNI_STUDENT_DASHBOARD'];

  const typeDashboardMap: Record<string, string[]> = {
    PRIMARY_SCHOOL: primaryDashboardCodes,
    SECONDARY_SCHOOL: secondaryDashboardCodes,
    ADVANCED_SECONDARY: advancedDashboardCodes,
    COLLEGE: collegeDashboardCodes,
    UNIVERSITY: universityDashboardCodes,
  };

  for (const [typeCode, dashboardCodes] of Object.entries(typeDashboardMap)) {
    const type = await prisma.institutionType.findUnique({ where: { code: typeCode as any } });
    if (!type) continue;

    for (const dashboardCode of dashboardCodes) {
      const dashboard = await prisma.institutionDashboard.findUnique({ where: { code: dashboardCode } });
      if (!dashboard) continue;

      await prisma.institutionTypeDashboard.upsert({
        where: { institutionTypeId_dashboardId: { institutionTypeId: type.id, dashboardId: dashboard.id } },
        update: { isDefault: true },
        create: { institutionTypeId: type.id, dashboardId: dashboard.id, isDefault: true },
      });
    }
  }

  // =============================================
  // INSTITUTION SETTINGS
  // =============================================

  const institutionSettings: { typeCode: string; settings: { key: string; value: any; isRequired: boolean }[] }[] = [
    {
      typeCode: 'PRIMARY_SCHOOL',
      settings: [
        { key: 'grading_system', value: 'PRIMARY_ECZ', isRequired: true },
        { key: 'academic_structure', value: 'GRADE_BASED', isRequired: true },
        { key: 'terms_per_year', value: 3, isRequired: true },
        { key: 'min_attendance_percentage', value: 80, isRequired: true },
      ],
    },
    {
      typeCode: 'SECONDARY_SCHOOL',
      settings: [
        { key: 'grading_system', value: 'SECONDARY_ECZ', isRequired: true },
        { key: 'academic_structure', value: 'FORM_BASED', isRequired: true },
        { key: 'terms_per_year', value: 3, isRequired: true },
        { key: 'min_attendance_percentage', value: 80, isRequired: true },
      ],
    },
    {
      typeCode: 'ADVANCED_SECONDARY',
      settings: [
        { key: 'grading_system', value: 'ADVANCED_A_LEVEL', isRequired: true },
        { key: 'academic_structure', value: 'FORM_BASED', isRequired: true },
        { key: 'terms_per_year', value: 3, isRequired: true },
        { key: 'stem_pathway_enabled', value: true, isRequired: false },
      ],
    },
    {
      typeCode: 'COLLEGE',
      settings: [
        { key: 'grading_system', value: 'COLLEGE_GPA', isRequired: true },
        { key: 'academic_structure', value: 'SEMESTER_BASED', isRequired: true },
        { key: 'credit_system', value: true, isRequired: true },
        { key: 'max_credits_per_semester', value: 18, isRequired: false },
      ],
    },
    {
      typeCode: 'UNIVERSITY',
      settings: [
        { key: 'grading_system', value: 'UNIVERSITY_CGPA', isRequired: true },
        { key: 'academic_structure', value: 'SEMESTER_BASED', isRequired: true },
        { key: 'credit_system', value: true, isRequired: true },
        { key: 'research_system', value: true, isRequired: false },
        { key: 'max_credits_per_semester', value: 24, isRequired: false },
      ],
    },
  ];

  for (const { typeCode, settings } of institutionSettings) {
    const type = await prisma.institutionType.findUnique({ where: { code: typeCode as any } });
    if (!type) continue;

    for (const setting of settings) {
      await prisma.institutionSetting.upsert({
        where: { institutionTypeId_key: { institutionTypeId: type.id, key: setting.key } },
        update: { value: setting.value as any, isRequired: setting.isRequired },
        create: { institutionTypeId: type.id, key: setting.key, value: setting.value as any, isRequired: setting.isRequired },
      });
    }
  }

  // =============================================
  // SYSTEM SETTINGS
  // =============================================

  const systemSettings = [
    { key: 'messaging_sandbox_mode', value: 'true', isPublic: false },
    { key: 'beem_enabled', value: 'true', isPublic: false },
    { key: 'beem_sender_name', value: 'SmartTech', isPublic: false },
    { key: 'system_name', value: 'Smart Tech SaaS', isPublic: false },
    { key: 'session_timeout', value: '60', isPublic: false },
    { key: 'max_login_attempts', value: '5', isPublic: false },
    { key: 'password_min_length', value: '8', isPublic: false },
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, isPublic: setting.isPublic },
      create: { key: setting.key, value: setting.value, isPublic: setting.isPublic },
    });
  }

  // =============================================
  // SYSTEM COMMUNICATION PROVIDERS
  // =============================================

  const systemProviders = [
    {
      name: 'Zoho Mail',
      type: 'SMTP',
      channel: 'EMAIL',
      host: 'smtp.zoho.com',
      port: 587,
      username: 'noreply@smarttechsaas.com',
      password: 'your_zoho_app_password',
      senderEmail: 'noreply@smarttechsaas.com',
      senderName: 'Smart Tech',
      status: 'Connected',
      isDefault: true,
      config: { secure: false, requireTLS: true },
    },
    {
      name: 'SendGrid',
      type: 'API',
      channel: 'EMAIL',
      apiKey: 'your_sendgrid_api_key',
      senderEmail: 'noreply@smarttechsaas.com',
      senderName: 'Smart Tech',
      status: 'Connected',
      isDefault: false,
      config: { rateLimit: 100, monthlyLimit: 50000 },
    },
    {
      name: 'Beem Africa SMS',
      type: 'API',
      channel: 'SMS',
      apiKey: 'your_beem_api_key',
      apiSecret: 'your_beem_api_secret',
      senderName: 'SmartTech',
      status: 'Connected',
      isDefault: true,
      config: { twoWay: true, deliveryReports: true },
    },
    {
      name: 'Beem Africa WhatsApp',
      type: 'API',
      channel: 'WHATSAPP',
      apiKey: 'your_beem_api_key',
      apiSecret: 'your_beem_api_secret',
      senderName: 'SmartTech',
      status: 'Connected',
      isDefault: true,
      config: { templateBased: true, rateLimit: 250 },
    },
  ];

  for (const provider of systemProviders) {
    await prisma.systemProvider.upsert({
      where: { name_channel: { name: provider.name, channel: provider.channel } },
      update: provider,
      create: provider,
    });
  }

  console.log('Institution type engine seeded successfully!');
  console.log('System communication providers seeded successfully!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
