const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const cats = [
  { name: 'One', label: 'Excellent', minScore: 80, maxScore: 100, color: '#10b981', sortOrder: 1 },
  { name: 'Two', label: 'Very Good', minScore: 70, maxScore: 79.99, color: '#22c55e', sortOrder: 2 },
  { name: 'Three', label: 'Good', minScore: 60, maxScore: 69.99, color: '#3b82f6', sortOrder: 3 },
  { name: 'Four', label: 'Average', minScore: 50, maxScore: 59.99, color: '#f59e0b', sortOrder: 4 },
  { name: 'Five', label: 'Below Average', minScore: 40, maxScore: 49.99, color: '#f97316', sortOrder: 5 },
  { name: 'Six', label: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', sortOrder: 6 },
];

(async () => {
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  console.log('Found ' + schools.length + ' schools');
  let created = 0, skipped = 0;
  for (const school of schools) {
    const existing = await prisma.performanceCategory.findMany({ where: { schoolId: school.id } });
    if (existing.length > 0) { console.log('[SKIP] ' + school.name + ' (' + existing.length + ' categories)'); skipped++; continue; }
    await prisma.performanceCategory.createMany({
      data: cats.map(c => ({ schoolId: school.id, ...c, isActive: true })),
    });
    console.log('[OK] ' + school.name + ' - created 6 categories');
    created++;
  }
  console.log('Done: ' + created + ' seeded, ' + skipped + ' skipped');
  await prisma.$disconnect();
})();
