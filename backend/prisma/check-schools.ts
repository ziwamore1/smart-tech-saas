import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const schools = await prisma.school.findMany({ take: 10, select: { id: true, name: true, email: true } });
  console.log('Schools:', JSON.stringify(schools, null, 2));
  const subjects = await prisma.subject.findMany({ take: 5, select: { id: true, name: true, schoolId: true } });
  console.log('Subjects:', JSON.stringify(subjects, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
