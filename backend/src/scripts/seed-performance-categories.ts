import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: 'One', label: 'Excellent', minScore: 80, maxScore: 100, color: '#10b981', sortOrder: 1 },
  { name: 'Two', label: 'Very Good', minScore: 70, maxScore: 79.99, color: '#22c55e', sortOrder: 2 },
  { name: 'Three', label: 'Good', minScore: 60, maxScore: 69.99, color: '#3b82f6', sortOrder: 3 },
  { name: 'Four', label: 'Average', minScore: 50, maxScore: 59.99, color: '#f59e0b', sortOrder: 4 },
  { name: 'Five', label: 'Below Average', minScore: 40, maxScore: 49.99, color: '#f97316', sortOrder: 5 },
  { name: 'Six', label: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', sortOrder: 6 },
];

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  console.log(`Found ${schools.length} schools`);

  let created = 0;
  let skipped = 0;

  for (const school of schools) {
    const existing = await prisma.performanceCategory.findMany({
      where: { schoolId: school.id },
    });

    if (existing.length > 0) {
      console.log(`  [SKIP] ${school.name} — already has ${existing.length} categories`);
      skipped++;
      continue;
    }

    await prisma.performanceCategory.createMany({
      data: DEFAULT_CATEGORIES.map(c => ({
        schoolId: school.id,
        name: c.name,
        label: c.label,
        minScore: c.minScore,
        maxScore: c.maxScore,
        color: c.color,
        sortOrder: c.sortOrder,
        isActive: true,
      })),
    });

    console.log(`  [OK] ${school.name} — created 6 performance categories`);
    created++;
  }

  console.log(`\nDone: ${created} schools seeded, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
