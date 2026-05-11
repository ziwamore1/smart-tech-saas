import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedECZ() {
  const schools = await prisma.school.findMany();

  if (schools.length === 0) {
    console.log('❌ No schools found in database');
    return;
  }

  for (const school of schools) {
    const existingSystem = await prisma.gradingSystem.findFirst({
      where: { schoolId: school.id, name: 'ECZ Point Grading System' },
    });

    if (existingSystem) {
      console.log(`ℹ️ ECZ grading system already exists for school: ${school.name}`);

      if (!existingSystem.isDefault) {
        await prisma.gradingSystem.update({
          where: { id: existingSystem.id },
          data: { isDefault: true },
        });
        console.log(`✅ Set existing ECZ grading system as default for ${school.name}`);
      }
      continue;
    }

    const gradingSystem = await prisma.gradingSystem.create({
      data: {
        name: 'ECZ Point Grading System',
        schoolId: school.id,
        isDefault: true,
      },
    });

    await prisma.gradeScale.createMany({
      data: [
        { gradingSystemId: gradingSystem.id, minScore: 75, maxScore: 100, grade: '1', remark: 'Distinction', points: 1 },
        { gradingSystemId: gradingSystem.id, minScore: 70, maxScore: 74, grade: '2', remark: 'Very Good', points: 2 },
        { gradingSystemId: gradingSystem.id, minScore: 65, maxScore: 69, grade: '3', remark: 'Good', points: 3 },
        { gradingSystemId: gradingSystem.id, minScore: 60, maxScore: 64, grade: '4', remark: 'Credit', points: 4 },
        { gradingSystemId: gradingSystem.id, minScore: 55, maxScore: 59, grade: '5', remark: 'Credit', points: 5 },
        { gradingSystemId: gradingSystem.id, minScore: 50, maxScore: 54, grade: '6', remark: 'Pass', points: 6 },
        { gradingSystemId: gradingSystem.id, minScore: 45, maxScore: 49, grade: '7', remark: 'Pass', points: 7 },
        { gradingSystemId: gradingSystem.id, minScore: 40, maxScore: 44, grade: '8', remark: 'Marginal', points: 8 },
        { gradingSystemId: gradingSystem.id, minScore: 0, maxScore: 39, grade: '9', remark: 'Fail', points: 9 },
      ],
    });

    console.log('✅ ECZ grading system created successfully for school:', school.name);
  }
}

seedECZ()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
