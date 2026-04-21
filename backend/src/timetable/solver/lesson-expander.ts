import { LessonRequirement, Lesson } from './types';

export function expandLessons(requirements: LessonRequirement[]): Lesson[] {
  const lessons: Lesson[] = [];

  for (const req of requirements) {
    for (let i = 0; i < req.lessonsPerWeek; i++) {
      lessons.push({
        classId: req.classId,
        subjectId: req.subjectId,
        teacherId: req.teacherId,
      });
    }
  }

  return lessons;
}
