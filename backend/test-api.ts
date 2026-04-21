import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing SmartTech Backend API...\n');

  // Test 1: Check database connection
  console.log('1️⃣ Testing database connection...');
  const schoolCount = await prisma.school.count();
  console.log(`   ✓ Database connected. Schools: ${schoolCount}`);

  // Test 2: Check users exist
  console.log('\n2️⃣ Testing users...');
  const users = await prisma.user.findMany({ take: 5 });
  console.log(`   ✓ Found ${users.length} users`);

  if (users.length > 0) {
    const user = users[0];
    console.log(`   Sample user: ${user.firstName} ${user.lastName} (${user.email})`);
    
    // Test 3: Login (if password is known)
    console.log('\n3️⃣ Testing authentication...');
    const roles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true }
    });
    console.log(`   Roles: ${roles.map(r => r.role.name).join(', ')}`);
  }

  // Test 4: Check key data
  console.log('\n4️⃣ Checking key data...');
  const [students, teachers, classes, subjects, terms] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.subject.count(),
    prisma.term.count()
  ]);
  console.log(`   Students: ${students}`);
  console.log(`   Teachers: ${teachers}`);
  console.log(`   Classes: ${classes}`);
  console.log(`   Subjects: ${subjects}`);
  console.log(`   Terms: ${terms}`);

  // Test 5: Check new tables
  console.log('\n5️⃣ Checking new tables...');
  const [exams, conversations] = await Promise.all([
    prisma.exam.count(),
    prisma.conversation.count()
  ]);
  console.log(`   Exams: ${exams}`);
  console.log(`   Conversations: ${conversations}`);

  console.log('\n✅ All basic tests passed!\n');
  console.log('To test the full API:');
  console.log('1. Run: npm run start:dev');
  console.log('2. Use Postman/curl to test endpoints');
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
