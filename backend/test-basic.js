const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing SmartTech Backend API...\n');
  
  try {
    const schoolCount = await prisma.school.count();
    console.log('✓ Database connected. Schools:', schoolCount);
    
    const users = await prisma.user.findMany({ take: 3 });
    console.log('✓ Users found:', users.length);
    
    const [students, teachers, classes, subjects, terms] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.class.count(),
      prisma.subject.count(),
      prisma.term.count()
    ]);
    console.log('\nData summary:');
    console.log('- Students:', students);
    console.log('- Teachers:', teachers);
    console.log('- Classes:', classes);
    console.log('- Subjects:', subjects);
    console.log('- Terms:', terms);
    
    console.log('\n✅ Basic tests passed!');
  } catch (e) {
    console.error('❌ Test failed:', e.message);
  } finally {
    prisma.$disconnect();
  }
}

main();
