import { ForbiddenException } from '@nestjs/common';
import { ClassAccessService } from './class-access.service';

describe('ClassAccessService', () => {
  const prisma: any = {
    class: { findUnique: jest.fn(), findMany: jest.fn() },
    subject: { findUnique: jest.fn(), findMany: jest.fn() },
    academicYear: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    teachingAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    classTeacherAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
    classSubject: { findMany: jest.fn() },
    schoolUser: { findFirst: jest.fn() },
    userPermissionOverride: { findMany: jest.fn() },
    resultEntryPermission: { findMany: jest.fn() },
  };
  let service: ClassAccessService;

  const teacher = { id: 'teacher-a', schoolId: 'school-a', roles: ['Teacher'] };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassAccessService(prisma);
    prisma.schoolUser.findFirst.mockResolvedValue(null);
    prisma.userPermissionOverride.findMany.mockResolvedValue([]);
    prisma.class.findMany.mockResolvedValue([{ id: 'class-a' }]);
    prisma.subject.findMany.mockResolvedValue([{ id: 'subject-a' }]);
    prisma.academicYear.findMany.mockResolvedValue([{ id: 'year-a' }]);
  });

  it('allows a teacher with a matching class, subject, and year assignment', async () => {
    prisma.teachingAssignment.findFirst.mockResolvedValue({ id: 'assignment-a' });

    await expect(service.assertCanEnterResults(
      teacher, 'class-a', 'subject-a', 'year-a',
    )).resolves.toBe(true);
  });

  it('allows a teacher without a teaching assignment', async () => {
    prisma.teachingAssignment.findFirst.mockResolvedValue(null);

    await expect(service.assertCanEnterResults(
      teacher, 'class-a', 'subject-a', 'year-a',
    )).resolves.toBe(true);
    expect(prisma.teachingAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('allows a teacher assigned to a different class or subject', async () => {
    prisma.teachingAssignment.findFirst.mockResolvedValue({ id: 'assignment-b' });

    await expect(service.assertCanEnterResults(
      teacher, 'class-a', 'subject-a', 'year-a',
    )).resolves.toBe(true);
  });

  it.each(['Head Teacher', 'Primary Teacher', 'Senior Teacher', 'Lecturer', 'Vice Chancellor'])(
    'allows teaching role %s without a teaching assignment',
    async (role) => {
      await expect(service.assertCanEnterResults(
        { id: 'teacher-a', schoolId: 'school-a', roles: [role] },
        'class-a', 'subject-a', 'year-a',
      )).resolves.toBe(true);
    },
  );

  it('rejects cross-school class access', async () => {
    prisma.class.findMany.mockResolvedValue([]);

    await expect(service.assertCanEnterResults(
      teacher, 'class-b', 'subject-a', 'year-a',
    )).rejects.toThrow('different school');
    expect(prisma.teachingAssignment.findFirst).not.toHaveBeenCalled();
  });

  it('rejects non-teaching staff', async () => {
    await expect(service.assertCanEnterResults(
      { id: 'accountant-a', schoolId: 'school-a', roles: ['Accountant'] },
      'class-a', 'subject-a', 'year-a',
    )).rejects.toThrow('Non-teaching staff');
  });

  it('returns all school classes to a teacher for discovery', async () => {
    prisma.class.findMany.mockResolvedValue([{ id: 'class-a', name: 'Grade 8A' }]);

    await expect(service.teachingClasses(teacher)).resolves.toEqual([{ id: 'class-a', name: 'Grade 8A' }]);
    expect(prisma.teachingAssignment.findMany).not.toHaveBeenCalled();
  });

  it('validates a batch of scopes with one lookup per entity type', async () => {
    prisma.class.findMany.mockResolvedValue([{ id: 'class-a' }, { id: 'class-b' }]);
    prisma.subject.findMany.mockResolvedValue([{ id: 'subject-a' }, { id: 'subject-b' }]);
    prisma.academicYear.findMany.mockResolvedValue([{ id: 'year-a' }]);

    await expect(service.assertCanEnterResultsBatch(teacher, [
      { classId: 'class-a', subjectId: 'subject-a', academicYearId: 'year-a' },
      { classId: 'class-b', subjectId: 'subject-b', academicYearId: 'year-a' },
    ])).resolves.toBe(true);

    expect(prisma.class.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.subject.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.academicYear.findMany).toHaveBeenCalledTimes(1);
  });

  it('allows a delegated teacher with RESULTS_DELEGATED_ENTRY', async () => {
    prisma.schoolUser.findFirst.mockResolvedValue({ id: 'membership-a', SchoolRoleAssignment: [] });
    prisma.userPermissionOverride.findMany.mockResolvedValue([{ permission: 'RESULTS_DELEGATED_ENTRY', granted: true }]);
    prisma.resultEntryPermission.findMany.mockResolvedValue([
      { classId: 'class-a', subjectId: 'subject-a', academicYearId: 'year-a' },
    ]);

    await expect(service.assertCanEnterResults(
      { id: 'staff-a', schoolId: 'school-a', roles: ['Consultant'] },
      'class-a', 'subject-a', 'year-a',
    )).resolves.toBe(true);
  });
});
