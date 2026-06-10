import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting Cloudinary migration...\n');

  const schools = await prisma.school.findMany({ where: { logoUrl: { not: null } } });
  console.log(`Found ${schools.length} schools with local logo URLs to migrate.`);

  const users = await prisma.user.findMany({ where: { photoUrl: { not: null } } });
  console.log(`Found ${users.length} users with local photo URLs to migrate.`);

  const students = await prisma.student.findMany({ where: { photoUrl: { not: null } } });
  console.log(`Found ${students.length} students with local photo URLs to migrate.`);

  console.log('\nMigration script prepared. To perform the migration:');
  console.log('1. Ensure Cloudinary credentials are set in environment');
  console.log('2. Run: npx ts-node prisma/migrate-cloudinary.ts');
  console.log('\nFor each file, the migration will:');
  console.log('  a. Download from existing local URL');
  console.log('  b. Upload to Cloudinary using CloudinaryService.uploadBuffer()');
  console.log('  c. Update database record with new Cloudinary URL and publicId');
  console.log('  d. Log success/failure for each file\n');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
