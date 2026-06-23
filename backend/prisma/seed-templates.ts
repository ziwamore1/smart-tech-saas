import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding default templates...');

  const categories = [
    {
      name: 'Primary School Templates',
      slug: 'primary-school',
      description: 'Templates for primary school education (Grade 1-7)',
      icon: 'school',
      educationLevel: 'PRIMARY',
      sortOrder: 1,
    },
    {
      name: 'Secondary School Templates',
      slug: 'secondary-school',
      description: 'Templates for secondary school education (Form 1-4 / Grade 8-12)',
      icon: 'book-open',
      educationLevel: 'SECONDARY',
      sortOrder: 2,
    },
    {
      name: 'Advanced Secondary Templates',
      slug: 'advanced-secondary',
      description: 'Templates for advanced secondary education (Form 5-6)',
      icon: 'graduation-cap',
      educationLevel: 'ADVANCED_SECONDARY',
      sortOrder: 3,
    },
    {
      name: 'Certificates',
      slug: 'certificates',
      description: 'Certificate templates for various achievements',
      icon: 'award',
      educationLevel: 'ALL',
      sortOrder: 4,
    },
    {
      name: 'Transcripts',
      slug: 'transcripts',
      description: 'Official academic transcript templates',
      icon: 'scroll',
      educationLevel: 'ALL',
      sortOrder: 5,
    },
    {
      name: 'Assessment Reports',
      slug: 'assessment-reports',
      description: 'Continuous assessment and examination report templates',
      icon: 'clipboard-check',
      educationLevel: 'ALL',
      sortOrder: 6,
    },
  ];

  for (const cat of categories) {
    const existing = await prisma.templateCategory.findFirst({
      where: { slug: cat.slug, isSystem: true },
    });
    if (!existing) {
      await prisma.templateCategory.create({
        data: { ...cat, isSystem: true },
      });
      console.log(`  Created category: ${cat.name}`);
    } else {
      console.log(`  Category already exists: ${cat.name}`);
    }
  }

  const systemCategories = await prisma.templateCategory.findMany({
    where: { isSystem: true },
  });
  const catMap = Object.fromEntries(
    systemCategories.map((c) => [c.slug, c.id]),
  );

  const primaryReportComponents: any[] = [
    { type: 'HEADER', label: 'Report Header', content: { text: 'CONTINUOUS ASSESSMENT REPORT', fontSize: 16, color: '#1a365d' }, styles: { color: '#1a365d', textAlign: 'center' }, position: { x: 30, y: 20 }, size: { width: 535, height: 30 }, sortOrder: 0 },
    { type: 'DIVIDER', label: 'Divider', content: {}, styles: { color: '#1a365d' }, position: { x: 30, y: 55 }, size: { width: 535, height: 1 }, sortOrder: 1 },
    { type: 'SCHOOL_LOGO', label: 'School Logo', content: {}, styles: {}, position: { x: 30, y: 65 }, size: { width: 60, height: 60 }, sortOrder: 2 },
    { type: 'SCHOOL_NAME', label: 'School Name', content: { fontSize: 18, color: '#1a365d' }, styles: { color: '#1a365d', fontWeight: 'bold' }, position: { x: 100, y: 70 }, size: { width: 300, height: 22 }, sortOrder: 3 },
    { type: 'SCHOOL_INFO', label: 'School Info', content: { fontSize: 10, color: '#666' }, styles: { color: '#666' }, position: { x: 100, y: 95 }, size: { width: 300, height: 30 }, sortOrder: 4 },
    { type: 'STUDENT_PHOTO', label: 'Student Photo', content: {}, styles: { border: '1px solid #ccc' }, position: { x: 495, y: 65 }, size: { width: 70, height: 70 }, sortOrder: 5 },
    { type: 'STUDENT_INFO', label: 'Student Information', content: { fontSize: 11, color: '#333' }, styles: { color: '#333' }, position: { x: 30, y: 140 }, size: { width: 535, height: 45 }, sortOrder: 6 },
    { type: 'ATTENDANCE_TABLE', label: 'Attendance Record', content: { showPercentage: true, showDaysPresent: true, showDaysAbsent: true }, styles: { headerBg: '#1a365d', headerColor: '#fff' }, position: { x: 30, y: 195 }, size: { width: 535, height: 35 }, sortOrder: 7 },
    { type: 'SUBJECT_TABLE', label: 'Subject Performance', content: { showScore: true, showGrade: true, showRemark: true }, styles: { headerBg: '#1a365d', headerColor: '#fff' }, position: { x: 30, y: 240 }, size: { width: 535, height: 200 }, sortOrder: 8 },
    { type: 'PERFORMANCE_CHART', label: 'Performance Chart', content: { chartType: 'bar' }, styles: {}, position: { x: 30, y: 450 }, size: { width: 250, height: 150 }, sortOrder: 9 },
    { type: 'ANALYTICS_SUMMARY', label: 'Assessment Summary', content: { showAverage: true, showTotal: true }, styles: { bgColor: '#f8fafc' }, position: { x: 300, y: 450 }, size: { width: 265, height: 150 }, sortOrder: 10 },
    { type: 'TEACHER_REMARKS', label: 'Teacher Remarks', content: { fontSize: 11, color: '#555' }, styles: { color: '#555', bgColor: '#fefce8' }, position: { x: 30, y: 610 }, size: { width: 535, height: 40 }, sortOrder: 11 },
    { type: 'HEAD_TEACHER_REMARKS', label: 'Head Teacher Remarks', content: { fontSize: 11, color: '#555' }, styles: { color: '#555', bgColor: '#eff6ff' }, position: { x: 30, y: 660 }, size: { width: 535, height: 40 }, sortOrder: 12 },
    { type: 'PROMOTION_STATUS', label: 'Promotion Status', content: { fontSize: 12, color: '#1a365d' }, styles: { color: '#1a365d', fontWeight: 'bold' }, position: { x: 30, y: 710 }, size: { width: 535, height: 20 }, sortOrder: 13 },
    { type: 'DIVIDER', label: 'Divider', content: {}, styles: { color: '#ccc' }, position: { x: 30, y: 735 }, size: { width: 535, height: 1 }, sortOrder: 14 },
    { type: 'SIGNATURE', label: 'Signatures', content: { showTeacherSig: true, showHeadSig: true }, styles: {}, position: { x: 30, y: 745 }, size: { width: 535, height: 40 }, sortOrder: 15 },
    { type: 'QR_CODE', label: 'Verification QR', content: {}, styles: {}, position: { x: 500, y: 745 }, size: { width: 50, height: 50 }, sortOrder: 16 },
    { type: 'FOOTER', label: 'Footer', content: { text: 'This is a computer-generated report. All results are verified.' }, styles: { color: '#999', fontSize: 8 }, position: { x: 30, y: 800 }, size: { width: 535, height: 15 }, sortOrder: 17 },
  ];

  const secondaryReportComponents: any[] = [
    { type: 'HEADER', label: 'Report Header', content: { text: 'SECONDARY SCHOOL REPORT', fontSize: 16, color: '#1a365d' }, styles: { color: '#1a365d', textAlign: 'center' }, position: { x: 30, y: 20 }, size: { width: 535, height: 30 }, sortOrder: 0 },
    { type: 'DIVIDER', label: 'Divider', content: {}, styles: { borderTop: '1px solid #1a365d' }, position: { x: 30, y: 55 }, size: { width: 535, height: 1 }, sortOrder: 1 },
    { type: 'SCHOOL_LOGO', label: 'School Logo', content: {}, styles: {}, position: { x: 30, y: 65 }, size: { width: 60, height: 60 }, sortOrder: 2 },
    { type: 'SCHOOL_NAME', label: 'School Name', content: { fontSize: 18, color: '#1a365d' }, styles: { color: '#1a365d', fontWeight: 'bold' }, position: { x: 100, y: 70 }, size: { width: 300, height: 22 }, sortOrder: 3 },
    { type: 'SCHOOL_INFO', label: 'School Info', content: { fontSize: 10, color: '#666' }, styles: { color: '#666' }, position: { x: 100, y: 95 }, size: { width: 300, height: 30 }, sortOrder: 4 },
    { type: 'STUDENT_PHOTO', label: 'Student Photo', content: {}, styles: { border: '1px solid #ccc' }, position: { x: 495, y: 65 }, size: { width: 70, height: 70 }, sortOrder: 5 },
    { type: 'STUDENT_INFO', label: 'Student Information', content: { fontSize: 11, color: '#333' }, styles: { color: '#333' }, position: { x: 30, y: 140 }, size: { width: 535, height: 45 }, sortOrder: 6 },
    { type: 'ATTENDANCE_TABLE', label: 'Attendance', content: { showPercentage: true }, styles: { headerBg: '#1a365d', headerColor: '#fff' }, position: { x: 30, y: 195 }, size: { width: 535, height: 35 }, sortOrder: 7 },
    { type: 'RESULTS_TABLE', label: 'Subject Results', content: { showScore: true, showGrade: true, showPoints: true, showRemark: true }, styles: { headerBg: '#1a365d', headerColor: '#fff' }, position: { x: 30, y: 240 }, size: { width: 535, height: 220 }, sortOrder: 8 },
    { type: 'RANKING_TABLE', label: 'Class Ranking', content: { showPosition: true, showTotalStudents: true }, styles: { headerBg: '#047857', headerColor: '#fff' }, position: { x: 30, y: 470 }, size: { width: 535, height: 30 }, sortOrder: 9 },
    { type: 'PERFORMANCE_CHART', label: 'Performance Chart', content: { chartType: 'bar' }, styles: {}, position: { x: 30, y: 510 }, size: { width: 250, height: 130 }, sortOrder: 10 },
    { type: 'ANALYTICS_SUMMARY', label: 'Summary', content: { showAverage: true, showTotal: true, showGPA: true }, styles: { bgColor: '#f8fafc' }, position: { x: 300, y: 510 }, size: { width: 265, height: 130 }, sortOrder: 11 },
    { type: 'TEACHER_REMARKS', label: 'Class Teacher Remarks', content: { fontSize: 11, color: '#555' }, styles: { color: '#555', bgColor: '#fefce8' }, position: { x: 30, y: 650 }, size: { width: 535, height: 40 }, sortOrder: 12 },
    { type: 'HEAD_TEACHER_REMARKS', label: 'Head Teacher Remarks', content: { fontSize: 11, color: '#555' }, styles: { color: '#555', bgColor: '#eff6ff' }, position: { x: 30, y: 700 }, size: { width: 535, height: 40 }, sortOrder: 13 },
    { type: 'PROMOTION_STATUS', label: 'Promotion Status', content: { fontSize: 12, color: '#047857' }, styles: { color: '#047857', fontWeight: 'bold' }, position: { x: 30, y: 750 }, size: { width: 535, height: 20 }, sortOrder: 14 },
    { type: 'SIGNATURE', label: 'Signatures', content: { showTeacherSig: true, showHeadSig: true }, styles: {}, position: { x: 30, y: 775 }, size: { width: 400, height: 30 }, sortOrder: 15 },
    { type: 'QR_CODE', label: 'QR Code', content: {}, styles: {}, position: { x: 500, y: 770 }, size: { width: 50, height: 50 }, sortOrder: 16 },
    { type: 'FOOTER', label: 'Footer', content: { text: 'Smart Tech SaaS - Official School Report' }, styles: { color: '#999', fontSize: 8 }, position: { x: 30, y: 810 }, size: { width: 535, height: 15 }, sortOrder: 17 },
  ];

  const advancedComponents: any[] = secondaryReportComponents.map((c) => {
    if (c.type === 'HEADER') return { ...c, content: { ...c.content, text: 'ADVANCED SECONDARY SCHOOL REPORT' } };
    return c;
  });

  const certificateComponents: any[] = [
    { type: 'WATERMARK', label: 'Watermark', content: { text: 'CERTIFICATE', color: '#1a365d', fontSize: 60 }, styles: { color: '#1a365d', opacity: 0.04 }, position: { x: 50, y: 150 }, size: { width: 500, height: 200 }, sortOrder: 0 },
    { type: 'BORDER', label: 'Certificate Border', content: { style: 'classic', color: '#1a365d' }, styles: { border: '3px solid #1a365d' }, position: { x: 20, y: 20 }, size: { width: 560, height: 420 }, sortOrder: 1 },
    { type: 'SCHOOL_LOGO', label: 'School Logo', content: {}, styles: {}, position: { x: 270, y: 50 }, size: { width: 60, height: 60 }, sortOrder: 2 },
    { type: 'SCHOOL_NAME', label: 'School Name', content: { fontSize: 22, color: '#1a365d' }, styles: { color: '#1a365d', fontWeight: 'bold', textAlign: 'center' }, position: { x: 100, y: 120 }, size: { width: 400, height: 30 }, sortOrder: 3 },
    { type: 'DIVIDER', label: 'Divider', content: {}, styles: { color: '#1a365d' }, position: { x: 150, y: 155 }, size: { width: 300, height: 1 }, sortOrder: 4 },
    { type: 'AWARD_TEXT', label: 'Award Text', content: { text: 'This certificate is awarded to', fontSize: 14, color: '#666' }, styles: { color: '#666', textAlign: 'center' }, position: { x: 150, y: 175 }, size: { width: 300, height: 20 }, sortOrder: 5 },
    { type: 'STUDENT_NAME', label: 'Student Name', content: { fontSize: 32, color: '#1a365d' }, styles: { color: '#1a365d', fontWeight: 'bold', textAlign: 'center' }, position: { x: 100, y: 205 }, size: { width: 400, height: 40 }, sortOrder: 6 },
    { type: 'CUSTOM_TEXT', label: 'Details', content: { text: 'For outstanding academic performance', fontSize: 12, color: '#777' }, styles: { color: '#777', textAlign: 'center' }, position: { x: 150, y: 250 }, size: { width: 300, height: 15 }, sortOrder: 7 },
    { type: 'BADGE', label: 'Badge', content: {}, styles: { color: '#f59e0b' }, settings: { badgeStyle: 'star' }, position: { x: 275, y: 275 }, size: { width: 50, height: 50 }, sortOrder: 8 },
    { type: 'SIGNATURE', label: 'Signature 1', content: { label: 'Head Teacher' }, styles: {}, position: { x: 100, y: 370 }, size: { width: 150, height: 40 }, sortOrder: 9 },
    { type: 'SIGNATURE', label: 'Signature 2', content: { label: 'Director' }, styles: {}, position: { x: 350, y: 370 }, size: { width: 150, height: 40 }, sortOrder: 10 },
    { type: 'QR_CODE', label: 'QR Code', content: {}, styles: {}, position: { x: 520, y: 360 }, size: { width: 50, height: 50 }, sortOrder: 11 },
    { type: 'CUSTOM_TEXT', label: 'Certificate Number', content: { text: 'Certificate No: XXXXXX', fontSize: 9, color: '#aaa' }, styles: { color: '#aaa', textAlign: 'center' }, position: { x: 200, y: 420 }, size: { width: 200, height: 12 }, sortOrder: 12 },
  ];

  const transcriptComponents: any[] = [
    { type: 'HEADER', label: 'Transcript Header', content: { text: 'OFFICIAL ACADEMIC TRANSCRIPT', fontSize: 18, color: '#1a365d' }, styles: { color: '#1a365d', textAlign: 'center' }, position: { x: 30, y: 20 }, size: { width: 535, height: 25 }, sortOrder: 0 },
    { type: 'DIVIDER', label: 'Divider', content: {}, styles: { color: '#1a365d' }, position: { x: 30, y: 50 }, size: { width: 535, height: 2 }, sortOrder: 1 },
    { type: 'SCHOOL_LOGO', label: 'School Logo', content: {}, styles: {}, position: { x: 30, y: 60 }, size: { width: 60, height: 60 }, sortOrder: 2 },
    { type: 'SCHOOL_NAME', label: 'School Name', content: { fontSize: 16, color: '#1a365d' }, styles: { color: '#1a365d', fontWeight: 'bold' }, position: { x: 100, y: 65 }, size: { width: 300, height: 20 }, sortOrder: 3 },
    { type: 'STUDENT_INFO', label: 'Student Info', content: { fontSize: 11, color: '#333' }, styles: { color: '#333' }, position: { x: 30, y: 130 }, size: { width: 535, height: 60 }, sortOrder: 4 },
    { type: 'RESULTS_TABLE', label: 'Academic Record', content: { showGrade: true, showPoints: true, showGPA: true, showYear: true }, styles: { headerBg: '#1a365d', headerColor: '#fff' }, position: { x: 30, y: 200 }, size: { width: 535, height: 350 }, sortOrder: 5 },
    { type: 'ANALYTICS_SUMMARY', label: 'Summary', content: { showGPA: true, showTotalCredits: true }, styles: { bgColor: '#f8fafc' }, position: { x: 30, y: 560 }, size: { width: 535, height: 40 }, sortOrder: 6 },
    { type: 'DIVIDER', label: 'Divider', content: {}, styles: { color: '#ccc' }, position: { x: 30, y: 610 }, size: { width: 535, height: 1 }, sortOrder: 7 },
    { type: 'SIGNATURE', label: 'Signatures', content: { showRegistrarSig: true, showDirectorSig: true }, styles: {}, position: { x: 30, y: 625 }, size: { width: 535, height: 50 }, sortOrder: 8 },
    { type: 'STAMP', label: 'Official Stamp', content: {}, styles: {}, position: { x: 450, y: 620 }, size: { width: 60, height: 60 }, sortOrder: 9 },
    { type: 'QR_CODE', label: 'Verification QR', content: {}, styles: {}, position: { x: 520, y: 620 }, size: { width: 40, height: 40 }, sortOrder: 10 },
    { type: 'FOOTER', label: 'Footer', content: { text: 'This transcript is verified and digitally signed.' }, styles: { color: '#999', fontSize: 8, textAlign: 'center' }, position: { x: 30, y: 700 }, size: { width: 535, height: 15 }, sortOrder: 11 },
  ];

  const assessmentComponents: any[] = [
    { type: 'HEADER', label: 'Assessment Header', content: { text: 'ASSESSMENT REPORT', fontSize: 16, color: '#166534' }, styles: { color: '#166534', textAlign: 'center' }, position: { x: 30, y: 20 }, size: { width: 535, height: 30 }, sortOrder: 0 },
    { type: 'SCHOOL_LOGO', label: 'School Logo', content: {}, styles: {}, position: { x: 30, y: 60 }, size: { width: 60, height: 60 }, sortOrder: 1 },
    { type: 'SCHOOL_NAME', label: 'School Name', content: { fontSize: 18, color: '#166534' }, styles: { color: '#166534', fontWeight: 'bold' }, position: { x: 100, y: 65 }, size: { width: 300, height: 22 }, sortOrder: 2 },
    { type: 'STUDENT_INFO', label: 'Student Info', content: { fontSize: 11 }, styles: { color: '#333' }, position: { x: 30, y: 135 }, size: { width: 535, height: 45 }, sortOrder: 3 },
    { type: 'ATTENDANCE_TABLE', label: 'Attendance', content: { showPercentage: true }, styles: { headerBg: '#166534', headerColor: '#fff' }, position: { x: 30, y: 190 }, size: { width: 535, height: 35 }, sortOrder: 4 },
    { type: 'SUBJECT_TABLE', label: 'Assessment Breakdown', content: { showScore: true, showGrade: true, showRemark: true, showAssessmentType: true }, styles: { headerBg: '#166534', headerColor: '#fff' }, position: { x: 30, y: 235 }, size: { width: 535, height: 250 }, sortOrder: 5 },
    { type: 'PERFORMANCE_CHART', label: 'Assessment Chart', content: { chartType: 'bar' }, styles: {}, position: { x: 30, y: 495 }, size: { width: 250, height: 130 }, sortOrder: 6 },
    { type: 'COMPETENCY_HEATMAP', label: 'Competency Heatmap', content: {}, styles: {}, position: { x: 300, y: 495 }, size: { width: 265, height: 130 }, sortOrder: 7 },
    { type: 'TEACHER_REMARKS', label: 'Teacher Remarks', content: { fontSize: 11 }, styles: { color: '#555', bgColor: '#f0fdf4' }, position: { x: 30, y: 635 }, size: { width: 535, height: 50 }, sortOrder: 8 },
    { type: 'RECOMMENDATIONS', label: 'Recommendations', content: { fontSize: 11 }, styles: { color: '#555', bgColor: '#fffbeb' }, position: { x: 30, y: 695 }, size: { width: 535, height: 50 }, sortOrder: 9 },
    { type: 'PROMOTION_STATUS', label: 'Overall Status', content: { fontSize: 12, color: '#166534' }, styles: { color: '#166534', fontWeight: 'bold' }, position: { x: 30, y: 755 }, size: { width: 535, height: 20 }, sortOrder: 10 },
    { type: 'SIGNATURE', label: 'Signatures', content: {}, styles: {}, position: { x: 30, y: 780 }, size: { width: 400, height: 30 }, sortOrder: 11 },
    { type: 'QR_CODE', label: 'QR Code', content: {}, styles: {}, position: { x: 500, y: 775 }, size: { width: 50, height: 50 }, sortOrder: 12 },
  ];

  interface TemplateDef {
    name: string;
    slug: string;
    templateType: string;
    categorySlug: string;
    description: string;
    primaryColor: string;
    secondaryColor: string;
    components: any[];
    certificate?: any;
  }

  const templates: TemplateDef[] = [
    // PRIMARY SCHOOL
    { name: 'Grade 1-6 Continuous Assessment Report', slug: 'grade-1-6-cas', templateType: 'REPORT_CARD', categorySlug: 'primary-school', description: 'Continuous assessment report template for Grade 1 to 6 learners with subject performance, attendance, and teacher remarks.', primaryColor: '#1a365d', secondaryColor: '#e2e8f0', components: primaryReportComponents },
    { name: 'Grade 7 ECZ Report', slug: 'grade-7-ecz', templateType: 'REPORT_CARD', categorySlug: 'primary-school', description: 'ECZ examination report template for Grade 7 candidates with examination scores, division classification, and selection status.', primaryColor: '#991b1b', secondaryColor: '#fef2f2', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'GRADE 7 ECZ EXAMINATION REPORT' } } : c) },
    { name: 'Grade 7 Selection Report', slug: 'grade-7-selection', templateType: 'REPORT_CARD', categorySlug: 'primary-school', description: 'Grade 7 school selection report with placement information, selected school details, and performance summary.', primaryColor: '#0f766e', secondaryColor: '#f0fdfa', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'GRADE 7 SELECTION REPORT' } } : c) },
    { name: 'Grade 7 Mock Examination Report', slug: 'grade-7-mock', templateType: 'REPORT_CARD', categorySlug: 'primary-school', description: 'Pre-ECZ mock examination report template to help Grade 7 learners prepare for national exams.', primaryColor: '#7c3aed', secondaryColor: '#f5f3ff', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'GRADE 7 MOCK EXAMINATION REPORT' } } : c) },

    // SECONDARY SCHOOL
    { name: 'Form 1 Report', slug: 'form-1-report', templateType: 'REPORT_CARD', categorySlug: 'secondary-school', description: 'Comprehensive Form 1 termly report with subject grades, class ranking, and teacher feedback.', primaryColor: '#0369a1', secondaryColor: '#f0f9ff', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'FORM 1 REPORT' } } : c) },
    { name: 'Form 2 Report', slug: 'form-2-report', templateType: 'REPORT_CARD', categorySlug: 'secondary-school', description: 'Form 2 academic report tracking student progress across all subjects with GPA calculation.', primaryColor: '#0891b2', secondaryColor: '#ecfeff', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'FORM 2 REPORT' } } : c) },
    { name: 'Grade 10 Report', slug: 'grade-10-report', templateType: 'REPORT_CARD', categorySlug: 'secondary-school', description: 'Grade 10 academic report with subject performance, credits tracking, and career guidance notes.', primaryColor: '#0d9488', secondaryColor: '#f0fdfa', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'GRADE 10 REPORT' } } : c) },
    { name: 'Grade 11 Report', slug: 'grade-11-report', templateType: 'REPORT_CARD', categorySlug: 'secondary-school', description: 'Grade 11 report with subject specialization tracking, university eligibility indicators, and academic counseling notes.', primaryColor: '#4f46e5', secondaryColor: '#eef2ff', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'GRADE 11 REPORT' } } : c) },
    { name: 'Grade 12 Report', slug: 'grade-12-report', templateType: 'REPORT_CARD', categorySlug: 'secondary-school', description: 'Grade 12 final report with full academic transcript, university entrance eligibility, and graduation status.', primaryColor: '#b91c1c', secondaryColor: '#fef2f2', components: secondaryReportComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'GRADE 12 REPORT' } } : c) },

    // ADVANCED SECONDARY
    { name: 'Form 5 Report', slug: 'form-5-report', templateType: 'REPORT_CARD', categorySlug: 'advanced-secondary', description: 'Advanced secondary Form 5 report with A-Level subject tracking, GPA calculation, and university preparation.', primaryColor: '#7e22ce', secondaryColor: '#faf5ff', components: advancedComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'FORM 5 REPORT - ADVANCED SECONDARY' } } : c) },
    { name: 'Form 6 Report', slug: 'form-6-report', templateType: 'REPORT_CARD', categorySlug: 'advanced-secondary', description: 'Form 6 final report with complete A-Level results, university placement recommendations, and graduation summary.', primaryColor: '#4338ca', secondaryColor: '#eef2ff', components: advancedComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'FORM 6 REPORT - ADVANCED SECONDARY' } } : c) },

    // CERTIFICATES
    { name: 'Academic Excellence Certificate', slug: 'academic-excellence-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Award certificate for outstanding academic performance with gold accents and honor seal.', primaryColor: '#b45309', secondaryColor: '#fffbeb', components: certificateComponents, certificate: { certificateType: 'ACADEMIC_EXCELLENCE', borderStyle: 'gold', borderColor: '#b45309', showQrCode: true, autoNumbering: true, badgeStyle: 'star', awardText: 'This certificate is awarded to', signature1Label: 'Head Teacher', signature2Label: 'Director of Studies' } },
    { name: 'Graduation Certificate', slug: 'graduation-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Official graduation certificate commemorating completion of studies with academic regalia design.', primaryColor: '#1a365d', secondaryColor: '#f8fafc', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'This certifies that' } } : c), certificate: { certificateType: 'GRADUATION', borderStyle: 'classic', borderColor: '#1a365d', showQrCode: true, autoNumbering: true, badgeStyle: 'graduation_cap', awardText: 'This certifies that', signature1Label: 'Principal', signature2Label: 'School Director' } },
    { name: 'Sports Certificate', slug: 'sports-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Sports achievement certificate for excellence in athletics, team sports, and physical education.', primaryColor: '#059669', secondaryColor: '#f0fdf4', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'This certificate is proudly presented to' } } : c), certificate: { certificateType: 'SPORTS_AWARD', borderStyle: 'modern', borderColor: '#059669', showQrCode: true, autoNumbering: true, badgeStyle: 'trophy', awardText: 'This certificate is proudly presented to', signature1Label: 'Sports Director', signature2Label: 'Head Teacher' } },
    { name: 'Attendance Certificate', slug: 'attendance-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Perfect attendance certificate recognizing students with outstanding attendance records.', primaryColor: '#0d9488', secondaryColor: '#f0fdfa', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'Awarded for Perfect Attendance to' } } : c), certificate: { certificateType: 'ATTENDANCE', borderStyle: 'minimal', borderColor: '#0d9488', showQrCode: true, autoNumbering: true, badgeStyle: 'circle', awardText: 'Awarded for Perfect Attendance to', signature1Label: 'Class Teacher', signature2Label: 'Head Teacher' } },
    { name: 'Staff Recognition Certificate', slug: 'staff-recognition-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Staff recognition certificate for outstanding service, dedication, and contribution to the school community.', primaryColor: '#6d28d9', secondaryColor: '#f5f3ff', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'In Recognition of Outstanding Service to' } } : c), certificate: { certificateType: 'MERIT_AWARD', borderStyle: 'elegant', borderColor: '#6d28d9', showQrCode: true, autoNumbering: true, badgeStyle: 'medal', awardText: 'In Recognition of Outstanding Service to', signature1Label: 'School Director', signature2Label: 'Board Chairperson' } },
    { name: 'Teacher Recognition Certificate', slug: 'teacher-recognition-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Teacher excellence certificate honoring exceptional teaching, mentorship, and educational leadership.', primaryColor: '#2563eb', secondaryColor: '#eff6ff', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'Awarded for Excellence in Teaching to' } } : c), certificate: { certificateType: 'MERIT_AWARD', borderStyle: 'modern', borderColor: '#2563eb', showQrCode: true, autoNumbering: true, badgeStyle: 'star', awardText: 'Awarded for Excellence in Teaching to', signature1Label: 'School Director', signature2Label: 'Deputy Director' } },
    { name: "Dean's List Certificate", slug: 'deans-list-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Certificate recognizing students who achieved Dean\'s List honors with outstanding academic performance across all subjects.', primaryColor: '#6d28d9', secondaryColor: '#f5f3ff', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'For Dean\'s List Academic Honors awarded to' } } : c), certificate: { certificateType: 'ACADEMIC_EXCELLENCE', borderStyle: 'academic', borderColor: '#6d28d9', showQrCode: true, autoNumbering: true, badgeStyle: 'laurel', awardText: "For Dean's List Academic Honors awarded to", signature1Label: 'Dean of Academics', signature2Label: 'Principal' } },
    { name: 'Honor Roll Certificate', slug: 'honor-roll-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Certificate for students who qualified for the Honor Roll with consistently high academic achievement.', primaryColor: '#b45309', secondaryColor: '#fffbeb', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'For Honor Roll Distinction awarded to' } } : c), certificate: { certificateType: 'ACADEMIC_EXCELLENCE', borderStyle: 'ornate', borderColor: '#b45309', showQrCode: true, autoNumbering: true, badgeStyle: 'star', awardText: 'For Honor Roll Distinction awarded to', signature1Label: 'Head Teacher', signature2Label: 'Director of Studies' } },
    { name: 'Service Award Certificate', slug: 'service-award-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Certificate honoring students who demonstrated exceptional community service and volunteer contributions.', primaryColor: '#0d9488', secondaryColor: '#f0fdfa', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'For Outstanding Community Service awarded to' } } : c), certificate: { certificateType: 'MERIT_AWARD', borderStyle: 'victorian', borderColor: '#0d9488', showQrCode: true, autoNumbering: true, badgeStyle: 'medal', awardText: 'For Outstanding Community Service awarded to', signature1Label: 'Community Service Coordinator', signature2Label: 'Principal' } },
    { name: 'Perfect Attendance Certificate', slug: 'perfect-attendance-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Certificate recognizing students with perfect attendance and punctuality throughout the academic term.', primaryColor: '#0369a1', secondaryColor: '#f0f9ff', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'For Perfect Attendance awarded to' } } : c), certificate: { certificateType: 'ATTENDANCE', borderStyle: 'modern', borderColor: '#0369a1', showQrCode: true, autoNumbering: true, badgeStyle: 'circle', awardText: 'For Perfect Attendance awarded to', signature1Label: 'Class Teacher', signature2Label: 'Head Teacher' } },
    { name: 'Leadership Award Certificate', slug: 'leadership-award-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'Certificate recognizing students who demonstrated exceptional leadership skills and positive influence in the school community.', primaryColor: '#7c3aed', secondaryColor: '#f5f3ff', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: 'For Exemplary Leadership awarded to' } } : c), certificate: { certificateType: 'MERIT_AWARD', borderStyle: 'modern', borderColor: '#7c3aed', showQrCode: true, autoNumbering: true, badgeStyle: 'shield', awardText: 'For Exemplary Leadership awarded to', signature1Label: 'Student Affairs Director', signature2Label: 'Principal' } },
    { name: "Principal's Award Certificate", slug: 'principals-award-cert', templateType: 'CERTIFICATE', categorySlug: 'certificates', description: 'The Principal\'s highest recognition for overall excellence in academics, character, and school contributions.', primaryColor: '#991b1b', secondaryColor: '#fef2f2', components: certificateComponents.map(c => c.type === 'AWARD_TEXT' ? { ...c, content: { ...c.content, text: "The Principal's Award for Overall Excellence presented to" } } : c), certificate: { certificateType: 'ACADEMIC_EXCELLENCE', borderStyle: 'gold', borderColor: '#991b1b', showQrCode: true, autoNumbering: true, badgeStyle: 'trophy', awardText: "The Principal's Award for Overall Excellence presented to", signature1Label: 'Principal', signature2Label: 'Board Chairperson' } },

    // TRANSCRIPTS
    { name: 'Official Academic Transcript', slug: 'official-transcript', templateType: 'TRANSCRIPT', categorySlug: 'transcripts', description: 'Official academic transcript with complete grade history, GPA, and institution verification.', primaryColor: '#1e3a5f', secondaryColor: '#f8fafc', components: transcriptComponents },
    { name: 'Abridged Transcript', slug: 'abridged-transcript', templateType: 'TRANSCRIPT', categorySlug: 'transcripts', description: 'Concise academic transcript for quick reference with current year performance summary.', primaryColor: '#0f766e', secondaryColor: '#f0fdfa', components: transcriptComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'ABRIDGED ACADEMIC TRANSCRIPT', fontSize: 16 } } : c) },

    // ASSESSMENT REPORTS
    { name: 'Continuous Assessment Report', slug: 'continuous-assessment', templateType: 'PROGRESS_REPORT', categorySlug: 'assessment-reports', description: 'Comprehensive continuous assessment report with ongoing performance tracking and learning competency evaluation.', primaryColor: '#166534', secondaryColor: '#f0fdf4', components: assessmentComponents },
    { name: 'Term Assessment Summary', slug: 'term-assessment-summary', templateType: 'PROGRESS_REPORT', categorySlug: 'assessment-reports', description: 'Term-end assessment summary with consolidated subject scores, grade analysis, and learning outcomes.', primaryColor: '#6b21a8', secondaryColor: '#faf5ff', components: assessmentComponents.map(c => c.type === 'HEADER' ? { ...c, content: { ...c.content, text: 'TERM ASSESSMENT SUMMARY' } } : c) },
  ];

  for (const tpl of templates) {
    const catId = catMap[tpl.categorySlug];
    if (!catId) {
      console.warn(`  Category not found: ${tpl.categorySlug}, skipping template: ${tpl.name}`);
      continue;
    }

    const existing = await prisma.reportTemplate.findFirst({
      where: { name: tpl.name, isDefault: true },
    });

    if (existing) {
      console.log(`  Template already exists: ${tpl.name}`);
      continue;
    }

    const template = await prisma.reportTemplate.create({
      data: {
        name: tpl.name,
        isDefault: true,
        description: tpl.description,
        templateType: tpl.templateType as any,
        categoryId: catId,
        pageSize: 'A4',
        orientation: tpl.templateType === 'CERTIFICATE' ? 'landscape' : 'portrait',
        fontFamily: 'Arial',
        fontSize: 11,
        primaryColor: tpl.primaryColor,
        secondaryColor: tpl.secondaryColor,
        status: 'PUBLISHED' as any,
        version: 1,
        includeLogo: true,
        includeStamp: tpl.templateType === 'CERTIFICATE' || tpl.templateType === 'TRANSCRIPT',
        includeSignature: true,
        includeBestSix: tpl.templateType === 'REPORT_CARD' || tpl.templateType === 'TRANSCRIPT',
        includeRankings: tpl.templateType === 'REPORT_CARD',
        includeComments: true,
        includeGrading: true,
        remarksEnabled: true,
        marginTop: 15,
        marginBottom: 15,
        marginLeft: 15,
        marginRight: 15,
        metadata: { source: 'system-seed', educationLevel: tpl.categorySlug },
      },
    });

    for (const comp of tpl.components) {
      await prisma.templateComponent.create({
        data: {
          templateId: template.id,
          type: comp.type as any,
          label: comp.label,
          content: comp.content as any,
          styles: comp.styles as any,
          position: comp.position as any,
          size: comp.size as any,
          settings: (comp.settings || {}) as any,
          sortOrder: comp.sortOrder,
        },
      });
    }

    if (tpl.certificate) {
      await prisma.certificateTemplate.create({
        data: {
          templateId: template.id,
          certificateType: tpl.certificate.certificateType as any,
          borderStyle: tpl.certificate.borderStyle,
          borderColor: tpl.certificate.borderColor,
          showQrCode: tpl.certificate.showQrCode ?? true,
          autoNumbering: tpl.certificate.autoNumbering ?? true,
          nextNumber: 1,
          showPhoto: true,
          signature1Label: tpl.certificate.signature1Label,
          signature2Label: tpl.certificate.signature2Label,
          awardText: tpl.certificate.awardText,
          showBadge: true,
          badgeStyle: tpl.certificate.badgeStyle || 'star',
          showWatermark: false,
        },
      });
    }

    console.log(`  Created template: ${tpl.name}`);
  }

  console.log('\nDefault template seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
