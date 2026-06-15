import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Publishing system default templates to marketplace...');

  const templates = await prisma.reportTemplate.findMany({
    where: { isDefault: true, schoolId: null },
  });

  console.log(`Found ${templates.length} system templates to publish`);

  let published = 0;
  let skipped = 0;

  for (const t of templates) {
    const existing = await prisma.templateMarketplace.findUnique({
      where: { templateId: t.id },
    });

    if (existing) {
      console.log(`  SKIP: "${t.name}" already in marketplace`);
      skipped++;
      continue;
    }

    const categorySlug = t.categoryId
      ? (await prisma.templateCategory.findUnique({ where: { id: t.categoryId } }))?.slug
      : null;

    await prisma.templateMarketplace.create({
      data: {
        templateId: t.id,
        schoolId: null,
        title: t.name,
        description: t.description || '',
        category: categorySlug || 'Report Cards',
        tags: [t.templateType],
        featured: false,
      },
    });

    console.log(`  OK: "${t.name}" published to marketplace`);
    published++;
  }

  console.log(`\nDone: ${published} published, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
