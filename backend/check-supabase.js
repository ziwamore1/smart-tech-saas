const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL || '';
const directUrl = dbUrl.replace(':6543', ':5432');
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

async function main() {
  console.log('=== Database Connection Check ===\n');

  try {
    await prisma.$connect();
    console.log('Connected successfully!\n');

    const counts = {
      'Institution Types': await prisma.institutionType.count(),
      'Institution Modules': await prisma.institutionModule.count(),
      'Institution Features': await prisma.institutionFeature.count(),
      'Institution Roles': await prisma.institutionRole.count(),
      'Institution Dashboards': await prisma.institutionDashboard.count(),
      'Type-Module Links': await prisma.institutionTypeModule.count(),
      'Type-Feature Links': await prisma.institutionTypeFeature.count(),
      'Type-Role Links': await prisma.institutionTypeRole.count(),
      'Type-Dashboard Links': await prisma.institutionTypeDashboard.count(),
      'Institution Settings': await prisma.institutionSetting.count(),
      'Schools': await prisma.school.count(),
      'Users': await prisma.user.count(),
      'System Users (SuperAdmin)': await prisma.systemUser.count(),
      'Roles': await prisma.role.count(),
      'Subscription Plans': await prisma.subscriptionPlan.count(),
      'Grading Systems': await prisma.gradingSystem.count(),
      'Grade Scales': await prisma.gradeScale.count(),
      'Departments': await prisma.department.count(),
    };

    console.log('=== Record Counts ===');
    for (const [label, count] of Object.entries(counts)) {
      console.log(`  ${label.padEnd(30)} ${count}`);
    }

    const types = await prisma.institutionType.findMany();
    console.log('\n=== Institution Types ===');
    for (const t of types) {
      const modules = await prisma.institutionTypeModule.count({ where: { institutionTypeId: t.id } });
      const features = await prisma.institutionTypeFeature.count({ where: { institutionTypeId: t.id } });
      const roles = await prisma.institutionTypeRole.count({ where: { institutionTypeId: t.id } });
      console.log(`  ${t.code.padEnd(22)} ${t.name.padEnd(20)} modules=${modules} features=${features} roles=${roles}`);
    }

    console.log('\n=== Check Complete ===');
  } catch (error) {
    console.error('Connection failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
