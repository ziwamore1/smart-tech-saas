const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const user = await p.user.findFirst({ where: { email: 'teddyhalumba91@gmail.com' }, include: { userRoles: { include: { role: true } }, school: true } });
  if (user) {
    console.log('User:', user.id, user.email, user.firstName, user.lastName);
    console.log('Roles:', user.userRoles.map(r => r.role.name));
    console.log('School:', user.school?.id, user.school?.name);
    console.log('SchoolId:', user.schoolId);
  } else {
    console.log('User not found');
    const all = await p.user.findMany({ select: { id: true, email: true }, take: 5 });
    console.log('All users in DB:', JSON.stringify(all));
  }
  await p.$disconnect();
})();
