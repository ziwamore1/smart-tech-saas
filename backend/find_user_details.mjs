import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const email = 'nteddy262@gmail.com';
const user = await prisma.user.findUnique({
  where: { email },
  include: { userRoles: { include: { role: true } } },
});
if (user) {
  console.log('User:', JSON.stringify({
    id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
    schoolId: user.schoolId, isActive: user.isActive, roles: user.userRoles.map(ur => ur.role.name),
    createdAt: user.createdAt,
  }, null, 2));
}
// Also check if there's a school with this email
const school = await prisma.school.findFirst({ where: { email } });
console.log('\nSchool with this email:', school ? school.name : 'none');
await prisma.$disconnect();
