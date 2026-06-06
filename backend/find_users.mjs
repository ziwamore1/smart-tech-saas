import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const email = process.argv[2] || '';
const users = await prisma.user.findMany({
  where: email ? { email: { contains: email } } : {},
  select: { id: true, email: true, firstName: true, lastName: true, schoolId: true },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
const schools = await prisma.school.findMany({
  select: { id: true, name: true, subscriptionStatus: true },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
console.log('=== USERS ===');
users.forEach(u => console.log(`${u.id} | ${u.email} | ${u.firstName} ${u.lastName} | schoolId: ${u.schoolId || '(none)'}`));
console.log('\n=== SCHOOLS ===');
schools.forEach(s => console.log(`${s.id} | ${s.name} | ${s.subscriptionStatus}`));
const directors = await prisma.user.findMany({
  where: { userRoles: { some: { role: { name: 'Director' } } } },
  select: { id: true, email: true, firstName: true, lastName: true, schoolId: true },
});
console.log('\n=== DIRECTORS ===');
directors.forEach(d => console.log(`${d.email} | ${d.firstName} ${d.lastName} | schoolId: ${d.schoolId}`));
await prisma.$disconnect();
