import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = '1483376a-bfcd-49dc-8af9-bb9a6ba260aa';

const existing = await prisma.organisation.findUnique({ where: { id: ORG_ID } });
if (existing) {
  console.log('Organisation already exists:', existing.id, existing.name);
} else {
  const org = await prisma.organisation.create({
    data: {
      id: ORG_ID,
      name: 'SMART TECH SECONDARY SCHOOL',
      slug: `smart-tech-secondary-${ORG_ID.slice(0, 8)}`,
      email: `smarttech-${ORG_ID.slice(0, 8)}@signatures.local`,
      passwordHash: 'seeded-no-login',
    },
  });
  console.log('Created organisation:', org.id, org.name);
}

const key = await prisma.signingKey.findFirst({ where: { organisationId: ORG_ID, status: 'ACTIVE' } });
console.log('Active signing key:', key ? key.id : '(none yet - will be created on first sign)');

await prisma.$disconnect();
