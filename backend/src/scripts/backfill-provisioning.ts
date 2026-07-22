import { PrismaClient } from '@prisma/client';
import { getCurriculumData } from '../common/curriculum-data';

const prisma = new PrismaClient();

interface BackfillResult {
  schoolId: string;
  schoolName: string;
  subjectsCreated: number;
  eocsCreated: number;
  aosCreated: number;
  gradingPoliciesCreated: number;
  assessmentDefsCreated: number;
  educationLevelsLinked: number;
  errors: string[];
}

async function backfillSchool(schoolId: string, institutionTypeCode: string): Promise<BackfillResult> {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const result: BackfillResult = {
    schoolId,
    schoolName: school?.name || 'Unknown',
    subjectsCreated: 0,
    eocsCreated: 0,
    aosCreated: 0,
    gradingPoliciesCreated: 0,
    assessmentDefsCreated: 0,
    educationLevelsLinked: 0,
    errors: [],
  };

  // 1. Backfill subjects, EoCs, and AOs
  const curriculum = getCurriculumData(institutionTypeCode);
  if (curriculum) {
    for (const subjectDef of curriculum.subjects) {
      let subject = await prisma.subject.findUnique({
        where: { name_schoolId: { name: subjectDef.name, schoolId } },
      });

      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            name: subjectDef.name,
            code: subjectDef.code,
            isCore: subjectDef.isCore,
            schoolId,
          },
        });
        result.subjectsCreated++;
        console.log(`  [${result.schoolName}] Created subject: ${subjectDef.name}`);
      }

      // Backfill missing EoCs
      const subjectEocs = curriculum.eocs[subjectDef.name] || [];
      for (const eoc of subjectEocs) {
        const existing = await prisma.elementOfConstruct.findFirst({
          where: { name: eoc.name, subjectId: subject.id },
        });
        if (!existing) {
          await prisma.elementOfConstruct.create({
            data: {
              name: eoc.name,
              construct: eoc.construct,
              subjectId: subject.id,
              schoolId,
            },
          });
          result.eocsCreated++;
        }
      }

      // Backfill missing AOs
      const subjectAos = curriculum.aos[subjectDef.name] || [];
      for (const ao of subjectAos) {
        const existing = await prisma.assessmentObjective.findFirst({
          where: { name: ao.name, subjectId: subject.id },
        });
        if (!existing) {
          await prisma.assessmentObjective.create({
            data: {
              name: ao.name,
              weight: ao.weight,
              subjectId: subject.id,
              schoolId,
            },
          });
          result.aosCreated++;
        }
      }
    }
  }

  // 2. Backfill grading policies
  const isPrimary = institutionTypeCode === 'PRIMARY_SCHOOL';
  const existingPolicies = await prisma.gradingPolicy.findMany({ where: { schoolId } });
  
  if (isPrimary && existingPolicies.length === 0) {
    // Create primary grading policies
    await prisma.$transaction(async (tx) => {
      const primaryScales = [
        { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5, gpa: 4.0, sortOrder: 1 },
        { minScore: 65, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, gpa: 3.5, sortOrder: 2 },
        { minScore: 50, maxScore: 64, grade: 'C', remark: 'Good', points: 3, gpa: 3.0, sortOrder: 3 },
        { minScore: 35, maxScore: 49, grade: 'D', remark: 'Pass', points: 2, gpa: 2.0, sortOrder: 4 },
        { minScore: 0, maxScore: 34, grade: 'F', remark: 'Fail', points: 1, gpa: 0, sortOrder: 5 },
      ];

      await tx.gradingPolicy.create({
        data: {
          schoolId,
          name: 'Primary School Default Grading',
          code: 'PRIMARY_DEFAULT',
          type: 'PERCENTAGE',
          isDefault: true,
          active: true,
          scales: { create: primaryScales },
        },
      });
      result.gradingPoliciesCreated++;
    });
  } else if (!isPrimary) {
    // Check if ECZ_ZM policy exists
    const eczZm = await prisma.gradingPolicy.findFirst({
      where: { schoolId, code: 'ECZ_ZM' },
    });

    if (!eczZm) {
      await prisma.$transaction(async (tx) => {
        await tx.gradingPolicy.create({
          data: {
            schoolId,
            name: 'ECZ Zambia Grading System',
            code: 'ECZ_ZM',
            type: 'ECZ_ZAMBIA',
            isDefault: true,
            active: true,
            scales: {
              create: [
                { minScore: 75, maxScore: 100, grade: '1', remark: 'Distinction', points: 1, gpa: 4.0, sortOrder: 1 },
                { minScore: 70, maxScore: 74, grade: '2', remark: 'Distinction', points: 2, gpa: 3.75, sortOrder: 2 },
                { minScore: 65, maxScore: 69, grade: '3', remark: 'Merit', points: 3, gpa: 3.5, sortOrder: 3 },
                { minScore: 60, maxScore: 64, grade: '4', remark: 'Merit', points: 4, gpa: 3.25, sortOrder: 4 },
                { minScore: 55, maxScore: 59, grade: '5', remark: 'Credit', points: 5, gpa: 3.0, sortOrder: 5 },
                { minScore: 50, maxScore: 54, grade: '6', remark: 'Credit', points: 6, gpa: 2.75, sortOrder: 6 },
                { minScore: 45, maxScore: 49, grade: '7', remark: 'Satisfactory', points: 7, gpa: 2.5, sortOrder: 7 },
                { minScore: 40, maxScore: 44, grade: '8', remark: 'Satisfactory', points: 8, gpa: 2.0, sortOrder: 8 },
                { minScore: 0, maxScore: 39, grade: '9', remark: 'Unsatisfactory', points: 9, gpa: 0, sortOrder: 9 },
              ],
            },
          },
        });
        result.gradingPoliciesCreated++;
      });
    }
  }

  // 3. Backfill assessment definitions
  const existingAssessment = await prisma.assessmentDefinition.findFirst({ where: { schoolId } });
  if (!existingAssessment) {
    const definitions = isPrimary
      ? [
          {
            name: 'Continuous Assessment',
            code: 'CONTINUOUS',
            category: 'continuous',
            description: 'Ongoing class assessments, quizzes, and assignments',
            defaultMaxScore: 100,
            defaultWeight: 70,
            contributesToFinal: true,
            sortOrder: 1,
          },
          {
            name: 'End of Term Examination',
            code: 'END_TERM',
            category: 'end_of_term',
            description: 'End of term summative examination',
            defaultMaxScore: 100,
            defaultWeight: 30,
            contributesToFinal: true,
            sortOrder: 2,
          },
        ]
      : [
          {
            name: 'Test 1',
            code: 'TEST_1',
            category: 'continuous',
            description: 'First continuous assessment test',
            defaultMaxScore: 50,
            defaultWeight: 15,
            contributesToFinal: true,
            sortOrder: 1,
          },
          {
            name: 'Test 2',
            code: 'TEST_2',
            category: 'continuous',
            description: 'Second continuous assessment test',
            defaultMaxScore: 50,
            defaultWeight: 15,
            contributesToFinal: true,
            sortOrder: 2,
          },
          {
            name: 'Mid-Term Examination',
            code: 'MID_TERM',
            category: 'midterm',
            description: 'Mid-term examination',
            defaultMaxScore: 100,
            defaultWeight: 20,
            contributesToFinal: true,
            sortOrder: 3,
          },
          {
            name: 'End of Term Examination',
            code: 'END_TERM',
            category: 'end_of_term',
            description: 'End of term summative examination',
            defaultMaxScore: 100,
            defaultWeight: 40,
            contributesToFinal: true,
            sortOrder: 4,
          },
          {
            name: 'Project Work',
            code: 'PROJECT',
            category: 'project',
            description: 'Term project or research work',
            defaultMaxScore: 100,
            defaultWeight: 10,
            contributesToFinal: true,
            sortOrder: 5,
          },
        ];

    await prisma.assessmentDefinition.createMany({
      data: definitions.map(d => ({ ...d, schoolId })),
    });
    result.assessmentDefsCreated = definitions.length;
  }

  // 4. Backfill education levels
  const levelMapping: Record<string, string[]> = {
    PRIMARY_SCHOOL: ['ECE', 'PRIMARY'],
    SECONDARY_SCHOOL: ['SECONDARY'],
    ADVANCED_SECONDARY: ['ADVANCED_SECONDARY'],
    COLLEGE: ['TERTIARY'],
    UNIVERSITY: ['TERTIARY'],
  };

  const levelCodes = levelMapping[institutionTypeCode] || [];
  if (levelCodes.length > 0) {
    const levels = await prisma.educationLevel.findMany({
      where: { code: { in: levelCodes as any }, schoolId: null },
    });

    for (const level of levels) {
      const existing = await prisma.schoolEducationLevel.findUnique({
        where: { schoolId_educationLevelId: { schoolId, educationLevelId: level.id } },
      });

      if (!existing) {
        await prisma.schoolEducationLevel.create({
          data: { schoolId, educationLevelId: level.id, isActive: true },
        });
        result.educationLevelsLinked++;
      }
    }
  }

  return result;
}

async function main() {
  console.log('=== School Provisioning Backfill ===\n');

  // Get all schools with their institution types
  const schools = await prisma.school.findMany({
    include: { institutionType: true },
  });

  console.log(`Found ${schools.length} schools to backfill\n`);

  let totalSubjects = 0;
  let totalEocs = 0;
  let totalAos = 0;
  let totalGrading = 0;
  let totalAssessment = 0;
  let totalLevels = 0;
  const errors: string[] = [];

  for (const school of schools) {
    const typeCode = school.institutionType?.code;
    if (!typeCode) {
      console.log(`⚠️  ${school.name}: No institution type, skipping`);
      continue;
    }

    console.log(`Processing ${school.name} (${typeCode})...`);

    try {
      const result = await backfillSchool(school.id, typeCode);
      totalSubjects += result.subjectsCreated;
      totalEocs += result.eocsCreated;
      totalAos += result.aosCreated;
      totalGrading += result.gradingPoliciesCreated;
      totalAssessment += result.assessmentDefsCreated;
      totalLevels += result.educationLevelsLinked;

      if (result.subjectsCreated > 0 || result.eocsCreated > 0 || result.aosCreated > 0 ||
          result.gradingPoliciesCreated > 0 || result.assessmentDefsCreated > 0 || result.educationLevelsLinked > 0) {
        console.log(`  ✅ Subjects: ${result.subjectsCreated}, EoCs: ${result.eocsCreated}, AOs: ${result.aosCreated}`);
      } else {
        console.log(`  ℹ️  Already fully provisioned`);
      }
    } catch (error) {
      const msg = `${school.name}: ${error instanceof Error ? error.message : error}`;
      errors.push(msg);
      console.log(`  ❌ Error: ${msg}`);
    }
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Total subjects created: ${totalSubjects}`);
  console.log(`Total EoCs created: ${totalEocs}`);
  console.log(`Total AOs created: ${totalAos}`);
  console.log(`Total grading policies created: ${totalGrading}`);
  console.log(`Total assessment definitions created: ${totalAssessment}`);
  console.log(`Total education levels linked: ${totalLevels}`);

  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
