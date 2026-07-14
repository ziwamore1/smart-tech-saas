/**
 * Fix existing classes that don't have a gradingSystemId assigned.
 * 
 * For each school:
 * 1. Find the SchoolSetting.gradingSystem code
 * 2. Map it to the corresponding GradingSystem name
 * 3. Find the GradingSystem record for that school
 * 4. Assign it to all classes that have no gradingSystemId
 * 
 * Run: npx ts-node src/scripts/fix-class-grading-systems.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const codeToName: Record<string, string> = {
  PRIMARY_ECZ: 'Primary Grading System',
  GRADE7_ECZ: 'ECZ Grade 7 Grading System',
  SECONDARY_ECZ: 'ECZ Secondary Grading System',
  ADVANCED_A_LEVEL: 'ECZ Secondary Grading System',
  FORMS_ECZ: 'ECZ Forms Grading System',
  COLLEGE_GPA: 'College GPA Grading System',
  UNIVERSITY_CGPA: 'University CGPA Grading System',
};

async function main() {
  console.log('=== Fixing classes without gradingSystemId ===\n');

  const schools = await prisma.school.findMany({
    select: { id: true, name: true },
  });

  let totalFixed = 0;

  for (const school of schools) {
    // Find classes without gradingSystemId
    const classesWithoutGS = await prisma.class.findMany({
      where: {
        schoolId: school.id,
        gradingSystemId: null,
      },
      select: { id: true, name: true },
    });

    if (classesWithoutGS.length === 0) {
      continue;
    }

    // Find the school's preferred grading system
    const schoolSetting = await prisma.schoolSetting.findUnique({
      where: { schoolId: school.id },
    });

    const preferredName = schoolSetting?.gradingSystem
      ? codeToName[schoolSetting.gradingSystem]
      : null;

    let gradingSystem = null;

    // Try to find by preferred name
    if (preferredName) {
      gradingSystem = await prisma.gradingSystem.findFirst({
        where: { schoolId: school.id, name: preferredName },
      });
    }

    // Fall back to isDefault
    if (!gradingSystem) {
      gradingSystem = await prisma.gradingSystem.findFirst({
        where: { schoolId: school.id, isDefault: true },
      });
    }

    // Fall back to any grading system for the school
    if (!gradingSystem) {
      gradingSystem = await prisma.gradingSystem.findFirst({
        where: { schoolId: school.id },
      });
    }

    if (!gradingSystem) {
      console.log(`  [SKIP] ${school.name}: No grading system found`);
      continue;
    }

    // Assign to all classes without gradingSystemId
    const result = await prisma.class.updateMany({
      where: {
        schoolId: school.id,
        gradingSystemId: null,
      },
      data: {
        gradingSystemId: gradingSystem.id,
      },
    });

    console.log(
      `  [FIXED] ${school.name}: ${result.count} class(es) assigned to "${gradingSystem.name}"`,
    );
    totalFixed += result.count;
  }

  console.log(`\n=== Done. Fixed ${totalFixed} class(es) across ${schools.length} school(s). ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
