import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationService } from '../communication/communication.service';
import { UnifiedMessagingService } from '../messaging/unified-messaging.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { InstitutionProvisioningService } from '../institution/institution-provisioning.service';
import { CacheService } from '../common/services/cache.service';
import { StaffSyncEngineService } from '../shared/staff-sync-engine/staff-sync-engine.service';

const STATS_CACHE_TTL = 300_000;
const STATS_CACHE_KEY = 'super-admin:system-stats';
const RESULTS_ANALYTICS_CACHE_KEY = 'super-admin:results-analytics';

function schoolAnalysisBands(systemName: string) {
  const name = systemName.toLowerCase();
  if (name.includes('grade 7')) return { quality: { labels: ['ONE', 'TWO', 'THREE'], points: [1, 2, 3], label: 'Grades One to Three' }, quantity: { labels: ['ONE', 'TWO', 'THREE', 'FOUR'], points: [1, 2, 3, 4], label: 'Grades One to Four' } };
  if (name.includes('secondary') || name.includes('ecz point')) return { quality: { labels: ['1', '2', '3', '4', '5', '6'], points: [1, 2, 3, 4, 5, 6], label: 'Grades/Points 1 to 6' }, quantity: { labels: ['1', '2', '3', '4', '5', '6', '7', '8'], points: [1, 2, 3, 4, 5, 6, 7, 8], label: 'Grades/Points 1 to 8' } };
  if (name.includes('forms')) return { quality: { labels: ['1', '2', '3'], points: [1, 2, 3], label: 'Grades/Points 1 to 3' }, quantity: { labels: ['1', '2', '3', '4'], points: [1, 2, 3, 4], label: 'Grades/Points 1 to 4' } };
  if (name.includes('university')) return { quality: { labels: ['A+', 'A', 'B+', 'B'], points: [4.5, 4, 3.5, 3], label: 'A+ to B' }, quantity: { labels: ['A+', 'A', 'B+', 'B', 'C+', 'C'], points: [4.5, 4, 3.5, 3, 2.5, 2], label: 'A+ to C' } };
  if (name.includes('college')) return { quality: { labels: ['A', 'B'], points: [4, 3], label: 'Grades A to B' }, quantity: { labels: ['A', 'B', 'C'], points: [4, 3, 2], label: 'Grades A to C' } };
  return { quality: { labels: ['A', 'B', 'C', 'D'], points: [5, 4, 3, 2], label: 'Grades/Points A=5 to D=2' }, quantity: { labels: ['A', 'B', 'C', 'D', 'E'], points: [5, 4, 3, 2, 1], label: 'Grades/Points A=5 to E=1' } };
}

function schoolBandIncludes(band: { labels: string[]; points: number[] }, grade: string | null, points: number | null) {
  return Boolean((grade && band.labels.includes(String(grade).trim().toUpperCase())) || (points != null && band.points.some(point => Math.abs(point - points) < 0.01)));
}

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private communicationService: CommunicationService,
    private unifiedMessaging: UnifiedMessagingService,
    private provisioningService: InstitutionProvisioningService,
    private cacheService: CacheService,
    private syncEngine: StaffSyncEngineService,
  ) {}

  async getAllSchools(status?: string, page = 1, limit = 50, search?: string) {
    const where: any = {};
    if (status) {
      where.subscriptionStatus = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    const skip = (page - 1) * limit;

    const [schools, total] = await this.prisma.$transaction([
      this.prisma.school.findMany({
        where,
        skip,
        take: limit,
        include: {
          institutionType: {
            select: { code: true, name: true },
          },
          _count: {
            select: {
              users: true,
              students: true,
              teachers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.school.count({ where }),
    ]);

    return {
      data: schools,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createSchool(data: {
    name: string;
    registrationNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    motto?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    institutionType?: string;
  }) {
    const existingSchool = await this.prisma.school.findFirst({
      where: {
        OR: [
          { name: data.name },
          data.registrationNumber
            ? { registrationNumber: data.registrationNumber }
            : {},
        ],
      },
    });

    if (existingSchool) {
      throw new BadRequestException(
        'School with this name or registration number already exists',
      );
    }

    let institutionTypeId: string | undefined;
    const institutionTypeCode = data.institutionType || 'PRIMARY_SCHOOL';

    const institutionType = await this.prisma.institutionType.findUnique({
      where: { code: institutionTypeCode as any },
    });

    if (institutionType) {
      institutionTypeId = institutionType.id;
    }

    const school = await this.prisma.school.create({
      data: {
        name: data.name,
        institutionTypeId,
        registrationNumber: data.registrationNumber,
        phone: data.phone,
        email: data.email,
        address: data.address,
        website: data.website,
        motto: data.motto,
        subscriptionTier: data.subscriptionTier || 'basic',
        subscriptionStatus: data.subscriptionStatus || 'trial',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.dashboardConfig.create({
      data: {
        schoolId: school.id,
      },
    });

    await this.prisma.timetableConstraint.create({
      data: {
        schoolId: school.id,
      },
    });

    if (institutionType) {
      this.provisioningService.provisionInstitution(school.id, institutionTypeCode)
        .catch((err) => this.logger.error(`Provisioning failed for school ${school.id}:`, err));
    }

    this.logger.log(`School created: ${school.id} - ${school.name} type: ${institutionTypeCode}`);
    return school;
  }

  async getSchoolById(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        institutionType: {
          select: { code: true, name: true },
        },
        users: {
          include: { userRoles: { include: { role: true } } },
        },
        _count: {
          select: {
            students: true,
            teachers: true,
            classes: true,
            subjects: true,
          },
        },
      },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }

  async updateSchool(schoolId: string, data: any) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (data.institutionType) {
      const instType = await this.prisma.institutionType.findUnique({
        where: { code: data.institutionType as any },
      });
      if (!instType) throw new NotFoundException('Institution type not found');
      data.institutionTypeId = instType.id;
      delete data.institutionType;

      if (school.institutionTypeId !== instType.id) {
        await this.provisioningService.provisionInstitution(schoolId, instType.code);
      }
    }

    return this.prisma.school.update({
      where: { id: schoolId },
      data,
    });
  }

  async updateSchoolSubscription(
    schoolId: string,
    data: {
      subscriptionStatus?: string;
      trialEndsAt?: Date;
      isActive?: boolean;
    },
  ) {
    return this.prisma.school.update({
      where: { id: schoolId },
      data,
    });
  }

  async activateSchool(schoolId: string) {
    return this.prisma.school.update({
      where: { id: schoolId },
      data: { isActive: true, subscriptionStatus: 'active' },
    });
  }

  async deactivateSchool(schoolId: string) {
    return this.prisma.school.update({
      where: { id: schoolId },
      data: { isActive: false },
    });
  }

  async deleteSchool(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    await this.prisma.school.delete({ where: { id: schoolId } });
    return { message: 'School deleted successfully' };
  }

  async createDirector(
    schoolId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { institutionType: true },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    if (!school.institutionType) {
      this.logger.warn(`School '${school.name}' has no institution type assigned - director creation will proceed without type info`);
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    let directorRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'Director', mode: 'insensitive' } },
    });

    if (!directorRole) {
      directorRole = await this.prisma.role.create({ data: { name: 'Director' } });
      this.logger.warn('Director role not found - auto-created during director creation');
    }

    const user = await this.prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: normalizedEmail,
        phone: data.phone,
        password: hashedPassword,
        schoolId: schoolId,
        userRoles: {
          create: { roleId: directorRole.id },
        },
      },
    });

    this.logger.log(`Director created for school ${schoolId}: ${user.id}`);

    // Auto-create Teacher record so Director appears in staff register and analytics
    const existingTeacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!existingTeacher) {
      const teacher = await this.prisma.teacher.create({
        data: {
          userId: user.id,
          schoolId,
          staffType: 'TEACHING',
        },
      });
      this.syncEngine.syncStaffProfile(teacher.id, schoolId)
        .then(result => this.logger.log(`Auto-sync to HR profile for director: created=${result.created}`))
        .catch(err => this.logger.error(`Auto-sync to HR profile failed for director: ${err.message}`));
    }

    // Ensure SchoolUser membership exists
    const existingMembership = await this.prisma.schoolUser.findFirst({
      where: { userId: user.id, schoolId },
    });
    if (!existingMembership) {
      const membership = await this.prisma.schoolUser.create({
        data: { userId: user.id, schoolId, isPrimary: true },
      });
      await this.prisma.schoolRoleAssignment.create({
        data: { schoolMembershipId: membership.id, role: 'Director', isActive: true },
      });
    }

    this.unifiedMessaging
      .sendDirectorWelcome(
        {
          id: user.id,
          email: user.email,
          phone: user.phone || undefined,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        { username: normalizedEmail, password: data.password },
        { name: school.name, url: `${this.configService.get<string>('FRONTEND_URL')}/login?school=${schoolId}`, type: school.institutionType?.code || 'PRIMARY_SCHOOL' },
      )
      .catch((err) => this.logger.error('Failed to send director welcome message:', err));

    return {
      id: user.id,
      email: user.email,
      schoolId,
      schoolName: school.name,
      institutionType: school.institutionType?.code || null,
      message: 'Director account created successfully',
    };
  }

  async getSchoolDirectors(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const directorRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'Director', mode: 'insensitive' } },
    });

    if (!directorRole) {
      return [];
    }

    const directors = await this.prisma.user.findMany({
      where: {
        schoolId,
        userRoles: {
          some: { roleId: directorRole.id },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    return directors;
  }

  async sendSchoolLink(
    schoolId: string,
    directorId: string,
    method: 'email' | 'whatsapp' | 'both',
  ) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const director = await this.prisma.user.findUnique({
      where: { id: directorId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!director) {
      throw new NotFoundException('Director not found');
    }

    const isDirector = director.userRoles.some(
      (ur) => ur.role.name === 'Director',
    );
    if (!isDirector) {
      throw new BadRequestException('User is not a director');
    }

    const baseUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const schoolLink = `${baseUrl}/login?school=${school.id}`;

    const emailContent = `
Dear ${director.firstName} ${director.lastName},

Your school "${school.name}" has been registered on Smart Tech SaaS System.

Your login credentials:
Email: ${director.email}
Password: (Set by admin)

Access your dashboard: ${schoolLink}

Best regards,
Smart Tech Admin
    `.trim();

    const whatsappMessage = `Hello ${director.firstName},

Your school "${school.name}" has been registered on Smart Tech SaaS System.

Login here: ${schoolLink}

Email: ${director.email}
    `.trim();

    const results: any = { school, director, schoolLink };

    if (method === 'email' || method === 'both') {
      this.logger.log(`Email would be sent to ${director.email}`);
      results.email = {
        to: director.email,
        subject: `Welcome to Smart Tech - ${school.name}`,
        content: emailContent,
      };
      await this.communicationService.sendSystemEmail(
        director.email,
        `Welcome to Smart Tech - ${school.name}`,
        emailContent,
      );
    }

    if (method === 'whatsapp' || method === 'both') {
      if (director.phone) {
        await this.communicationService.sendSystemWhatsApp(director.phone, whatsappMessage);
        this.logger.log(`[WhatsApp] Sending to ${director.phone}`);
      } else {
        results.whatsapp = { error: 'No phone number available' };
      }
    }

    return {
      message: 'School link sent successfully',
      ...results,
    };
  }

  private async sendEmail(to: string, subject: string, content: string) {
    try {
      const result = await this.communicationService.sendSystemEmail(to, subject, content);
      if (result.success) {
        this.logger.log(`[Email] Sent to ${to}: ${subject}`);
      } else {
        this.logger.error(`[Email] Failed to send to ${to}: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`[Email] Failed to send to ${to}:`, error);
    }
  }

  private async sendWhatsApp(phone: string, message: string) {
    try {
      const result = await this.communicationService.sendSystemWhatsApp(phone, message);
      if (result.success) {
        this.logger.log(`[WhatsApp] Sent to ${phone}`);
      } else {
        this.logger.error(`[WhatsApp] Failed to send to ${phone}: ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`[WhatsApp] Failed to send to ${phone}:`, error);
    }
  }

  async getAllAuditLogs(schoolId?: string, limit: number = 100) {
    return this.prisma.auditLog.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
  }

  async getSystemStats() {
    const cached = this.cacheService.get<any>(STATS_CACHE_KEY);
    if (cached) {
      this.logger.log('Returning cached system stats');
      return cached;
    }

    this.logger.log('Computing system stats (uncached)');

    const [
      totalSchools,
      activeSchools,
      totalStudents,
      totalTeachers,
      totalUsers,
      educationLevels,
      schoolsByStatus,
      recentSchools,
      totalTemplates,
      totalMarketplace,
      totalAssets,
      totalSignatures,
      totalStamps,
      totalBrandPresets,
      totalCertificates,
      totalAISuggestions,
      templatesByType,
      templatesByStatus,
      stampsByType,
      assetsByType,
      recentTemplates,
    ] = await this.prisma.$transaction([
      this.prisma.school.count(),
      this.prisma.school.count({ where: { isActive: true } }),
      this.prisma.student.count(),
      this.prisma.teacher.count(),
      this.prisma.user.count(),
      this.prisma.schoolEducationLevel.findMany({
        where: {
          educationLevel: { code: { in: ['PRIMARY', 'ECE'] } },
          isActive: true,
        },
        select: { schoolId: true },
      }),
      this.prisma.school.groupBy({
        by: ['subscriptionStatus'],
        _count: { subscriptionStatus: true },
      }),
      this.prisma.school.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          subscriptionStatus: true,
          isActive: true,
          createdAt: true,
          _count: { select: { students: true, teachers: true } },
        },
      }),
      this.prisma.reportTemplate.count(),
      this.prisma.templateMarketplace.count(),
      this.prisma.templateAsset.count(),
      this.prisma.digitalSignature.count(),
      this.prisma.digitalStamp.count(),
      this.prisma.brandPreset.count(),
      this.prisma.certificateTemplate.count(),
      this.prisma.aITemplateSuggestion.count(),
      this.prisma.reportTemplate.groupBy({
        by: ['templateType'],
        _count: { templateType: true },
      }),
      this.prisma.reportTemplate.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.digitalStamp.groupBy({
        by: ['type'],
        _count: { type: true },
      }),
      this.prisma.templateAsset.groupBy({
        by: ['type'],
        _count: { type: true },
      }),
      this.prisma.reportTemplate.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          templateType: true,
          status: true,
          updatedAt: true,
          schoolId: true,
        },
      }),
    ]);

    const uniquePrimarySchoolIds = [...new Set(educationLevels.map((sel) => sel.schoolId))];
    const totalPrimarySchools = uniquePrimarySchoolIds.length;

    const [primaryStudents, primaryTeachers, primaryTeachingStaff, primaryNonTeachingStaff] =
      uniquePrimarySchoolIds.length > 0
        ? await this.prisma.$transaction([
            this.prisma.student.count({
              where: { schoolId: { in: uniquePrimarySchoolIds } },
            }),
            this.prisma.teacher.count({
              where: { schoolId: { in: uniquePrimarySchoolIds } },
            }),
            this.prisma.teacher.count({
              where: { schoolId: { in: uniquePrimarySchoolIds }, staffType: 'TEACHING' },
            }),
            this.prisma.teacher.count({
              where: { schoolId: { in: uniquePrimarySchoolIds }, staffType: 'NON_TEACHING' },
            }),
          ])
        : [0, 0, 0, 0];

    let enrollmentPipeline: { grade: string; count: number }[] = [];
    if (uniquePrimarySchoolIds.length > 0) {
      const primaryGradeNumbers = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'];

      const allClasses = await this.prisma.class.findMany({
        where: {
          schoolId: { in: uniquePrimarySchoolIds },
          OR: primaryGradeNumbers.map((g) => ({ name: { contains: g, mode: 'insensitive' as const } })),
        },
        select: { id: true, name: true },
      });

      const allClassIds = allClasses.map((c) => c.id);
      const enrollmentsByClassId = allClassIds.length > 0
        ? await this.prisma.enrollment.groupBy({
            by: ['classId'],
            where: { classId: { in: allClassIds }, status: 'ACTIVE' },
            _count: { classId: true },
          })
        : [];

      const enrollmentMap = new Map(enrollmentsByClassId.map((e) => [e.classId, e._count.classId]));

      enrollmentPipeline = primaryGradeNumbers.map((gradeName) => {
        const matchingClassIds = allClasses
          .filter((c) => c.name.toLowerCase().includes(gradeName.toLowerCase()))
          .map((c) => c.id);
        const count = matchingClassIds.reduce((sum, cid) => sum + (enrollmentMap.get(cid) || 0), 0);
        return { grade: gradeName, count };
      });
    }

    const recentPrimarySchools = uniquePrimarySchoolIds.length > 0
      ? await this.prisma.school.findMany({
          where: { id: { in: uniquePrimarySchoolIds } },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            subscriptionStatus: true,
            isActive: true,
            createdAt: true,
            _count: { select: { students: true, teachers: true } },
          },
        })
      : [];

    const result = {
      totalSchools,
      activeSchools,
      inactiveSchools: totalSchools - activeSchools,
      totalStudents,
      totalTeachers,
      totalUsers,
      totalTemplates,
      totalMarketplace,
      totalAssets,
      totalSignatures,
      totalStamps,
      totalBrandPresets,
      totalCertificates,
      totalAISuggestions,
      schoolsByStatus,
      recentSchools,
      templatesByType,
      templatesByStatus,
      stampsByType,
      assetsByType,
      recentTemplates,
      totalPrimarySchools,
      primaryStudents,
      primaryTeachers,
      primaryTeachingStaff,
      primaryNonTeachingStaff,
      enrollmentPipeline,
      recentPrimarySchools,
    };

    this.cacheService.set(STATS_CACHE_KEY, result, STATS_CACHE_TTL);
    return result;
  }

  async getResultsAnalytics() {
    const cached = this.cacheService.get<any>(RESULTS_ANALYTICS_CACHE_KEY);
    if (cached) {
      return cached;
    }

    this.logger.log('Computing results analytics (uncached)');

    const empty = {
      publishedSchools: 0,
      publishedClasses: 0,
      publishedResults: 0,
      gradeDistribution: [],
      scoreHistogram: [],
      schoolPerformance: [],
      subjectHeatmap: { schools: [], subjects: [], values: [] },
      overallQuality: { passed: 0, assessed: 0, rate: 0, belowStandard: 0, label: 'Class-based quality analysis' },
      overallQuantity: { passed: 0, assessed: 0, rate: 0, belowStandard: 0, label: 'Class-based quantity analysis' },
      qualityQuantityBySchool: [],
    };

    const publishedSheets = await this.prisma.resultSheet.findMany({
      where: { status: 'PUBLISHED' },
      select: { classId: true, termId: true, schoolId: true },
    });

    if (publishedSheets.length === 0) {
      return empty;
    }

    const schoolIds = [...new Set(publishedSheets.map((s) => s.schoolId))];
    const classIds = [...new Set(publishedSheets.map((s) => s.classId))];
    const termIds = [...new Set(publishedSheets.map((s) => s.termId))];

    const publishedSheetKeys = new Set(publishedSheets.map((s) => `${s.schoolId}|${s.classId}|${s.termId}`));
    const classes = await this.prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, gradingSystem: { select: { name: true, gradeScales: true } } },
    });
    const classMap = new Map(classes.map(cls => [cls.id, cls]));

    const computedResults = await this.prisma.computedResult.findMany({
      where: {
        schoolId: { in: schoolIds },
        classId: { in: classIds },
        termId: { in: termIds },
        status: { in: ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'] },
        finalPercentage: { not: null },
        student: { status: 'ACTIVE' },
      },
      select: { schoolId: true, classId: true, termId: true, finalPercentage: true, finalGrade: true, points: true },
    });
    const qualityRecords = computedResults.filter(result => publishedSheetKeys.has(`${result.schoolId}|${result.classId}|${result.termId}`));
    let qualityPassed = 0;
    let quantityPassed = 0;
    const schoolQualityMap: Record<string, { qualityPassed: number; quantityPassed: number; assessed: number; qualityLabel: string; quantityLabel: string }> = {};
    for (const result of qualityRecords) {
      const systemName = classMap.get(result.classId)?.gradingSystem?.name || 'Primary Grading System';
      const bands = schoolAnalysisBands(systemName);
      const scale = classMap.get(result.classId)?.gradingSystem?.gradeScales.find((candidate: any) => result.finalPercentage! >= candidate.minScore && result.finalPercentage! <= candidate.maxScore);
      const grade = scale?.grade || result.finalGrade;
      const points = scale?.points ?? result.points;
      const isQuality = schoolBandIncludes(bands.quality, grade, points);
      const isQuantity = schoolBandIncludes(bands.quantity, grade, points);
      if (isQuality) qualityPassed += 1;
      if (isQuantity) quantityPassed += 1;
      const aggregate = schoolQualityMap[result.schoolId] || { qualityPassed: 0, quantityPassed: 0, assessed: 0, qualityLabel: bands.quality.label, quantityLabel: bands.quantity.label };
      aggregate.assessed += 1;
      if (isQuality) aggregate.qualityPassed += 1;
      if (isQuantity) aggregate.quantityPassed += 1;
      schoolQualityMap[result.schoolId] = aggregate;
    }
    const overallQuality = {
      passed: qualityPassed,
      assessed: qualityRecords.length,
      rate: qualityRecords.length ? Number((qualityPassed / qualityRecords.length * 100).toFixed(1)) : 0,
      belowStandard: qualityRecords.length - qualityPassed,
      label: 'Aggregated using each class assigned grading system',
    };
    const overallQuantity = {
      passed: quantityPassed,
      assessed: qualityRecords.length,
      rate: qualityRecords.length ? Number((quantityPassed / qualityRecords.length * 100).toFixed(1)) : 0,
      belowStandard: qualityRecords.length - quantityPassed,
      label: 'Aggregated using each class assigned grading system',
    };

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId: { in: classIds }, status: 'ACTIVE' },
      select: { studentId: true },
    });
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

    const where: any = {
      schoolId: { in: schoolIds },
      termId: { in: termIds },
    };
    if (studentIds.length > 0) {
      where.studentId = { in: studentIds };
    }

    const results = await this.prisma.result.findMany({
      where,
      select: {
        score: true,
        grade: true,
        schoolId: true,
        subjectId: true,
        subject: { select: { name: true } },
      },
    });

    if (results.length === 0) {
      return empty;
    }

    const schoolNames = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true },
    });
    const schoolNameMap = new Map(schoolNames.map((s) => [s.id, s.name]));

    const gradeMap: Record<string, number> = {};
    for (const r of results) {
      const g = r.grade || 'No Grade';
      gradeMap[g] = (gradeMap[g] || 0) + 1;
    }
    const gradeDistribution = Object.entries(gradeMap)
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => b.count - a.count);

    const buckets = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${i * 10}-${i * 10 + 9}`,
      min: i * 10,
      max: i * 10 + 9,
      count: 0,
    }));
    for (const r of results) {
      const idx = Math.min(9, Math.floor(Math.max(0, r.score || 0) / 10));
      buckets[idx].count += 1;
    }

    const schoolScoreMap: Record<string, { total: number; count: number }> = {};
    for (const r of results) {
      if (!schoolScoreMap[r.schoolId]) {
        schoolScoreMap[r.schoolId] = { total: 0, count: 0 };
      }
      schoolScoreMap[r.schoolId].total += r.score || 0;
      schoolScoreMap[r.schoolId].count += 1;
    }
    const schoolPerformance = Object.entries(schoolScoreMap)
      .map(([schoolId, v]) => ({
        schoolId,
        schoolName: schoolNameMap.get(schoolId) || 'Unknown School',
        average: Number((v.total / v.count).toFixed(1)),
        resultCount: v.count,
        qualityPassRate: schoolQualityMap[schoolId]?.assessed ? Number((schoolQualityMap[schoolId].qualityPassed / schoolQualityMap[schoolId].assessed * 100).toFixed(1)) : 0,
        quantityPassRate: schoolQualityMap[schoolId]?.assessed ? Number((schoolQualityMap[schoolId].quantityPassed / schoolQualityMap[schoolId].assessed * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 12);

    const cellMap: Record<
      string,
      { total: number; count: number; schoolName: string; subjectName: string }
    > = {};
    for (const r of results) {
      const key = `${r.schoolId}|${r.subjectId}`;
      if (!cellMap[key]) {
        cellMap[key] = {
          total: 0,
          count: 0,
          schoolName: schoolNameMap.get(r.schoolId) || 'Unknown School',
          subjectName: r.subject?.name || 'Unknown Subject',
        };
      }
      cellMap[key].total += r.score || 0;
      cellMap[key].count += 1;
    }
    const cells = Object.values(cellMap);
    const schoolsOrder = [...new Set(cells.map((c) => c.schoolName))].slice(0, 10);
    const subjectsOrder = [...new Set(cells.map((c) => c.subjectName))].slice(0, 12);
    const valueMap: Record<string, number> = {};
    for (const c of cells) {
      valueMap[`${c.schoolName}|${c.subjectName}`] = Number(
        (c.total / c.count).toFixed(1),
      );
    }
    const subjectHeatmap = {
      schools: schoolsOrder,
      subjects: subjectsOrder,
      values: schoolsOrder.map((school) =>
        subjectsOrder.map((subj) => valueMap[`${school}|${subj}`] ?? 0),
      ),
    };

    const result = {
      publishedSchools: schoolIds.length,
      publishedClasses: classIds.length,
      publishedResults: results.length,
      gradeDistribution,
      scoreHistogram: buckets,
      schoolPerformance,
      subjectHeatmap,
      overallQuality,
      overallQuantity,
      qualityQuantityBySchool: Object.entries(schoolQualityMap).map(([schoolId, value]) => ({
        schoolId,
        schoolName: schoolNameMap.get(schoolId) || 'Unknown School',
        qualityPassRate: value.assessed ? Number((value.qualityPassed / value.assessed * 100).toFixed(1)) : 0,
        quantityPassRate: value.assessed ? Number((value.quantityPassed / value.assessed * 100).toFixed(1)) : 0,
        assessed: value.assessed,
        qualityLabel: value.qualityLabel,
        quantityLabel: value.quantityLabel,
      })).sort((a, b) => b.qualityPassRate - a.qualityPassRate),
    };

    this.cacheService.set(RESULTS_ANALYTICS_CACHE_KEY, result, STATS_CACHE_TTL);
    return result;
  }

  async createSuperAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);

    let superAdminRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'SuperAdmin', mode: 'insensitive' } },
    });

    if (!superAdminRole) {
      superAdminRole = await this.prisma.role.create({ data: { name: 'SuperAdmin' } });
      this.logger.warn('SuperAdmin role not found - auto-created');
    }

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        userRoles: {
          create: { roleId: superAdminRole.id },
        },
      },
    });

    return { userId: user.id, message: 'SuperAdmin created successfully' };
  }

  async getAllSettings() {
    return this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!setting) {
      throw new NotFoundException(`Setting '${key}' not found`);
    }
    return setting;
  }

  async getPublicSettings() {
    return this.prisma.systemSetting.findMany({
      where: { isPublic: true },
    });
  }

  async setPublicSetting(key: string, value: any) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, isPublic: true },
      create: { key, value, isPublic: true },
    });
  }

  async updateSetting(key: string, value: any, isPublic?: boolean) {
    const data: any = { value };
    if (typeof isPublic === 'boolean') {
      data.isPublic = isPublic;
    }
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: data,
      create: { key, value, isPublic: isPublic ?? false },
    });
  }

  async getSchoolUsers(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    return this.prisma.user.findMany({
      where: { schoolId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });
  }

  async updateUserRoles(schoolId: string, userId: string, roleNames: string[]) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
    });
    if (!user) {
      throw new NotFoundException('User not found in this school');
    }

    await this.prisma.userRole.deleteMany({
      where: { userId },
    });

    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    for (const role of roles) {
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
    }

    const updatedUser = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    return {
      message: 'User roles updated successfully',
      user: updatedUser,
    };
  }

  async getAllRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async enrollAsStaff(systemUserId: string, schoolId: string, role: string) {
    const sysUser = await this.prisma.systemUser.findUnique({
      where: { id: systemUserId },
    });
    if (!sysUser) {
      throw new NotFoundException('System user not found');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { institutionType: true },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const validRoles = [
      'Director', 'Deputy Director', 'Head Teacher', 'Deputy', 'Deputy Head', 'Teacher',
      'Class Teacher', 'HOD', 'Accountant', 'Secretary',
      'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher',
    ];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}`);
    }

    const normalizedEmail = sysUser.email.trim().toLowerCase();

    let user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const nameParts = sysUser.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || sysUser.fullName;
      const lastName = nameParts.slice(1).join(' ') || sysUser.fullName;
      const tempPassword = await bcrypt.hash('SmartTech@' + Math.random().toString(36).slice(-6), 10);

      user = await this.prisma.user.create({
        data: {
          firstName: firstName.toUpperCase(),
          lastName: lastName.toUpperCase(),
          email: normalizedEmail,
          phone: sysUser.phone,
          password: tempPassword,
          schoolId,
          isActive: true,
          mustChangePassword: true,
        },
      });
      this.logger.log(`Created User record for SystemUser ${systemUserId}: ${user.id}`);
    } else {
      this.logger.log(`User record already exists for ${normalizedEmail}: ${user.id}`);
    }

    const membership = await this.prisma.schoolUser.upsert({
      where: { userId_schoolId: { userId: user.id, schoolId } },
      create: { userId: user.id, schoolId, isPrimary: true },
      update: {},
    });

    const existingSchoolRole = await this.prisma.schoolRoleAssignment.findFirst({
      where: { schoolMembershipId: membership.id, role, isActive: true },
    });
    if (!existingSchoolRole) {
      await this.prisma.schoolRoleAssignment.create({
        data: { schoolMembershipId: membership.id, role, isActive: true },
      });
    }

    let roleRecord = await this.prisma.role.findFirst({
      where: { name: { equals: role, mode: 'insensitive' } },
    });
    if (!roleRecord) {
      roleRecord = await this.prisma.role.create({ data: { name: role } });
    }
    const existingUr = await this.prisma.userRole.findFirst({
      where: { userId: user.id, roleId: roleRecord.id },
    });
    if (!existingUr) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: roleRecord.id },
      });
    }

    let superAdminRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'SuperAdmin', mode: 'insensitive' } },
    });
    if (!superAdminRole) {
      superAdminRole = await this.prisma.role.create({ data: { name: 'SuperAdmin' } });
    }
    const existingPlatformRole = await this.prisma.platformRoleAssignment.findFirst({
      where: { userId: user.id, role: 'SuperAdmin', isActive: true },
    });
    if (!existingPlatformRole) {
      await this.prisma.platformRoleAssignment.create({
        data: { userId: user.id, role: 'SuperAdmin', isActive: true },
      });
    }

    if (!user.schoolId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { schoolId },
      });
    }

    const existingTeacher = await this.prisma.teacher.findUnique({
      where: { userId: user.id },
    });
    if (!existingTeacher) {
      await this.prisma.teacher.create({
        data: { userId: user.id, schoolId, staffType: 'TEACHING' },
      });
    }

    return {
      userId: user.id,
      membershipId: membership.id,
      schoolId,
      schoolName: school.name,
      role,
      message: `SuperAdmin enrolled as '${role}' at ${school.name}. Login via /auth/login with email ${normalizedEmail}.`,
    };
  }

  async backfillAllSchools() {
    this.logger.log('Starting backfill for all schools...');
    return this.provisioningService.backfillAllSchools();
  }

  async reProvisionSchool(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { institutionType: true },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const typeCode = school.institutionType?.code;
    if (!typeCode) {
      throw new BadRequestException('School has no institution type assigned');
    }

    this.logger.log(`Re-provisioning school ${school.name} (${typeCode})`);
    return this.provisioningService.ensureCompleteProvisioning(schoolId, typeCode);
  }

  async seedPerformanceCategories() {
    this.logger.log('Seeding performance categories for all schools...');

    const schools = await this.prisma.school.findMany({ select: { id: true } });
    const schoolIds = schools.map(s => s.id);

    if (schoolIds.length === 0) {
      return { total: 0, created: 0, skipped: 0 };
    }

    const existing = await this.prisma.performanceCategory.findMany({
      where: { schoolId: { in: schoolIds } },
      select: { schoolId: true },
    });
    const schoolsWithCategories = new Set(existing.map(e => e.schoolId));
    const schoolsNeeding = schoolIds.filter(id => !schoolsWithCategories.has(id));

    if (schoolsNeeding.length === 0) {
      return { total: schoolIds.length, created: 0, skipped: schoolIds.length };
    }

    let created = 0;
    for (const schoolId of schoolsNeeding) {
      try {
        await this.prisma.performanceCategory.createMany({
          data: [
            { schoolId, name: 'One', label: 'Excellent', minScore: 80, maxScore: 100, color: '#10b981', sortOrder: 1, isActive: true },
            { schoolId, name: 'Two', label: 'Very Good', minScore: 70, maxScore: 79.99, color: '#22c55e', sortOrder: 2, isActive: true },
            { schoolId, name: 'Three', label: 'Good', minScore: 60, maxScore: 69.99, color: '#3b82f6', sortOrder: 3, isActive: true },
            { schoolId, name: 'Four', label: 'Average', minScore: 50, maxScore: 59.99, color: '#f59e0b', sortOrder: 4, isActive: true },
            { schoolId, name: 'Five', label: 'Below Average', minScore: 40, maxScore: 49.99, color: '#f97316', sortOrder: 5, isActive: true },
            { schoolId, name: 'Six', label: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', sortOrder: 6, isActive: true },
          ],
        });
        created++;
      } catch (e: any) {
        this.logger.warn(`Failed to seed categories for school ${schoolId}: ${e.message}`);
      }
    }

    this.logger.log(`Performance categories: ${created} seeded, ${schoolsWithCategories.size} already existed`);
    return { total: schoolIds.length, created, skipped: schoolsWithCategories.size };
  }
}
