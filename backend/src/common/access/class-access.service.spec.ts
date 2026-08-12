import { ForbiddenException } from '@nestjs/common';
import { ClassAccessService } from './class-access.service';

describe('ClassAccessService', () => {
  const prisma: any = {
    class: { findUnique: jest.fn(), findMany: jest.fn() },
    subject: { findUnique: jest.fn() },
    academicYear: { findUnique: jest.fn(), findFirst: jest.fn() },
    teachingAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    classTeacherAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    classSubject: { findMany: jest.fn() },
  };
  let service: ClassAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassAccessService(prisma);
  });

  it('allows a teacher with a matching class, subject, and year assignment', async () => {
    prisma.class.findUnique.mockResolvedValue({ id: 'class-a', schoolId: 'school-a' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-a', schoolId: 'school-a' });
    prisma.academicYear.findUnique.mockResolvedValue({ id: 'year-a', schoolId: 'school-a' });
    prisma.teachingAssignment.findFirst.mockResolvedValue({ id: 'assignment-a' });
    prisma.classTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(service.assertCanEnterResults(
      { id: 'teacher-a', schoolId: 'school-a', roles: ['Teacher'] },
      'class-a', 'subject-a', 'year-a',
    )).resolves.toBe(true);
  });

  it('rejects a teacher assigned to a different class or subject', async () => {
    prisma.class.findUnique.mockResolvedValue({ id: 'class-a', schoolId: 'school-a' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-a', schoolId: 'school-a' });
    prisma.academicYear.findUnique.mockResolvedValue({ id: 'year-a', schoolId: 'school-a' });
    prisma.teachingAssignment.findFirst.mockResolvedValue(null);
    prisma.classTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(service.assertCanEnterResults(
      { id: 'teacher-a', schoolId: 'school-a', roles: ['Teacher'] },
      'class-a', 'subject-a', 'year-a',
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects cross-school class access before checking assignments', async () => {
    prisma.class.findUnique.mockResolvedValue({ id: 'class-b', schoolId: 'school-b' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-a', schoolId: 'school-a' });
    prisma.academicYear.findUnique.mockResolvedValue({ id: 'year-a', schoolId: 'school-a' });

    await expect(service.assertCanEnterResults(
      { id: 'teacher-a', schoolId: 'school-a', roles: ['Teacher'] },
      'class-b', 'subject-a', 'year-a',
    )).rejects.toThrow('different school');
    expect(prisma.teachingAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('returns only a teacher\'s assigned classes for teaching discovery', async () => {
    prisma.teachingAssignment.findMany.mockResolvedValue([{ classId: 'class-a' }]);
    prisma.classTeacherAssignment.findMany.mockResolvedValue([]);
    prisma.class.findMany.mockResolvedValue([{ id: 'class-a', name: 'Grade 8A' }]);

    await expect(service.teachingClasses({ id: 'teacher-a', schoolId: 'school-a', roles: ['Teacher'] }))
      .resolves.toEqual([{ id: 'class-a', name: 'Grade 8A' }]);
    expect(prisma.class.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { schoolId: 'school-a', id: { in: ['class-a'] } },
    }));
  });
});
