import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DirectorService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(user: any) {
    const schoolId = user.schoolId;

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const studentsCount = await this.prisma.student.count({
      where: { schoolId },
    });

    const teachersCount = await this.prisma.teacher.count({
      where: { schoolId },
    });

    const classesCount = await this.prisma.class.count({
      where: { schoolId },
    });

    return {
      schoolName: school?.name,
      subscriptionStatus: school?.subscriptionStatus,
      totalStudents: studentsCount,
      totalTeachers: teachersCount,
      totalClasses: classesCount,
    };
  }
}
