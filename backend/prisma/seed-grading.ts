import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });

  if (schools.length === 0) {
    console.log('No schools found. Create a school first or run the main seed.');
    return;
  }

  const primaryGradingScales = [
    { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5 },
    { minScore: 70, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4 },
    { minScore: 60, maxScore: 69, grade: 'C', remark: 'Good', points: 3 },
    { minScore: 50, maxScore: 59, grade: 'D', remark: 'Satisfactory', points: 2 },
    { minScore: 40, maxScore: 49, grade: 'E', remark: 'Fair', points: 1 },
    { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail', points: 0 },
  ];

  const secondaryGradingScales = [
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

  const formsGradingScales = [
    { minScore: 70, maxScore: 100, grade: '1', remark: 'Outstanding', points: 1 },
    { minScore: 60, maxScore: 69, grade: '2', remark: 'Advanced', points: 2 },
    { minScore: 50, maxScore: 59, grade: '3', remark: 'Basic', points: 3 },
    { minScore: 40, maxScore: 49, grade: '4', remark: 'Satisfactory', points: 4 },
    { minScore: 0, maxScore: 39, grade: '5', remark: 'Unsatisfactory', points: 5 },
  ];

  const collegeGradingScales = [
    { minScore: 85, maxScore: 100, grade: 'A', remark: 'Distinction', points: 4 },
    { minScore: 70, maxScore: 84, grade: 'B', remark: 'Merit', points: 3 },
    { minScore: 55, maxScore: 69, grade: 'C', remark: 'Pass', points: 2 },
    { minScore: 40, maxScore: 54, grade: 'D', remark: 'Marginal Fail', points: 1 },
    { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail', points: 0 },
  ];

  const universityGradingScales = [
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

  const grade7EczScales = [
    { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5 },
    { minScore: 70, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4 },
    { minScore: 60, maxScore: 69, grade: 'C', remark: 'Good', points: 3 },
    { minScore: 50, maxScore: 59, grade: 'D', remark: 'Satisfactory', points: 2 },
    { minScore: 40, maxScore: 49, grade: 'E', remark: 'Fair', points: 1 },
    { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail', points: 0 },
  ];

  const gradingSystems = [
    { name: 'Primary Grading System', scales: primaryGradingScales },
    { name: 'ECZ Grade 7 Grading System', scales: grade7EczScales },
    { name: 'ECZ Secondary Grading System', scales: secondaryGradingScales },
    { name: 'ECZ Forms Grading System', scales: formsGradingScales },
    { name: 'College GPA Grading System', scales: collegeGradingScales },
    { name: 'University CGPA Grading System', scales: universityGradingScales },
  ];

  const oldToNewName: Record<string, string> = {
    'ECZ Primary Grading System': 'Primary Grading System',
  };

  for (const school of schools) {
    for (const [oldName, newName] of Object.entries(oldToNewName)) {
      const oldRecord = await prisma.gradingSystem.findFirst({
        where: { schoolId: school.id, name: oldName },
      });
      if (oldRecord) {
        await prisma.gradingSystem.update({
          where: { id: oldRecord.id },
          data: { name: newName },
        });
        console.log(`Renamed "${oldName}" → "${newName}" for school "${school.name}"`);
      }
    }

    for (const gs of gradingSystems) {
      const existing = await prisma.gradingSystem.findFirst({
        where: { schoolId: school.id, name: gs.name },
      });

      if (!existing) {
        const gradingSystem = await prisma.gradingSystem.create({
          data: {
            name: gs.name,
            schoolId: school.id,
            isDefault: gs.name === 'Primary Grading System',
          },
        });

        for (const scale of gs.scales) {
          await prisma.gradeScale.create({
            data: {
              gradingSystemId: gradingSystem.id,
              minScore: scale.minScore,
              maxScore: scale.maxScore,
              grade: scale.grade,
              remark: scale.remark,
              points: scale.points,
            },
          });
        }

        console.log(`Created "${gs.name}" for school "${school.name}" with ${gs.scales.length} grade scales`);
      }
    }
  }

  console.log('\nGrading systems seeded successfully!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
