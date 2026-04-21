import { generateTimetable, GenerateTimetableRequest } from '../../entities/api';

const testRequest: GenerateTimetableRequest = {
  classes: [
    { id: 'class-9a', name: 'Grade 9A', capacity: 35 },
    { id: 'class-9b', name: 'Grade 9B', capacity: 35 },
  ],
  teachers: [
    { id: 'teacher-smith', name: 'Mrs. Smith', email: 'smith@school.edu', subjects: ['math'] },
    { id: 'teacher-jones', name: 'Mr. Jones', email: 'jones@school.edu', subjects: ['eng'] },
    { id: 'teacher-wilson', name: 'Mrs. Wilson', email: 'wilson@school.edu', subjects: ['phys'] },
  ],
  subjects: [
    { id: 'math', name: 'Mathematics', code: 'MATH' },
    { id: 'eng', name: 'English', code: 'ENG' },
    { id: 'phys', name: 'Physics', code: 'PHY', requiresLab: true },
  ],
  rooms: [
    { id: 'room-101', name: 'Room 101', capacity: 35 },
    { id: 'lab-phys', name: 'Physics Lab', capacity: 24, type: 'lab' },
  ],
  lessons: [
    { id: 'les-1', classId: 'class-9a', subjectId: 'math', teacherId: 'teacher-smith', requiredPerWeek: 4 },
    { id: 'les-2', classId: 'class-9a', subjectId: 'eng', teacherId: 'teacher-jones', requiredPerWeek: 3 },
    { id: 'les-3', classId: 'class-9a', subjectId: 'phys', teacherId: 'teacher-wilson', requiredPerWeek: 2 },
    { id: 'les-4', classId: 'class-9b', subjectId: 'math', teacherId: 'teacher-smith', requiredPerWeek: 4 },
    { id: 'les-5', classId: 'class-9b', subjectId: 'eng', teacherId: 'teacher-jones', requiredPerWeek: 3 },
  ],
};

async function testTimetableGeneration() {
  console.log('🧪 Testing timetable generation...\n');
  
  const startTime = Date.now();
  
  try {
    const result = await generateTimetable(testRequest);
    
    const duration = Date.now() - startTime;
    
    console.log('✅ Success:', result.success);
    console.log('📊 Schedule entries:', result.schedule.length);
    console.log('📈 Score:', result.score);
    console.log('⏱️ Duration:', duration, 'ms');
    console.log('⚠️ Warnings:', result.warnings.length);
    console.log('❌ Errors:', result.errors.length);
    
    if (result.schedule.length > 0) {
      console.log('\n📅 Sample entries:');
      result.schedule.slice(0, 5).forEach((entry, i) => {
        console.log(`  ${i + 1}. ${entry.lessonId} → ${entry.timeslotId}`);
      });
    }
    
    return result.success;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testTimetableGeneration()
  .then(success => {
    console.log('\n' + (success ? '✅ All tests passed!' : '❌ Tests failed'));
    process.exit(success ? 0 : 1);
  });