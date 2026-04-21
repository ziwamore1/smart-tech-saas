import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    'Director',
    'Head Teacher',
    'Deputy',
    'Accountant',
    'Secretary',
    'Teacher',
    'Class Teacher',
    'Student',
    'Parent',
    'SuperAdmin',
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }

  const plans = [
    {
      name: 'BASIC',
      displayName: 'Basic',
      description: 'Perfect for small schools getting started',
      monthlyPrice: 990,
      yearlyPrice: 9900,
      maxStudents: 100,
      maxTeachers: 10,
      maxClasses: 8,
      maxStorageGB: 5,
      features: JSON.stringify([
        'Basic Timetable',
        'Student Management',
        'Teacher Management',
        'Results Management',
        'Email Support',
      ]),
      isActive: true,
      isPopular: false,
    },
    {
      name: 'STANDARD',
      displayName: 'Standard',
      description: 'For growing schools with more needs',
      monthlyPrice: 1990,
      yearlyPrice: 19900,
      maxStudents: 500,
      maxTeachers: 50,
      maxClasses: 25,
      maxStorageGB: 15,
      features: JSON.stringify([
        'Everything in Basic',
        'Advanced Timetable AI',
        'Parent Portal',
        'Fee Management',
        'Notice Board',
        'Priority Support',
      ]),
      isActive: true,
      isPopular: true,
    },
    {
      name: 'PREMIUM',
      displayName: 'Premium',
      description: 'Full-featured for large institutions',
      monthlyPrice: 3990,
      yearlyPrice: 39900,
      maxStudents: -1,
      maxTeachers: -1,
      maxClasses: -1,
      maxStorageGB: 100,
      features: JSON.stringify([
        'Everything in Standard',
        'Unlimited Users',
        'Custom Branding',
        'API Access',
        'Dedicated Support',
        'White-label Options',
      ]),
      isActive: true,
      isPopular: false,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log('Seeding completed!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
