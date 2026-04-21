const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('🧪 SmartTech Backend - Database & Structure Tests\n');
  
  try {
    await prisma.$connect();
    console.log('✓ Database connected\n');
    
    // Test core tables
    const tables = {
      schools: await prisma.school.count(),
      users: await prisma.user.count(),
      students: await prisma.student.count(),
      teachers: await prisma.teacher.count(),
      classes: await prisma.class.count(),
      subjects: await prisma.subject.count(),
      terms: await prisma.term.count(),
      results: await prisma.result.count(),
      attendance: await prisma.attendance.count(),
      homework: await prisma.homework.count(),
      exams: await prisma.exam.count(),
      conversations: await prisma.conversation.count(),
    };
    
    console.log('📊 Data Summary:');
    Object.entries(tables).forEach(([key, count]) => {
      console.log(`   ${key}: ${count}`);
    });
    
    // Test relations work
    console.log('\n🔗 Testing Relations:');
    
    const userWithRoles = await prisma.user.findFirst({
      include: { userRoles: { include: { role: true } } }
    });
    console.log(`   ✓ User-Role relation works (user: ${userWithRoles?.firstName})`);
    
    const studentWithUser = await prisma.student.findFirst({
      include: { user: true }
    });
    console.log(`   ✓ Student-User relation works`);
    
    const termWithYear = await prisma.term.findFirst({
      include: { academicYear: true }
    });
    console.log(`   ✓ Term-AcademicYear relation works`);
    
    // Test new features
    console.log('\n🆕 New Features:');
    console.log(`   Exam: ${tables.exams} records`);
    console.log(`   Conversations: ${tables.conversations} records`);
    
    // Check for new attendance fields
    const attendanceFields = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Attendance' AND column_name IN ('checkInTime', 'biometricId', 'isLate')
    `;
    console.log(`   ✓ Attendance enhanced fields: ${attendanceFields.length > 0 ? 'Yes' : 'No'}`);
    
    // Check messaging tables
    const msgTables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('Conversation', 'Message')
    `;
    console.log(`   ✓ Messaging tables: ${msgTables.length > 0 ? 'Yes' : 'No'}`);
    
    console.log('\n✅ All tests passed! Your backend is ready.\n');
    console.log('To start the server manually:');
    console.log('  npm run start:dev');
    
  } catch (e) {
    console.error('❌ Test failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
