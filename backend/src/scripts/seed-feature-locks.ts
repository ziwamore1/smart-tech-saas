import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_FEATURES = [
  { key: 'students.view', name: 'View Students', description: 'View student list and details', category: 'students', minTier: 'BASIC' },
  { key: 'students.add', name: 'Add Students', description: 'Add new students to the system', category: 'students', minTier: 'BASIC' },
  { key: 'students.bulkImport', name: 'Bulk Import Students', description: 'Import students via Excel/CSV', category: 'students', minTier: 'BASIC', limits: { basic: 100, standard: 500, premium: -1 } },
  { key: 'students.advanced', name: 'Advanced Student Features', description: 'Health records, guardians management, attendance', category: 'students', minTier: 'STANDARD' },
  
  { key: 'teachers.view', name: 'View Teachers', description: 'View teacher list and details', category: 'teachers', minTier: 'BASIC' },
  { key: 'teachers.add', name: 'Add Teachers', description: 'Add new teachers to the system', category: 'teachers', minTier: 'BASIC' },
  { key: 'teachers.bulkImport', name: 'Bulk Import Teachers', description: 'Import teachers via Excel/CSV', category: 'teachers', minTier: 'STANDARD' },
  
  { key: 'classes.view', name: 'View Classes', description: 'View class list and details', category: 'classes', minTier: 'BASIC' },
  { key: 'classes.add', name: 'Add Classes', description: 'Create new classes', category: 'classes', minTier: 'BASIC', limits: { basic: 10, standard: 30, premium: -1 } },
  
  { key: 'subjects.view', name: 'View Subjects', description: 'View subject list', category: 'subjects', minTier: 'BASIC' },
  { key: 'subjects.add', name: 'Add Subjects', description: 'Create new subjects', category: 'subjects', minTier: 'BASIC', limits: { basic: 10, standard: 25, premium: -1 } },
  
  { key: 'timetable.view', name: 'View Timetable', description: 'View master and class timetables', category: 'timetable', minTier: 'BASIC' },
  { key: 'timetable.edit', name: 'Edit Timetable', description: 'Manually edit and adjust timetable', category: 'timetable', minTier: 'BASIC' },
  { key: 'timetable.generate', name: 'AI Timetable Generator', description: 'Auto-generate timetables using AI', category: 'timetable', minTier: 'STANDARD' },
  { key: 'timetable.constraints', name: 'Timetable Constraints', description: 'Set custom constraints for scheduling', category: 'timetable', minTier: 'PREMIUM' },
  
  { key: 'results.view', name: 'View Results', description: 'View student results', category: 'results', minTier: 'BASIC' },
  { key: 'results.add', name: 'Add Results', description: 'Enter and manage student results', category: 'results', minTier: 'BASIC' },
  { key: 'results.bulkImport', name: 'Bulk Import Results', description: 'Import results via Excel', category: 'results', minTier: 'BASIC' },
  { key: 'results.reports', name: 'Result Reports', description: 'Generate comprehensive result reports', category: 'results', minTier: 'STANDARD' },
  
  { key: 'fees.view', name: 'View Fees', description: 'View fee structure and payments', category: 'fees', minTier: 'BASIC' },
  { key: 'fees.manage', name: 'Manage Fees', description: 'Create and modify fee structures', category: 'fees', minTier: 'BASIC' },
  { key: 'fees.onlinePayment', name: 'Online Payment', description: 'Enable online fee payment gateway', category: 'fees', minTier: 'STANDARD' },
  
  { key: 'communications.view', name: 'View Communications', description: 'View messages and notifications', category: 'communications', minTier: 'BASIC' },
  { key: 'communications.send', name: 'Send Messages', description: 'Send messages to parents and teachers', category: 'communications', minTier: 'BASIC' },
  { key: 'communications.bulk', name: 'Bulk Messaging', description: 'Send bulk SMS and emails', category: 'communications', minTier: 'STANDARD' },
  { key: 'communications.whatsapp', name: 'WhatsApp Integration', description: 'Send messages via WhatsApp', category: 'communications', minTier: 'PREMIUM' },
  
  { key: 'analytics.view', name: 'View Analytics', description: 'View basic analytics dashboards', category: 'analytics', minTier: 'BASIC' },
  { key: 'analytics.advanced', name: 'Advanced Analytics', description: 'Predictive analytics and insights', category: 'analytics', minTier: 'STANDARD' },
  { key: 'analytics.ai', name: 'AI-Powered Insights', description: 'AI-generated recommendations and predictions', category: 'analytics', minTier: 'PREMIUM' },
  
  { key: 'reports.generate', name: 'Generate Reports', description: 'Generate standard system reports', category: 'reports', minTier: 'BASIC' },
  { key: 'reports.custom', name: 'Custom Reports', description: 'Create and customize reports', category: 'reports', minTier: 'STANDARD' },
  { key: 'reports.export', name: 'Export Reports', description: 'Export reports in various formats', category: 'reports', minTier: 'BASIC' },
  
  { key: 'integrations.api', name: 'API Access', description: 'Access to REST API for integrations', category: 'integrations', minTier: 'STANDARD' },
  { key: 'integrations.webhooks', name: 'Webhooks', description: 'Configure webhook notifications', category: 'integrations', minTier: 'PREMIUM' },
  
  { key: 'advanced.backup', name: 'Data Backup', description: 'Automated data backup', category: 'advanced', minTier: 'BASIC' },
  { key: 'advanced.restore', name: 'Data Restore', description: 'Restore from backup', category: 'advanced', minTier: 'BASIC' },
  { key: 'advanced.multiuser', name: 'Multi-user Access', description: 'Multiple admin user accounts', category: 'advanced', minTier: 'STANDARD' },
  { key: 'advanced.sso', name: 'Single Sign-On (SSO)', description: 'SSO integration with external systems', category: 'advanced', minTier: 'PREMIUM' },
];

async function seedFeatureLocks() {
  console.log('Seeding Feature Locks...');
  
  for (const feature of DEFAULT_FEATURES) {
    await prisma.featureLock.upsert({
      where: { key: feature.key },
      update: {},
      create: {
        key: feature.key,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        minTier: feature.minTier as any,
        limits: feature.limits as any,
        isEnabled: true,
        isLocked: false,
      },
    });
    console.log(`  ✓ ${feature.key}`);
  }
  
  console.log(`\nSeeded ${DEFAULT_FEATURES.length} feature locks`);
}

async function seedSubscriptionPlans() {
  console.log('\nSeeding Subscription Plans...');
  
  const plans = [
    {
      name: 'BASIC',
      displayName: 'Basic',
      description: 'Perfect for small schools getting started',
      monthlyPrice: 2900,
      yearlyPrice: 29000,
      maxStudents: 100,
      maxTeachers: 20,
      maxClasses: 10,
      maxStorageGB: 5,
      features: [
        'students.view', 'students.add', 'teachers.view', 'teachers.add',
        'classes.view', 'classes.add', 'subjects.view', 'subjects.add',
        'timetable.view', 'timetable.edit', 'results.view', 'results.add',
        'results.bulkImport', 'fees.view', 'fees.manage', 'communications.view',
        'communications.send', 'analytics.view', 'reports.generate', 'reports.export',
        'advanced.backup', 'advanced.restore',
      ],
    },
    {
      name: 'STANDARD',
      displayName: 'Standard',
      description: 'For growing schools with more needs',
      monthlyPrice: 7900,
      yearlyPrice: 79000,
      maxStudents: 500,
      maxTeachers: 100,
      maxClasses: 30,
      maxStorageGB: 50,
      features: [
        'students.view', 'students.add', 'students.bulkImport', 'students.advanced',
        'teachers.view', 'teachers.add', 'teachers.bulkImport',
        'classes.view', 'classes.add', 'subjects.view', 'subjects.add',
        'timetable.view', 'timetable.edit', 'timetable.generate',
        'results.view', 'results.add', 'results.bulkImport', 'results.reports',
        'fees.view', 'fees.manage', 'fees.onlinePayment',
        'communications.view', 'communications.send', 'communications.bulk',
        'analytics.view', 'analytics.advanced',
        'reports.generate', 'reports.custom', 'reports.export',
        'integrations.api', 'advanced.backup', 'advanced.restore', 'advanced.multiuser',
      ],
    },
    {
      name: 'PREMIUM',
      displayName: 'Premium',
      description: 'Full-featured for large institutions',
      monthlyPrice: 14900,
      yearlyPrice: 149000,
      maxStudents: -1,
      maxTeachers: -1,
      maxClasses: -1,
      maxStorageGB: 500,
      features: [
        'students.view', 'students.add', 'students.bulkImport', 'students.advanced',
        'teachers.view', 'teachers.add', 'teachers.bulkImport',
        'classes.view', 'classes.add', 'subjects.view', 'subjects.add',
        'timetable.view', 'timetable.edit', 'timetable.generate', 'timetable.constraints',
        'results.view', 'results.add', 'results.bulkImport', 'results.reports',
        'fees.view', 'fees.manage', 'fees.onlinePayment',
        'communications.view', 'communications.send', 'communications.bulk', 'communications.whatsapp',
        'analytics.view', 'analytics.advanced', 'analytics.ai',
        'reports.generate', 'reports.custom', 'reports.export',
        'integrations.api', 'integrations.webhooks',
        'advanced.backup', 'advanced.restore', 'advanced.multiuser', 'advanced.sso',
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        maxStudents: plan.maxStudents,
        maxTeachers: plan.maxTeachers,
        maxClasses: plan.maxClasses,
        maxStorageGB: plan.maxStorageGB,
        features: plan.features as any,
      },
      create: {
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        maxStudents: plan.maxStudents,
        maxTeachers: plan.maxTeachers,
        maxClasses: plan.maxClasses,
        maxStorageGB: plan.maxStorageGB,
        features: plan.features as any,
        isActive: true,
        isPopular: plan.name === 'STANDARD',
      },
    });
    console.log(`  ✓ ${plan.name} Plan`);
  }
  
  console.log(`\nSeeded ${plans.length} subscription plans`);
}

async function main() {
  try {
    await seedFeatureLocks();
    await seedSubscriptionPlans();
    console.log('\n✅ Seeding complete!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
