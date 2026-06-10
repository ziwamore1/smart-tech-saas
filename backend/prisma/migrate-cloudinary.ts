import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'smarttech';

interface MigrationItem {
  model: string;
  id: string;
  urlField: string;
  publicIdField: string;
  url: string;
  folder: string;
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function resolveLocalPath(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const clean = url.replace(/^\.?\/?/, '');
  return path.resolve(process.cwd(), clean);
}

async function uploadFile(filePath: string, folder: string): Promise<{ url: string; publicId: string } | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`  [SKIP] File not found: ${filePath}`);
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const resourceType = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext) ? 'image' : 'raw';

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `${CLOUDINARY_FOLDER}/${folder}`,
          resource_type: resourceType as any,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      uploadStream.end(buffer);
    });
  } catch (err) {
    console.error(`  [FAIL] Upload error: ${(err as Error).message}`);
    return null;
  }
}

async function migrateEntity(items: MigrationItem[]): Promise<{ success: number; skipped: number; failed: number }> {
  let success = 0, skipped = 0, failed = 0;

  for (const item of items) {
    process.stdout.write(`  [${item.model}] ${item.id}... `);
    const uploaded = await uploadFile(item.url, item.folder);
    if (!uploaded) {
      console.log('SKIPPED');
      skipped++;
      continue;
    }
    try {
      await (prisma as any)[item.model].update({
        where: { id: item.id },
        data: {
          [item.urlField]: uploaded.url,
          [item.publicIdField]: uploaded.publicId,
        },
      });
      console.log(`OK → ${uploaded.url.split('/').pop()}`);
      success++;
    } catch (err) {
      console.error(`FAIL (db update): ${(err as Error).message}`);
      failed++;
    }
  }

  return { success, skipped, failed };
}

async function migrate() {
  console.log('\n=== Cloudinary Migration ===\n');

  const items: MigrationItem[] = [];

  // Schools: logo, banner, stamp, signature
  const schools = await prisma.school.findMany({
    where: {
      OR: [
        { logoUrl: { not: null }, logoPublicId: null },
        { bannerUrl: { not: null }, bannerPublicId: null },
        { stampPublicId: null, SchoolStamp: { not: null } },
        { signaturePublicId: null, directorSignature: { not: null } },
      ],
    },
  });
  for (const s of schools) {
    if (s.logoUrl && !s.logoPublicId) items.push({ model: 'school', id: s.id, urlField: 'logoUrl', publicIdField: 'logoPublicId', url: s.logoUrl, folder: 'schools/logos' });
    if (s.bannerUrl && !s.bannerPublicId) items.push({ model: 'school', id: s.id, urlField: 'bannerUrl', publicIdField: 'bannerPublicId', url: s.bannerUrl, folder: 'schools/banners' });
    if (s.SchoolStamp && !s.stampPublicId) items.push({ model: 'school', id: s.id, urlField: 'SchoolStamp', publicIdField: 'stampPublicId', url: s.SchoolStamp, folder: 'schools/stamps' });
    if (s.directorSignature && !s.signaturePublicId) items.push({ model: 'school', id: s.id, urlField: 'directorSignature', publicIdField: 'signaturePublicId', url: s.directorSignature, folder: 'schools/signatures' });
  }

  // Users
  const users = await prisma.user.findMany({ where: { photoUrl: { not: null }, photoPublicId: null } });
  for (const u of users) items.push({ model: 'user', id: u.id, urlField: 'photoUrl', publicIdField: 'photoPublicId', url: u.photoUrl!, folder: 'users/profiles' });

  // Teachers
  const teachers = await prisma.teacher.findMany({ where: { photoUrl: { not: null }, photoPublicId: null } });
  for (const t of teachers) items.push({ model: 'teacher', id: t.id, urlField: 'photoUrl', publicIdField: 'photoPublicId', url: t.photoUrl!, folder: 'users/teachers' });

  // Students
  const students = await prisma.student.findMany({ where: { photoUrl: { not: null }, photoPublicId: null } });
  for (const s of students) items.push({ model: 'student', id: s.id, urlField: 'photoUrl', publicIdField: 'photoPublicId', url: s.photoUrl!, folder: 'users/students' });

  // Parents
  const parents = await prisma.parent.findMany({ where: { photoUrl: { not: null }, photoPublicId: null } });
  for (const p of parents) items.push({ model: 'parent', id: p.id, urlField: 'photoUrl', publicIdField: 'photoPublicId', url: p.photoUrl!, folder: 'users/parents' });

  // StudentPhotos
  const studentPhotos = await prisma.studentPhoto.findMany({ where: { imageUrl: { not: null }, photoPublicId: null } });
  for (const sp of studentPhotos) items.push({ model: 'studentPhoto', id: sp.id, urlField: 'imageUrl', publicIdField: 'photoPublicId', url: sp.imageUrl, folder: 'users/student-photos' });

  if (items.length === 0) {
    console.log('No files need migration — all already have publicIds.\n');
    return;
  }

  console.log(`Found ${items.length} file(s) to migrate:\n`);

  for (const item of items) {
    console.log(`  ${item.model}.${item.id}: ${item.url}`);
  }

  console.log('\n--- Starting uploads ---\n');

  const results = { success: 0, skipped: 0, failed: 0 };
  for (const item of items) {
    const r = await migrateEntity([item]);
    results.success += r.success;
    results.skipped += r.skipped;
    results.failed += r.failed;
  }

  console.log(`\n=== Migration complete ===`);
  console.log(`  Success: ${results.success}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log();
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
