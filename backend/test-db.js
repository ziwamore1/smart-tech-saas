const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

async function test() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('✓ Connected!\n');
    
    console.log('Testing read operations...');
    const schools = await prisma.school.findMany({ take: 1 });
    console.log('  Schools:', schools.length);
    
    const users = await prisma.user.findMany({ take: 3 });
    console.log('  Users:', users.length);
    
    const students = await prisma.student.count();
    console.log('  Students:', students);
    
    const teachers = await prisma.teacher.count();
    console.log('  Teachers:', teachers);
    
    console.log('\n✓ All database tests passed!');
    
    // Test new tables
    console.log('\nTesting new tables...');
    const exams = await prisma.exam.count();
    const convs = await prisma.conversation.count();
    console.log('  Exams:', exams);
    console.log('  Conversations:', convs);
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

test();
