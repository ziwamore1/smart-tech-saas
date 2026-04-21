const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const user = await prisma.user.findFirst({
    select: { email: true, password: true, firstName: true }
  });
  console.log('User:', user);
  prisma.$disconnect();
}

test();
