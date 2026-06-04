const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const roles = await p.role.findMany();
  console.log('Roles:', roles.length);
  const schools = await p.school.count();
  console.log('Schools:', schools);
  const sysUsers = await p.systemUser.count();
  console.log('SystemUsers:', sysUsers);
  const users = await p.user.count();
  console.log('Users:', users);
  await p.$disconnect();
})();
