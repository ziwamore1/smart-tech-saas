import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConstraintsService {
  constructor(private prisma: PrismaService) {}

  async getConstraints(schoolId: string) {
    const existing = await this.prisma.timetableConstraint.findUnique({
      where: { schoolId },
    });

    if (!existing) {
      return this.prisma.timetableConstraint.create({
        data: {
          schoolId,
          maxLessonsPerTeacherPerDay: 6,
          maxSubjectPerDay: 5,
          maxConsecutivePeriods: 4,
          allowDoublePeriods: true,
        },
      });
    }

    return existing;
  }

  async saveConstraints(schoolId: string, data: any) {
    return this.prisma.timetableConstraint.upsert({
      where: { schoolId },

      update: {
        maxLessonsPerTeacherPerDay: data.maxLessonsPerTeacherPerDay,
        maxSubjectPerDay: data.maxSubjectPerDay,
        maxConsecutivePeriods: data.maxConsecutivePeriods,
        allowDoublePeriods: data.allowDoublePeriods,
      },

      create: {
        schoolId,
        maxLessonsPerTeacherPerDay: data.maxLessonsPerTeacherPerDay,
        maxSubjectPerDay: data.maxSubjectPerDay,
        maxConsecutivePeriods: data.maxConsecutivePeriods,
        allowDoublePeriods: data.allowDoublePeriods,
      },
    });
  }
}
