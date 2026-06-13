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

const STATS_CACHE_TTL = 300_000;
const STATS_CACHE_KEY = 'super-admin:system-stats';

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
      await this.provisioningService.provisionInstitution(school.id, institutionTypeCode);
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
        where: { code: data.institutionType },
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
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const directorRole = await this.prisma.role.findUnique({
      where: { name: 'Director' },
    });

    if (!directorRole) {
      throw new NotFoundException(
        'Director role not found. Please run seed script.',
      );
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
        { name: school.name, url: `${this.configService.get<string>('FRONTEND_URL')}/login?school=${schoolId}` },
      )
      .catch((err) => this.logger.error('Failed to send director welcome message:', err));

    return {
      id: user.id,
      email: user.email,
      schoolId,
      schoolName: school.name,
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

    const directorRole = await this.prisma.role.findUnique({
      where: { name: 'Director' },
    });

    if (!directorRole) {
      throw new NotFoundException('Director role not found');
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

  async createSuperAdmin(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdminRole = await this.prisma.role.findUnique({
      where: { name: 'SuperAdmin' },
    });

    if (!superAdminRole) {
      throw new NotFoundException(
        'SuperAdmin role not found. Please run seed script.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email,
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
}
