import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentSubjectService {
  private readonly logger = new Logger(StudentSubjectService.name);

  constructor(private prisma: PrismaService) {}

  async getStudentSubjects(studentId: string) {
    return this.prisma.studentSubject.findMany({
      where: { studentId, isActive: true },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });
  }

  async getClassSubjectsForStudent(studentId: string, classId: string) {
    const explicit = await this.prisma.studentSubject.findMany({
      where: { studentId, classId, isActive: true },
      select: { subjectId: true },
    });
    if (explicit.length > 0) {
      return explicit.map(e => e.subjectId);
    }
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId },
      select: { subjectId: true },
    });
    return classSubjects.map(cs => cs.subjectId);
  }

  async getClassSubjectsForStudents(studentIds: string[], classId: string) {
    const explicit = await this.prisma.studentSubject.findMany({
      where: { studentId: { in: studentIds }, classId, isActive: true },
      select: { studentId: true, subjectId: true },
    });
    const explicitMap = new Map<string, string[]>();
    for (const e of explicit) {
      const arr = explicitMap.get(e.studentId) ?? [];
      arr.push(e.subjectId);
      explicitMap.set(e.studentId, arr);
    }
    const hasAnyExplicit = explicit.length > 0;
    if (hasAnyExplicit) {
      return explicitMap;
    }
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { classId },
      select: { subjectId: true },
    });
    const allIds = classSubjects.map(cs => cs.subjectId);
    const result = new Map<string, string[]>();
    for (const sid of studentIds) {
      result.set(sid, allIds);
    }
    return result;
  }

  async assignSubjects(studentId: string, subjectIds: string[], classId: string, schoolId: string, academicYearId?: string) {
    await this.prisma.$transaction(async tx => {
      await tx.studentSubject.updateMany({
        where: { studentId, classId, isActive: true },
        data: { isActive: false },
      });
      if (subjectIds.length > 0) {
        await tx.studentSubject.createMany({
          data: subjectIds.map(subjectId => ({
            studentId,
            subjectId,
            classId,
            schoolId,
            academicYearId: academicYearId ?? null,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }
    });
    return this.getStudentSubjects(studentId);
  }

  async bulkAssign(classId: string, assignments: Array<{ studentId: string; subjectIds: string[] }>, schoolId: string, academicYearId?: string) {
    await this.prisma.$transaction(async tx => {
      const studentIds = assignments.map(a => a.studentId);
      await tx.studentSubject.updateMany({
        where: { studentId: { in: studentIds }, classId, isActive: true },
        data: { isActive: false },
      });
      const data: Array<{
        studentId: string;
        subjectId: string;
        classId: string;
        schoolId: string;
        academicYearId: string | null;
        isActive: boolean;
      }> = [];
      for (const a of assignments) {
        for (const subjectId of a.subjectIds) {
          data.push({
            studentId: a.studentId,
            subjectId,
            classId,
            schoolId,
            academicYearId: academicYearId ?? null,
            isActive: true,
          });
        }
      }
      if (data.length > 0) {
        await tx.studentSubject.createMany({ data, skipDuplicates: true });
      }
    });
    return this.getClassSubjectAssignments(classId);
  }

  async getClassSubjectAssignments(classId: string) {
    const assignments = await this.prisma.studentSubject.findMany({
      where: { classId, isActive: true },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { subject: { name: 'asc' } }],
    });
    return assignments;
  }

  async getStudentsWithoutSubjects(classId: string) {
    const enrolled = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { studentId: true },
    });
    const enrolledIds = enrolled.map(e => e.studentId);
    const assigned = await this.prisma.studentSubject.findMany({
      where: { classId, isActive: true },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    const assignedSet = new Set(assigned.map(a => a.studentId));
    const missingIds = enrolledIds.filter(id => !assignedSet.has(id));
    if (missingIds.length === 0) return [];
    return this.prisma.student.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true },
    });
  }

  async unassignSubject(studentId: string, subjectId: string, classId: string) {
    await this.prisma.studentSubject.updateMany({
      where: { studentId, subjectId, classId, isActive: true },
      data: { isActive: false },
    });
  }

  async hasExplicitAssignments(studentId: string, classId: string) {
    const count = await this.prisma.studentSubject.count({
      where: { studentId, classId, isActive: true },
    });
    return count > 0;
  }
}
