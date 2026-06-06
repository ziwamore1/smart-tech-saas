import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_DEPARTMENTS = [
  { name: 'Mathematics', code: 'MATH', category: 'MATHEMATICS' },
  { name: 'Sciences', code: 'SCI', category: 'SCIENCE' },
  { name: 'Languages & Literature', code: 'LANG', category: 'LANGUAGES' },
  { name: 'Social Sciences', code: 'SOC', category: 'SOCIAL_SCIENCE' },
  { name: 'Computer Science & ICT', code: 'ICT', category: 'COMPUTER_SCIENCE' },
  { name: 'Business Studies', code: 'BUS', category: 'BUSINESS_STUDIES' },
  { name: 'Technical & Practical', code: 'TECH', category: 'TECHNICAL' },
  { name: 'Vocational & Training', code: 'VOC', category: 'VOCATIONAL' },
  { name: 'Creative & Performing Arts', code: 'ARTS', category: 'CREATIVE_ARTS' },
  { name: 'Physical Education & Sports', code: 'PE', category: 'SPORTS' },
  { name: 'Guidance & Counseling', code: 'GUID', category: 'COUNSELING' },
  { name: 'Administration', code: 'ADMIN', category: 'ADMINISTRATION' },
  { name: 'Finance & Accounts', code: 'FIN', category: 'FINANCE' },
  { name: 'Library & Resource Center', code: 'LIB', category: 'LIBRARY' },
];

const PRIMARY_DEPARTMENTS = [
  { name: 'Early Childhood Education', code: 'ECE', category: 'EARLY_CHILDHOOD' },
  { name: 'Lower Primary (Grade 1-4)', code: 'LPRIM', category: 'LOWER_PRIMARY' },
  { name: 'Upper Primary (Grade 5-7)', code: 'UPRIM', category: 'UPPER_PRIMARY' },
  { name: 'Primary Special Education', code: 'SPED', category: 'SPECIAL_EDUCATION' },
  { name: 'Primary Literacy & Numeracy', code: 'LITNUM', category: 'LITERACY_NUMERACY' },
  { name: 'Administration', code: 'ADMIN', category: 'ADMINISTRATION' },
  { name: 'Finance & Accounts', code: 'FIN', category: 'FINANCE' },
];

async function main() {
  const schoolId = process.argv[2]; // pass school ID as argument or leave empty for all schools
  const type = process.argv[3] || 'SECONDARY'; // SECONDARY or PRIMARY

  const where: any = schoolId ? { id: schoolId } : {};
  const schools = await prisma.school.findMany({ where });
  const departments = type === 'PRIMARY' ? PRIMARY_DEPARTMENTS : DEFAULT_DEPARTMENTS;

  let created = 0;
  for (const school of schools) {
    for (const dept of departments) {
      await prisma.department.upsert({
        where: { schoolId_name: { schoolId: school.id, name: dept.name } },
        update: {},
        create: { ...dept, schoolId: school.id, description: `${dept.name} department` },
      });
      created++;
    }
    console.log(`Seeded ${departments.length} departments for school: ${school.name}`);
  }

  console.log(`Total: ${created} departments created/verified across ${schools.length} schools`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
