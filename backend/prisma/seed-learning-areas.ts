import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultLearningAreas: Record<string, string[]> = {
  Mathematics: ['Algebra', 'Geometry', 'Statistics', 'Arithmetic', 'Trigonometry', 'Calculus', 'Number Theory', 'Probability', 'Measurement', 'Data Handling'],
  English: ['Reading Comprehension', 'Grammar', 'Writing', 'Vocabulary', 'Literature', 'Oral Communication', 'Spelling', 'Punctuation', 'Creative Writing', 'Comprehension'],
  Science: ['Biology', 'Chemistry', 'Physics', 'Scientific Method', 'Ecology', 'Astronomy', 'Earth Science', 'Experimentation', 'Environmental Science'],
  'Integrated Science': ['Biology', 'Chemistry', 'Physics', 'Scientific Method', 'Ecology', 'Earth Science', 'Experimentation'],
  Biology: ['Cell Biology', 'Genetics', 'Ecology', 'Human Anatomy', 'Botany', 'Zoology', 'Evolution', 'Microbiology'],
  Chemistry: ['Atomic Structure', 'Chemical Bonding', 'Stoichiometry', 'Organic Chemistry', 'Inorganic Chemistry', 'Chemical Reactions', 'Periodic Table', 'Solutions'],
  Physics: ['Mechanics', 'Thermodynamics', 'Waves', 'Optics', 'Electricity', 'Magnetism', 'Nuclear Physics', 'Kinematics'],
  History: ['World History', 'National History', 'Ancient Civilizations', 'Modern History', 'Historical Analysis', 'Chronology', 'Historical Sources'],
  Geography: ['Physical Geography', 'Human Geography', 'Map Reading', 'Climate', 'Population', 'Natural Resources', 'Environmental Geography'],
  'Religious Education': ['Biblical Studies', 'Ethics', 'World Religions', 'Moral Education', 'Scripture', 'Religious Practices'],
  'Social Studies': ['Civics', 'Government', 'Economics', 'Culture', 'Community', 'National Identity', 'Global Citizenship'],
  'Computer Science': ['Programming', 'Algorithms', 'Data Structures', 'Networks', 'Database', 'Web Development', 'Computer Fundamentals', 'Digital Literacy'],
  ICT: ['Computer Fundamentals', 'Word Processing', 'Spreadsheets', 'Presentations', 'Internet', 'Programming Basics', 'Digital Literacy'],
  French: ['Vocabulary', 'Grammar', 'Listening', 'Speaking', 'Reading', 'Writing', 'Translation', 'French Culture'],
  'Local Language': ['Vocabulary', 'Grammar', 'Oral Communication', 'Reading', 'Writing', 'Cultural Studies'],
  'Physical Education': ['Sports', 'Fitness', 'Health Education', 'Teamwork', 'Motor Skills', 'Nutrition'],
  Music: ['Theory', 'Performance', 'Composition', 'Music History', 'Appreciation', 'Rhythm'],
  Art: ['Drawing', 'Painting', 'Sculpture', 'Art History', 'Design', 'Color Theory', 'Creative Expression'],
  Accounting: ['Bookkeeping', 'Financial Statements', 'Ratio Analysis', 'Budgeting', 'Taxation', 'Auditing'],
  Commerce: ['Trade', 'Marketing', 'Business Studies', 'Entrepreneurship', 'E-commerce', 'Business Communication'],
  Economics: ['Microeconomics', 'Macroeconomics', 'Development Economics', 'International Trade', 'Economic Theory'],
  Agriculture: ['Crop Production', 'Animal Husbandry', 'Soil Science', 'Agricultural Economics', 'Farm Management', 'Agroforestry'],
  'Home Economics': ['Food and Nutrition', 'Textiles', 'Family Studies', 'Consumer Education', 'Home Management'],
};

async function main() {
  console.log('Seeding Learning Areas...');

  const subjects = await prisma.subject.findMany({
    include: { school: true },
  });

  if (subjects.length === 0) {
    console.log('No subjects found. Add subjects first, then run this seed.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const subject of subjects) {
    const areas = defaultLearningAreas[subject.name] || defaultLearningAreas[subject.name.toLowerCase()];

    if (!areas) {
      // Generate generic learning areas for unrecognized subjects
      const genericAreas = [
        `${subject.name} Fundamentals`,
        `${subject.name} Intermediate`,
        `${subject.name} Advanced`,
        `${subject.name} Theory`,
        `${subject.name} Application`,
        `${subject.name} Analysis`,
      ];

      for (const area of genericAreas) {
        await upsertLearningArea(area, subject.id, subject.schoolId);
        created++;
      }
      console.log(`  ${subject.name}: ${genericAreas.length} generic areas created`);
      continue;
    }

    for (const area of areas) {
      const exists = await prisma.learningArea.findFirst({
        where: { name: area, subjectId: subject.id, schoolId: subject.schoolId },
      });

      if (!exists) {
        await prisma.learningArea.create({
          data: { name: area, subjectId: subject.id, schoolId: subject.schoolId },
        });
        created++;
      } else {
        skipped++;
      }
    }

    console.log(`  ${subject.name}: ${areas.length} areas (${created} new, ${skipped} existing)`);
  }

  console.log(`\nDone! Created ${created} new learning areas, ${skipped} already existed.`);

  // Print summary by subject
  const summary = await prisma.learningArea.groupBy({
    by: ['subjectId'],
    _count: { id: true },
  });

  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
  console.log('\nLearning Areas per subject:');
  for (const item of summary.sort((a, b) => (subjectMap.get(a.subjectId) || '').localeCompare(subjectMap.get(b.subjectId) || ''))) {
    console.log(`  ${subjectMap.get(item.subjectId) || 'Unknown'}: ${item._count.id} areas`);
  }
}

async function upsertLearningArea(name: string, subjectId: string, schoolId: string) {
  const exists = await prisma.learningArea.findFirst({
    where: { name, subjectId, schoolId },
  });

  if (!exists) {
    await prisma.learningArea.create({
      data: { name, subjectId, schoolId },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
