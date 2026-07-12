import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    'Director',
    'Deputy Director',
    'Head Teacher',
    'Deputy',
    'Accountant',
    'Secretary',
    'Teacher',
    'Class Teacher',
    'HOD',
    'Student',
    'Parent',
    'SuperAdmin',
    'Lower Primary Senior Teacher',
    'Upper Primary Senior Teacher',
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
    console.log(`Created/updated role: ${role}`);
  }
  console.log('Done seeding roles');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());