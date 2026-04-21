import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SchoolService {
  private readonly logger = new Logger(SchoolService.name);

  constructor(
    private prisma: PrismaService,
    private unifiedMessaging: UnifiedMessagingService,
    private configService: ConfigService,
  ) {}

  async registerSchool(dto: RegisterSchoolDto) {
    const school = await this.prisma.school.create({
      data: {
        name: dto.schoolName,
        email: dto.email,
        phone: dto.phone,
      },
    });

    const temporaryPassword = 'ChangeMe123';

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const directorRole = await this.prisma.role.findFirst({
      where: {
        name: {
          equals: 'Director',
          mode: 'insensitive',
        },
      },
    });

    if (!directorRole) {
      throw new Error('Director role not found');
    }

    const director = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: 'School',
        lastName: 'Director',
        schoolId: school.id,
      },
    });

    await this.prisma.userRole.create({
      data: {
        userId: director.id,
        roleId: directorRole.id,
      },
    });

    await this.initializeSchool(school.id);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const schoolUrl = `${frontendUrl}/login?school=${school.id}`;

    this.unifiedMessaging
      .sendDirectorWelcome(
        {
          id: director.id,
          email: director.email,
          firstName: director.firstName,
          lastName: director.lastName,
        },
        { username: dto.email, password: temporaryPassword },
        { name: school.name, url: schoolUrl },
      )
      .catch((err) => this.logger.error('Failed to send director welcome message:', err));

    return {
      message: 'School registered successfully',
      schoolId: school.id,
      directorLogin: dto.email,
      temporaryPassword: temporaryPassword,
    };
  }

  async initializeSchool(schoolId: string) {
    const academicYear = await this.prisma.academicYear.create({
      data: {
        name: '2026',
        schoolId: schoolId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        isCurrent: true,
      },
    });

    await this.prisma.term.createMany({
      data: [
        {
          name: 'Term 1',
          academicYearId: academicYear.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-04-30'),
          isCurrent: true,
        },
        {
          name: 'Term 2',
          academicYearId: academicYear.id,
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-08-31'),
        },
        {
          name: 'Term 3',
          academicYearId: academicYear.id,
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-12-31'),
        },
      ],
    });

    const levelType = await this.prisma.levelType.create({
      data: {
        name: 'Grade',
        schoolId: schoolId,
      },
    });

    await this.prisma.class.createMany({
      data: [
        { name: 'Grade 1', order: 1, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 2', order: 2, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 3', order: 3, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 4', order: 4, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 5', order: 5, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 6', order: 6, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 7', order: 7, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 8', order: 8, levelTypeId: levelType.id, schoolId: schoolId },
        { name: 'Grade 9', order: 9, levelTypeId: levelType.id, schoolId: schoolId },
      ],
    });

    const gradingSystem = await this.prisma.gradingSystem.create({
      data: {
        name: 'ECZ Point Grading System',
        schoolId,
        isDefault: true,
      },
    });
    await this.prisma.gradeScale.createMany({
      data: [
        {
          gradingSystemId: gradingSystem.id,
          minScore: 75,
          maxScore: 100,
          grade: '1',
          remark: 'Distinction',
          points: 1,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 70,
          maxScore: 74,
          grade: '2',
          remark: 'Distinction',
          points: 2,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 65,
          maxScore: 69,
          grade: '3',
          remark: 'Merit',
          points: 3,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 60,
          maxScore: 64,
          grade: '4',
          remark: 'Merit',
          points: 4,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 55,
          maxScore: 59,
          grade: '5',
          remark: 'Credit',
          points: 5,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 50,
          maxScore: 54,
          grade: '6',
          remark: 'Credit',
          points: 6,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 45,
          maxScore: 49,
          grade: '7',
          remark: 'Pass',
          points: 7,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 40,
          maxScore: 44,
          grade: '8',
          remark: 'Pass',
          points: 8,
        },
        {
          gradingSystemId: gradingSystem.id,
          minScore: 0,
          maxScore: 39,
          grade: '9',
          remark: 'Fail',
          points: 9,
        },
      ],
    });
  }
  async updateBranding(
    schoolId: string,
    data: {
      logo?: string;
      motto?: string;
      address?: string;
      primaryColor?: string;
      directorSignature?: string;
      schoolStamp?: string;
    },
  ) {
    return this.prisma.school.update({
      where: { id: schoolId },
      data,
    });
  }

  async getProfile(schoolId: string) {
    if (!schoolId) {
      return null;
    }
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        logo: true,
        motto: true,
        primaryColor: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(
    schoolId: string,
    data: { name?: string; email?: string; phone?: string; address?: string },
  ) {
    if (!schoolId) {
      throw new Error('School ID is required');
    }
    return this.prisma.school.update({
      where: { id: schoolId },
      data,
    });
  }

  async getStats(schoolId: string) {
    if (!schoolId) {
      return {
        totalStudents: 0,
        totalTeachers: 0,
        totalClasses: 0,
        totalSubjects: 0,
        studentsByClass: [],
      };
    }

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
    });

    const [totalStudents, totalTeachers, totalClasses, totalSubjects, classes] =
      await Promise.all([
        this.prisma.student.count({ where: { schoolId } }),
        this.prisma.teacher.count({ where: { schoolId } }),
        this.prisma.class.count({ where: { schoolId } }),
        this.prisma.subject.count({ where: { schoolId } }),
        this.prisma.class.findMany({
          where: { schoolId },
          orderBy: { order: 'asc' },
        }),
      ]);

    let studentsByClass: { classId: string; className: string; count: number }[] = [];

    if (academicYear) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          schoolId,
          academicYearId: academicYear.id,
          status: 'ACTIVE',
        },
        select: {
          classId: true,
        },
      });

      const countByClass = enrollments.reduce((acc, e) => {
        acc[e.classId] = (acc[e.classId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      studentsByClass = classes.map((c) => ({
        classId: c.id,
        className: c.name,
        count: countByClass[c.id] || 0,
      }));
    }

    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      totalSubjects,
      studentsByClass,
    };
  }
}
