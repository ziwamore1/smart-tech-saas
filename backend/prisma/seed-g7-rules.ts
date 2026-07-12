import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ECZ Grade 7 conversion multipliers
// Source: ECZ Annual Report - each subject has a specific actual max and multiplier
// Only match primary-level subject names precisely to avoid matching secondary subjects
const G7_CONVERSION_RULES = [
  { nameSearch: ['english language', 'english'], actualMax: 60, standardizedMax: 150, multiplier: 2.5 },
  { nameSearch: ['mathematics', 'math'], actualMax: 60, standardizedMax: 150, multiplier: 2.5 },
  { nameSearch: ['integrated science'], actualMax: 50, standardizedMax: 150, multiplier: 3.0 },
  { nameSearch: ['social studies'], actualMax: 60, standardizedMax: 150, multiplier: 2.5 },
  { nameSearch: ['creative and technology studies', 'creative and performing arts', 'technology studies', 'cts'], actualMax: 60, standardizedMax: 150, multiplier: 2.5 },
  { nameSearch: ['zambian language', 'local language', 'zambian languages'], actualMax: 50, standardizedMax: 150, multiplier: 3.0 },
  { nameSearch: ['special paper 1', 'sp1'], actualMax: 50, standardizedMax: 150, multiplier: 3.0 },
  { nameSearch: ['special paper 2', 'sp2'], actualMax: 50, standardizedMax: 150, multiplier: 3.0 },
];

// ECZ Grade 7 division rules (based on best 4 subjects, max 600)
const G7_DIVISION_RULES = [
  { name: 'Division 1 - Distinction', code: 'G7_DIV1', division: 'Division 1', minScore: 460, maxScore: 600, label: 'Distinction', color: '#16a34a', sortOrder: 1 },
  { name: 'Division 2 - Merit', code: 'G7_DIV2', division: 'Division 2', minScore: 422, maxScore: 459, label: 'Merit', color: '#2563eb', sortOrder: 2 },
  { name: 'Division 3 - Credit', code: 'G7_DIV3', division: 'Division 3', minScore: 398, maxScore: 421, label: 'Credit', color: '#ca8a04', sortOrder: 3 },
  { name: 'Division 4 - Pass', code: 'G7_DIV4', division: 'Division 4', minScore: 0, maxScore: 397, label: 'Pass', color: '#ea580c', sortOrder: 4 },
];

// ECZ Grade 7 per-subject performance categories (standardized to 150)
const G7_PERFORMANCE_CATEGORIES = [
  { name: 'One', label: 'Excellent', minScore: 112, maxScore: 150, color: '#16a34a', sortOrder: 1 },
  { name: 'Two', label: 'Very Good', minScore: 90, maxScore: 111, color: '#2563eb', sortOrder: 2 },
  { name: 'Three', label: 'Good', minScore: 75, maxScore: 89, color: '#ca8a04', sortOrder: 3 },
  { name: 'Four', label: 'Satisfactory', minScore: 40, maxScore: 74, color: '#ea580c', sortOrder: 4 },
  { name: 'Five', label: 'Fail', minScore: 0, maxScore: 39, color: '#dc2626', sortOrder: 5 },
];

// Grading systems definitions (for seeding to all existing schools)
const PRIMARY_GRADING_SCALES = [
  { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5 },
  { minScore: 70, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4 },
  { minScore: 60, maxScore: 69, grade: 'C', remark: 'Good', points: 3 },
  { minScore: 50, maxScore: 59, grade: 'D', remark: 'Satisfactory', points: 2 },
  { minScore: 40, maxScore: 49, grade: 'E', remark: 'Fair', points: 1 },
  { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail', points: 0 },
];

const GRADE7_ECZ_SCALES = [
  { minScore: 75, maxScore: 100, grade: 'One', remark: 'Excellent', points: 1 },
  { minScore: 60, maxScore: 74, grade: 'Two', remark: 'Very Good', points: 2 },
  { minScore: 50, maxScore: 59, grade: 'Three', remark: 'Good', points: 3 },
  { minScore: 40, maxScore: 49, grade: 'Four', remark: 'Satisfactory', points: 4 },
  { minScore: 0, maxScore: 39, grade: 'Five', remark: 'Fail', points: 5 },
];

const SECONDARY_ECZ_SCALES = [
  { minScore: 75, maxScore: 100, grade: '1', remark: 'Distinction', points: 1 },
  { minScore: 70, maxScore: 74, grade: '2', remark: 'Distinction', points: 2 },
  { minScore: 65, maxScore: 69, grade: '3', remark: 'Merit', points: 3 },
  { minScore: 60, maxScore: 64, grade: '4', remark: 'Merit', points: 4 },
  { minScore: 55, maxScore: 59, grade: '5', remark: 'Credit', points: 5 },
  { minScore: 50, maxScore: 54, grade: '6', remark: 'Credit', points: 6 },
  { minScore: 45, maxScore: 49, grade: '7', remark: 'Satisfactory', points: 7 },
  { minScore: 40, maxScore: 44, grade: '8', remark: 'Satisfactory', points: 8 },
  { minScore: 0, maxScore: 39, grade: '9', remark: 'Unsatisfactory', points: 9 },
];

const FORMS_ECZ_SCALES = [
  { minScore: 70, maxScore: 100, grade: '1', remark: 'Outstanding', points: 1 },
  { minScore: 60, maxScore: 69, grade: '2', remark: 'Advanced', points: 2 },
  { minScore: 50, maxScore: 59, grade: '3', remark: 'Basic', points: 3 },
  { minScore: 40, maxScore: 49, grade: '4', remark: 'Satisfactory', points: 4 },
  { minScore: 0, maxScore: 39, grade: '5', remark: 'Unsatisfactory', points: 5 },
];

const COLLEGE_GPA_SCALES = [
  { minScore: 85, maxScore: 100, grade: 'A', remark: 'Distinction', points: 4 },
  { minScore: 70, maxScore: 84, grade: 'B', remark: 'Merit', points: 3 },
  { minScore: 55, maxScore: 69, grade: 'C', remark: 'Pass', points: 2 },
  { minScore: 40, maxScore: 54, grade: 'D', remark: 'Marginal Fail', points: 1 },
  { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail', points: 0 },
];

const UNIVERSITY_CGPA_SCALES = [
  { minScore: 90, maxScore: 100, grade: 'A+', remark: 'Exceptional', points: 4.5 },
  { minScore: 80, maxScore: 89, grade: 'A', remark: 'Excellent', points: 4 },
  { minScore: 75, maxScore: 79, grade: 'B+', remark: 'Very Good', points: 3.5 },
  { minScore: 70, maxScore: 74, grade: 'B', remark: 'Good', points: 3 },
  { minScore: 65, maxScore: 69, grade: 'C+', remark: 'Above Average', points: 2.5 },
  { minScore: 60, maxScore: 64, grade: 'C', remark: 'Average', points: 2 },
  { minScore: 55, maxScore: 59, grade: 'D+', remark: 'Below Average', points: 1.5 },
  { minScore: 50, maxScore: 54, grade: 'D', remark: 'Marginal', points: 1 },
  { minScore: 0, maxScore: 49, grade: 'F', remark: 'Fail', points: 0 },
];

// Aggregate composite performance categories (based on selection score, max 900)
// Used by computePerformanceCategory() which queries name: { startsWith: 'COMPOSITE_' }
const G7_COMPOSITE_CATEGORIES = [
  { name: 'COMPOSITE_One', label: 'Excellent', minScore: 672, maxScore: 900, color: '#16a34a', sortOrder: 1 },
  { name: 'COMPOSITE_Two', label: 'Very Good', minScore: 540, maxScore: 671, color: '#2563eb', sortOrder: 2 },
  { name: 'COMPOSITE_Three', label: 'Good', minScore: 450, maxScore: 539, color: '#ca8a04', sortOrder: 3 },
  { name: 'COMPOSITE_Four', label: 'Satisfactory', minScore: 240, maxScore: 449, color: '#ea580c', sortOrder: 4 },
  { name: 'COMPOSITE_Five', label: 'Fail', minScore: 0, maxScore: 239, color: '#dc2626', sortOrder: 5 },
];

async function findSubject(subjects: Array<{ id: string; name: string }>, searchTerms: string[]) {
  const lowerNames = subjects.map((s) => s.name.toLowerCase());
  for (const term of searchTerms) {
    const idx = lowerNames.findIndex((n) => n.includes(term));
    if (idx >= 0) return subjects[idx];
  }
  return null;
}

async function ensureGradingSystem(
  schoolId: string,
  name: string,
  scales: Array<{ grade: string; points: number; minScore: number; maxScore: number; remark: string }>,
  isDefault: boolean,
) {
  const existing = await prisma.gradingSystem.findFirst({
    where: { schoolId, name },
  });
  if (existing) return existing;

  const system = await prisma.gradingSystem.create({
    data: { name, schoolId, isDefault },
  });

  await prisma.gradeScale.createMany({
    data: scales.map(s => ({ gradingSystemId: system.id, ...s })),
  });

  console.log(`  [GRADING] Created "${name}"`);
  return system;
}

async function main() {
  console.log('Seeding ECZ Grade 7 Conversion Rules, Division Rules, and Performance Categories...\n');

  const schools = await prisma.school.findMany({
    select: { id: true, name: true, institutionTypeId: true },
  });
  if (schools.length === 0) {
    console.log('No schools found. Run the main seed first.');
    return;
  }

  // Get the PRIMARY_SCHOOL institution type
  const primaryType = await prisma.institutionType.findUnique({
    where: { code: 'PRIMARY_SCHOOL' },
  });
  if (!primaryType) {
    console.log('PRIMARY_SCHOOL institution type not found. Conversion rules will be applied to all schools.');
  }

  // Find the Grade 7 exam structure (shared across schools)
  const examStructure = await prisma.examStructure.findFirst({
    where: {
      academicStage: {
        code: { in: ['G7', 'GRADE_7', 'GRADE7'] },
      },
    },
  });

  if (examStructure) {
    console.log(`Found exam structure: "${examStructure.name}" (${examStructure.id})`);
  } else {
    console.log('No Grade 7 exam structure found. Conversion rules will be school-level only.');
  }

  // Find default curriculum version for primary/Grade 7
  const curriculumVersion = await prisma.curriculumVersion.findFirst({
    where: { isCurrent: true },
  });
  if (curriculumVersion) {
    console.log(`Using default curriculum version: "${curriculumVersion.name}" (${curriculumVersion.id})`);
  }

  for (const school of schools) {
    console.log(`\n--- School: ${school.name} ---`);

    // Step 1: Seed grading systems for ALL existing schools (not just new ones)
    await ensureGradingSystem(school.id, 'Primary Grading System', PRIMARY_GRADING_SCALES, false);
    await ensureGradingSystem(school.id, 'ECZ Grade 7 Grading System', GRADE7_ECZ_SCALES, false);
    await ensureGradingSystem(school.id, 'ECZ Secondary Grading System', SECONDARY_ECZ_SCALES, false);
    await ensureGradingSystem(school.id, 'ECZ Forms Grading System', FORMS_ECZ_SCALES, false);
    await ensureGradingSystem(school.id, 'College GPA Grading System', COLLEGE_GPA_SCALES, false);
    await ensureGradingSystem(school.id, 'University CGPA Grading System', UNIVERSITY_CGPA_SCALES, false);

    // Step 2: Fix SchoolSetting.gradingSystem per institution type
    const secondaryType = await prisma.institutionType.findUnique({ where: { code: 'SECONDARY_SCHOOL' } });
    const advancedType = await prisma.institutionType.findUnique({ where: { code: 'ADVANCED_SECONDARY' } });
    const collegeType = await prisma.institutionType.findUnique({ where: { code: 'COLLEGE' } });
    const universityType = await prisma.institutionType.findUnique({ where: { code: 'UNIVERSITY' } });

    const typeToGradingCode: Record<string, string> = {};
    if (primaryType) typeToGradingCode[primaryType.id] = 'PRIMARY_ECZ';
    if (secondaryType) typeToGradingCode[secondaryType.id] = 'SECONDARY_ECZ';
    if (advancedType) typeToGradingCode[advancedType.id] = 'ADVANCED_A_LEVEL';
    if (collegeType) typeToGradingCode[collegeType.id] = 'COLLEGE_GPA';
    if (universityType) typeToGradingCode[universityType.id] = 'UNIVERSITY_CGPA';

    const gradingCode = typeToGradingCode[school.institutionTypeId];
    if (gradingCode) {
      await prisma.schoolSetting.upsert({
        where: { schoolId: school.id },
        update: { gradingSystem: gradingCode },
        create: { schoolId: school.id, gradingSystem: gradingCode },
      });
      console.log(`  Set SchoolSetting.gradingSystem → ${gradingCode}`);
    }

    // Step 3: Only apply ECZ Grade 7 conversion/division rules to primary schools
    if (primaryType && school.institutionTypeId !== primaryType.id) {
      console.log('  SKIPPED conversion rules (not a primary school)');
      continue;
    }

    const subjects = await prisma.subject.findMany({
      where: { schoolId: school.id },
      select: { id: true, name: true },
    });

    if (subjects.length === 0) {
      console.log('  No subjects found, skipping.');
      continue;
    }

    console.log(`  Found ${subjects.length} subjects`);

    // Create conversion rules for each Grade 7 subject
    for (const ruleDef of G7_CONVERSION_RULES) {
      const subject = await findSubject(subjects, ruleDef.nameSearch);
      if (!subject) {
        console.log(`  [SKIP] No subject matched for: ${ruleDef.nameSearch[0]}`);
        continue;
      }

      const existing = await prisma.subjectConversionRule.findFirst({
        where: {
          subjectId: subject.id,
          schoolId: school.id,
          curriculumVersionId: curriculumVersion?.id || undefined,
        },
      });

      if (existing) {
        await prisma.subjectConversionRule.update({
          where: { id: existing.id },
          data: {
            actualMaxScore: ruleDef.actualMax,
            standardizedMax: ruleDef.standardizedMax,
            conversionMultiplier: ruleDef.multiplier,
            name: `ECZ Grade 7 - ${subject.name}`,
          },
        });
        console.log(`  [UPDATE] ${subject.name}: ×${ruleDef.multiplier} (${ruleDef.actualMax} → ${ruleDef.standardizedMax})`);
      } else {
        await prisma.subjectConversionRule.create({
          data: {
            name: `ECZ Grade 7 - ${subject.name}`,
            subjectId: subject.id,
            actualMaxScore: ruleDef.actualMax,
            standardizedMax: ruleDef.standardizedMax,
            conversionMultiplier: ruleDef.multiplier,
            curriculumVersionId: curriculumVersion?.id || undefined,
            schoolId: school.id,
            isActive: true,
          },
        });
        console.log(`  [CREATE] ${subject.name}: ×${ruleDef.multiplier} (${ruleDef.actualMax} → ${ruleDef.standardizedMax})`);
      }
    }

    // Create division rules (school-level, no exam structure dependency)
    for (const div of G7_DIVISION_RULES) {
      const existing = await prisma.divisionRule.findFirst({
        where: {
          code: div.code,
          schoolId: school.id,
          examStructureId: examStructure?.id || undefined,
        },
      });

      if (existing) {
        await prisma.divisionRule.update({
          where: { id: existing.id },
          data: {
            name: div.name,
            division: div.division,
            minScore: div.minScore,
            maxScore: div.maxScore,
            label: div.label,
            color: div.color,
            sortOrder: div.sortOrder,
          },
        });
      } else {
        await prisma.divisionRule.create({
          data: {
            name: div.name,
            code: div.code,
            division: div.division,
            minScore: div.minScore,
            maxScore: div.maxScore,
            label: div.label,
            color: div.color,
            sortOrder: div.sortOrder,
            schoolId: school.id,
            examStructureId: examStructure?.id || undefined,
            curriculumVersionId: curriculumVersion?.id || undefined,
            isActive: true,
          },
        });
      }
      console.log(`  [DIV] ${div.division} (${div.minScore}-${div.maxScore})`);
    }

    // Create performance categories
    for (const cat of G7_PERFORMANCE_CATEGORIES) {
      const existing = await prisma.performanceCategory.findFirst({
        where: {
          name: cat.name,
          schoolId: school.id,
          curriculumVersionId: curriculumVersion?.id || undefined,
        },
      });

      if (existing) {
        await prisma.performanceCategory.update({
          where: { id: existing.id },
          data: {
            label: cat.label,
            minScore: cat.minScore,
            maxScore: cat.maxScore,
            color: cat.color,
            sortOrder: cat.sortOrder,
          },
        });
      } else {
        await prisma.performanceCategory.create({
          data: {
            name: cat.name,
            label: cat.label,
            minScore: cat.minScore,
            maxScore: cat.maxScore,
            color: cat.color,
            sortOrder: cat.sortOrder,
            schoolId: school.id,
            curriculumVersionId: curriculumVersion?.id || undefined,
            isActive: true,
          },
        });
      }
      console.log(`  [CAT] ${cat.name} (${cat.minScore}-${cat.maxScore})`);
    }

    // Create composite performance categories (for aggregate scoring)
    for (const cat of G7_COMPOSITE_CATEGORIES) {
      const existing = await prisma.performanceCategory.findFirst({
        where: {
          name: cat.name,
          schoolId: school.id,
          curriculumVersionId: curriculumVersion?.id || undefined,
        },
      });

      if (existing) {
        await prisma.performanceCategory.update({
          where: { id: existing.id },
          data: {
            label: cat.label,
            minScore: cat.minScore,
            maxScore: cat.maxScore,
            color: cat.color,
            sortOrder: cat.sortOrder,
          },
        });
      } else {
        await prisma.performanceCategory.create({
          data: {
            name: cat.name,
            label: cat.label,
            minScore: cat.minScore,
            maxScore: cat.maxScore,
            color: cat.color,
            sortOrder: cat.sortOrder,
            schoolId: school.id,
            curriculumVersionId: curriculumVersion?.id || undefined,
            isActive: true,
          },
        });
      }
      console.log(`  [COMPOSITE] ${cat.name} (${cat.minScore}-${cat.maxScore})`);
    }

    // Step 4: Ensure ECZ Grade 7 Grading Policy exists (separate from GradingSystem)
    const existingG7Policy = await prisma.gradingPolicy.findFirst({
      where: { schoolId: school.id, code: 'ECZ_G7' },
    });

    if (!existingG7Policy) {
      await prisma.gradingPolicy.create({
        data: {
          schoolId: school.id,
          name: 'ECZ Grade 7 National Examination Grading',
          code: 'ECZ_G7',
          type: 'ECZ_ZAMBIA',
          isDefault: false,
          active: true,
          scales: {
            create: [
              { minScore: 75, maxScore: 100, grade: 'One', remark: 'Excellent', points: 1, gpa: 5.0, sortOrder: 1 },
              { minScore: 60, maxScore: 74, grade: 'Two', remark: 'Very Good', points: 2, gpa: 4.0, sortOrder: 2 },
              { minScore: 50, maxScore: 59, grade: 'Three', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
              { minScore: 40, maxScore: 49, grade: 'Four', remark: 'Satisfactory', points: 4, gpa: 2.0, sortOrder: 4 },
              { minScore: 0, maxScore: 39, grade: 'Five', remark: 'Fail', points: 5, gpa: 0, sortOrder: 5 },
            ],
          },
        },
      });
      console.log('  [POLICY] Created ECZ_G7 grading policy for Grade 7');
    } else {
      console.log('  [POLICY] ECZ_G7 already exists');
    }
  }

  console.log('\nECZ Grade 7 rules seeded successfully!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
