import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassSubjectService {
  constructor(private prisma: PrismaService) {}

  async addSubjectToClass(classId: string, subjectId: string, schoolId: string) {
    const classEntity = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.schoolId !== schoolId) throw new NotFoundException('Class not found');

    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.schoolId !== schoolId) throw new NotFoundException('Subject not found');

    const existing = await this.prisma.classSubject.findFirst({
      where: { classId, subjectId },
    });
    if (existing) throw new ConflictException('Subject already assigned to this class');

    return this.prisma.classSubject.create({
      data: { classId, subjectId, schoolId },
      include: { subject: true, class: true },
    });
  }

  async removeSubjectFromClass(classId: string, subjectId: string, schoolId: string) {
    const classSubject = await this.prisma.classSubject.findFirst({
      where: { classId, subjectId, schoolId },
    });
    if (!classSubject) throw new NotFoundException('Subject not assigned to this class');

    return this.prisma.classSubject.delete({ where: { id: classSubject.id } });
  }

  async getSubjectsByClass(classId: string, schoolId: string, termId?: string) {
    const classEntity = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.schoolId !== schoolId) throw new NotFoundException('Class not found');

    const where: any = { classId };
    if (termId) {
      where.subject = {
        assessmentConfigs: {
          some: { classId, termId },
        },
      };
    }

    return this.prisma.classSubject.findMany({
      where,
      include: { subject: true },
      orderBy: { subject: { name: 'asc' } },
    });
  }

  async getClassesBySubject(subjectId: string, schoolId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.schoolId !== schoolId) throw new NotFoundException('Subject not found');

    return this.prisma.classSubject.findMany({
      where: { subjectId },
      include: { class: true },
      orderBy: { class: { order: 'asc' } },
    });
  }

  async getAllClassSubjects(schoolId: string) {
    return this.prisma.classSubject.findMany({
      where: { schoolId },
      include: {
        class: true,
        subject: true,
      },
      orderBy: [
        { class: { order: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });
  }
}
