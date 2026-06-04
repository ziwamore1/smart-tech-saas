const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const user = await p.user.findFirst({ where: { email: 'teddyhalumba91@gmail.com' } });
  console.log('User found:', user?.email, '| id:', user?.id);
  if (!user) {
    const count = await p.user.count();
    console.log('Total users in DB:', count);
    const all = await p.user.findMany({ take: 5, select: { id: true, email: true, firstName: true, lastName: true } });
    console.log('Users:', JSON.stringify(all, null, 2));
  }
  await p.$disconnect();
})();
