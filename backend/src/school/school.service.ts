import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterSchoolDto } from './dto/register-school.dto';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import { GradingSystemService } from '../grading-system/grading-system.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { InstitutionProvisioningService } from '../institution/institution-provisioning.service';

@Injectable()
export class SchoolService {
  private readonly logger = new Logger(SchoolService.name);

  constructor(
    private prisma: PrismaService,
    private unifiedMessaging: UnifiedMessagingService,
    private configService: ConfigService,
    private gradingSystemService: GradingSystemService,
    private provisioningService: InstitutionProvisioningService,
  ) {}

  async registerSchool(dto: RegisterSchoolDto) {
    const institutionTypeCode = dto.institutionType || 'PRIMARY_SCHOOL';
    const institutionType = await this.prisma.institutionType.findUnique({
      where: { code: institutionTypeCode as any },
    });

    const school = await this.prisma.school.create({
      data: {
        name: dto.schoolName,
        email: dto.email,
        phone: dto.phone,
        institutionTypeId: institutionType?.id,
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

    await this.initializeSchool(school.id, institutionTypeCode);

    if (institutionType) {
      await this.provisioningService.provisionInstitution(school.id, institutionTypeCode);
    }

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

  async initializeSchool(schoolId: string, institutionTypeCode: string = 'PRIMARY_SCHOOL') {
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

    const typeLabel = this.getLabelForInstitutionType(institutionTypeCode);
    const levelType = await this.prisma.levelType.create({
      data: {
        name: typeLabel,
        schoolId: schoolId,
      },
    });

    const classes = this.getClassesForInstitutionType(institutionTypeCode, levelType.id, schoolId);
    await this.prisma.class.createMany({ data: classes });

    await this.gradingSystemService.seedDefaultGradingSystems(schoolId);

    await this.prisma.schoolSetting.create({
      data: {
        schoolId,
        startTime: '07:30',
        periodDuration: 40,
        periodsPerDay: 7,
        daysPerWeek: 5,
        breakAfterPeriod: 3,
      },
    });

    this.logger.log(`School ${schoolId} initialized with ${institutionTypeCode} structure`);
  }

  private getLabelForInstitutionType(typeCode: string): string {
    switch (typeCode) {
      case 'PRIMARY_SCHOOL': return 'Grade';
      case 'SECONDARY_SCHOOL': return 'Form';
      case 'ADVANCED_SECONDARY': return 'Form';
      case 'COLLEGE': return 'Year';
      case 'UNIVERSITY': return 'Year';
      default: return 'Grade';
    }
  }

  private getClassesForInstitutionType(typeCode: string, levelTypeId: string, schoolId: string): any[] {
    switch (typeCode) {
      case 'PRIMARY_SCHOOL':
        return [
          { name: 'Grade 1', order: 1, levelTypeId, schoolId },
          { name: 'Grade 2', order: 2, levelTypeId, schoolId },
          { name: 'Grade 3', order: 3, levelTypeId, schoolId },
          { name: 'Grade 4', order: 4, levelTypeId, schoolId },
          { name: 'Grade 5', order: 5, levelTypeId, schoolId },
          { name: 'Grade 6', order: 6, levelTypeId, schoolId },
          { name: 'Grade 7', order: 7, levelTypeId, schoolId },
        ];
      case 'SECONDARY_SCHOOL':
        return [
          { name: 'Form 1', order: 1, levelTypeId, schoolId },
          { name: 'Form 2', order: 2, levelTypeId, schoolId },
          { name: 'Form 3', order: 3, levelTypeId, schoolId },
          { name: 'Form 4', order: 4, levelTypeId, schoolId },
          { name: 'Form 5', order: 5, levelTypeId, schoolId },
        ];
      case 'ADVANCED_SECONDARY':
        return [
          { name: 'Lower 6', order: 1, levelTypeId, schoolId },
          { name: 'Upper 6', order: 2, levelTypeId, schoolId },
        ];
      case 'COLLEGE':
        return [
          { name: 'Year 1', order: 1, levelTypeId, schoolId },
          { name: 'Year 2', order: 2, levelTypeId, schoolId },
          { name: 'Year 3', order: 3, levelTypeId, schoolId },
        ];
      case 'UNIVERSITY':
        return [
          { name: 'Year 1', order: 1, levelTypeId, schoolId },
          { name: 'Year 2', order: 2, levelTypeId, schoolId },
          { name: 'Year 3', order: 3, levelTypeId, schoolId },
          { name: 'Year 4', order: 4, levelTypeId, schoolId },
        ];
      default:
        return [
          { name: 'Grade 1', order: 1, levelTypeId, schoolId },
          { name: 'Grade 2', order: 2, levelTypeId, schoolId },
          { name: 'Grade 3', order: 3, levelTypeId, schoolId },
          { name: 'Grade 4', order: 4, levelTypeId, schoolId },
          { name: 'Grade 5', order: 5, levelTypeId, schoolId },
          { name: 'Grade 6', order: 6, levelTypeId, schoolId },
          { name: 'Grade 7', order: 7, levelTypeId, schoolId },
        ];
    }
  }

  async getProfile(schoolId?: string) {
    console.log(`[SchoolService] getProfile called with schoolId: ${schoolId}`);
    if (!schoolId) {
      return null;
    }
    
    const school = await this.prisma.school.findUnique({
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
        institutionType: {
          select: { code: true, name: true },
        },
      },
    });
    
    console.log(`[SchoolService] getProfile result:`, JSON.stringify(school));
    return school;
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

  async getTimeSettings(schoolId: string) {
    console.log('[SchoolService] Getting time settings for school:', schoolId);
    let settings = await this.prisma.schoolSetting.findUnique({
      where: { schoolId },
    });
    console.log('[SchoolService] Time settings from DB:', JSON.stringify(settings));

    if (!settings) {
      console.log('[SchoolService] No settings found, creating defaults');
      settings = await this.prisma.schoolSetting.create({
        data: {
          schoolId,
          startTime: "07:30",
          periodDuration: 40,
          periodsPerDay: 7,
          daysPerWeek: 5,
          breakAfterPeriod: 3,
          breakDuration: 15,
          breaks: [],
          periodDurations: [],
        },
      });
      console.log('[SchoolService] Created defaults:', JSON.stringify(settings));
    }

    return {
      ...settings,
      breaks: typeof settings.breaks === "string" ? JSON.parse(settings.breaks) : (settings.breaks || []),
      periodDurations: typeof settings.periodDurations === "string" ? JSON.parse(settings.periodDurations) : (settings.periodDurations || []),
    };
  }

  async updateTimeSettings(
    schoolId: string,
    data: {
      startTime?: string;
      periodDuration?: number;
      periodsPerDay?: number;
      daysPerWeek?: number;
      breakAfterPeriod?: number;
      breakDuration?: number;
      breaks?: any[];
      periodDurations?: number[];
    }
  ) {
    console.log('[SchoolService] Updating time settings for school:', schoolId, JSON.stringify(data));
    const result = await this.prisma.schoolSetting.upsert({
      where: { schoolId },
      update: {
        ...(data.startTime && { startTime: data.startTime }),
        ...(data.periodDuration && { periodDuration: data.periodDuration }),
        ...(data.periodsPerDay && { periodsPerDay: data.periodsPerDay }),
        ...(data.daysPerWeek && { daysPerWeek: data.daysPerWeek }),
        ...(data.breakAfterPeriod !== undefined && { breakAfterPeriod: data.breakAfterPeriod }),
        ...(data.breakDuration && { breakDuration: data.breakDuration }),
        ...(data.breaks && { breaks: JSON.stringify(data.breaks) as any }),
        ...(data.periodDurations && { periodDurations: JSON.stringify(data.periodDurations) as any }),
      },
      create: {
        schoolId,
        startTime: data.startTime ?? "07:30",
        periodDuration: data.periodDuration ?? 40,
        periodsPerDay: data.periodsPerDay ?? 7,
        daysPerWeek: data.daysPerWeek ?? 5,
        breakAfterPeriod: data.breakAfterPeriod ?? 3,
        breakDuration: data.breakDuration ?? 15,
        breaks: data.breaks ? (JSON.stringify(data.breaks) as any) : null,
        periodDurations: data.periodDurations ? (JSON.stringify(data.periodDurations) as any) : null,
      },
    });
    console.log('[SchoolService] Upsert result:', JSON.stringify(result));
    return result;
  }
}
