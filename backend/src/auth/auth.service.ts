import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PushNotificationService } from '../push-notification/push-notification.service';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../email/email.service';
import { RegisterSuperAdminDto, CreateSchoolDto, CreateDirectorDto, RegisterTeacherDto } from './dto/registration.dto';
import { InstitutionRegistrationService } from '../institution/institution-registration.service';
import { InstitutionProvisioningService } from '../institution/institution-provisioning.service';
import { RegisterInstitutionDto, InstitutionTypeCodeEnum } from '../institution/dto/institution-type.dto';
import { StaffSyncEngineService } from '../shared/staff-sync-engine/staff-sync-engine.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private pushNotificationService: PushNotificationService,
    private notificationService: NotificationService,
    private emailService: EmailService,
    private institutionRegistrationService: InstitutionRegistrationService,
    private provisioningService: InstitutionProvisioningService,
    private syncEngine: StaffSyncEngineService,
  ) {}

  async registerSuperAdmin(data: RegisterSuperAdminDto) {
    this.logger.log(`Registering SuperAdmin: ${data.email}`);

    const existingUser = await this.prisma.systemUser.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.systemUser.create({
      data: {
        fullName: data.fullName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        password: hashedPassword,
      },
    });

    this.logger.log(`SuperAdmin created: ${user.id}`);

    const payload = {
      sub: user.id,
      type: 'super_admin',
      roles: ['SUPER_ADMIN'],
    };

    return {
      message: 'SuperAdmin registered successfully',
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: 'SUPER_ADMIN',
      },
    };
  }

  async superAdminLogin(email: string, password: string) {
    this.logger.log(`SuperAdmin login attempt: ${email}`);

    const user = await this.prisma.systemUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    this.logger.log(`SuperAdmin user found:`, user);

    if (!user) {
      this.logger.warn(`SuperAdmin user not found: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    this.logger.log(`Password valid:`, isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      type: 'super_admin',
      roles: ['SUPER_ADMIN'],
    };

    return {
      message: 'Login successful',
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: 'SUPER_ADMIN',
      },
    };
  }

  async createSchool(data: CreateSchoolDto, superAdminId: string) {
    this.logger.log(`SuperAdmin ${superAdminId} creating school: ${data.schoolName}`);

    const institutionTypeCode = data.schoolType || 'PRIMARY_SCHOOL';
    const institutionType = await this.prisma.institutionType.findUnique({
      where: { code: institutionTypeCode as any },
    });

    if (!institutionType) {
      throw new BadRequestException(`Institution type '${institutionTypeCode}' not found. Please run seed script.`);
    }

    const school = await this.prisma.school.create({
      data: {
        name: data.schoolName,
        address: data.address,
        email: data.email,
        phone: data.phone,
        institutionTypeId: institutionType.id,
        subscriptionStatus: 'trial',
      },
    });

    this.logger.log(`School created: ${school.id}`);

    this.provisioningService.provisionInstitution(school.id, institutionTypeCode)
      .catch((err) => this.logger.error(`Provisioning failed for school ${school.id}:`, err));

    return {
      message: 'School created successfully',
      school: {
        id: school.id,
        name: school.name,
        email: school.email,
        phone: school.phone,
        institutionType: institutionTypeCode,
      },
    };
  }

  async createDirector(data: CreateDirectorDto, superAdminId: string) {
    this.logger.log(`Creating director for school: ${data.schoolId}`);

    const school = await this.prisma.school.findUnique({
      where: { id: data.schoolId },
      include: { institutionType: true },
    });

    if (!school) {
      throw new BadRequestException('School not found');
    }

    if (!school.institutionType) {
      this.logger.warn(`School '${school.name}' has no institution type assigned - director creation will proceed`);
    }

    if (data.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: data.email.toLowerCase() },
      });
      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }
    }

    if (data.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: data.phone },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone number already in use');
      }
    }

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const nameParts = data.fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const hasEmail = !!data.email;
    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email: data.email?.toLowerCase() || `${data.schoolId}-${Date.now()}@placeholder.local`,
        phone: data.phone,
        username: hasEmail ? undefined : data.phone,
        password: hashedPassword,
        schoolId: data.schoolId,
      },
    });

    let directorRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'Director', mode: 'insensitive' } },
    });

    if (!directorRole) {
      directorRole = await this.prisma.role.create({ data: { name: 'Director' } });
      this.logger.warn('Director role not found - auto-created during director creation');
    }

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: directorRole.id,
      },
    });

    // Auto-create Teacher record so Director appears in staff register and analytics
    const existingTeacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!existingTeacher) {
      const teacher = await this.prisma.teacher.create({
        data: {
          userId: user.id,
          schoolId: data.schoolId,
          staffType: 'TEACHING',
        },
      });
      // Auto-sync to StaffHrProfile for Staff Return Hub
      this.syncEngine.syncStaffProfile(teacher.id, data.schoolId)
        .then(result => this.logger.log(`Auto-sync to HR profile for director: created=${result.created}`))
        .catch(err => this.logger.error(`Auto-sync to HR profile failed for director: ${err.message}`));
    }

    // Also ensure SchoolUser membership exists
    const existingMembership = await this.prisma.schoolUser.findFirst({
      where: { userId: user.id, schoolId: data.schoolId },
    });
    if (!existingMembership) {
      const membership = await this.prisma.schoolUser.create({
        data: { userId: user.id, schoolId: data.schoolId, isPrimary: true },
      });
      // Create SchoolRoleAssignment for Director
      await this.prisma.schoolRoleAssignment.create({
        data: { schoolMembershipId: membership.id, role: 'Director', isActive: true },
      });
    }

    const directorSchoolUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?school=${data.schoolId}`;

    await this.notificationService.sendCredentials({
      schoolId: data.schoolId,
      recipientName: data.fullName,
      email: hasEmail ? data.email : undefined,
      phone: data.phone,
      username: hasEmail ? data.email : data.phone,
      password: tempPassword,
      role: 'Director',
      schoolName: school.name,
      schoolUrl: directorSchoolUrl,
    });

    return {
      message: 'Director created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        schoolId: user.schoolId,
        institutionType: school.institutionType?.code || null,
      },
      credentialsSent: true,
    };
  }

  async createTeacher(data: RegisterTeacherDto, directorId: string, schoolId: string) {
    this.logger.log(`Creating teacher at school: ${schoolId}`);

    if (data.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: data.phone },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone number already in use');
      }
    }

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const nameParts = data.fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const hasEmail = !!data.email;
    const email = data.email || `${Date.now()}@placeholder.local`;

    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: data.phone,
        username: hasEmail ? undefined : data.phone,
        password: hashedPassword,
        schoolId,
      },
    });

    let teacherRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'Teacher', mode: 'insensitive' } },
    });

    if (!teacherRole) {
      teacherRole = await this.prisma.role.create({ data: { name: 'Teacher' } });
      this.logger.warn('Teacher role not found - auto-created during teacher registration');
    }

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: teacherRole.id,
      },
    });

    await this.prisma.teacher.create({
      data: {
        userId: user.id,
        schoolId,
      },
    });

    // Ensure SchoolUser membership exists
    const existingMembership = await this.prisma.schoolUser.findFirst({
      where: { userId: user.id, schoolId },
    });
    if (!existingMembership) {
      const membership = await this.prisma.schoolUser.create({
        data: { userId: user.id, schoolId, isPrimary: true },
      });
      await this.prisma.schoolRoleAssignment.create({
        data: { schoolMembershipId: membership.id, role: 'Teacher', isActive: true },
      });
    } else {
      const existingTeacherRole = await this.prisma.schoolRoleAssignment.findFirst({
        where: { schoolMembershipId: existingMembership.id, role: 'Teacher' },
      });
      if (!existingTeacherRole) {
        await this.prisma.schoolRoleAssignment.create({
          data: { schoolMembershipId: existingMembership.id, role: 'Teacher', isActive: true },
        });
      }
    }

    // Auto-sync to StaffHrProfile
    const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (teacher) {
      this.syncEngine.syncStaffProfile(teacher.id, schoolId)
        .then(result => this.logger.log(`Auto-sync to HR profile for teacher ${teacher.id}: created=${result.created}`))
        .catch(err => this.logger.error(`Auto-sync to HR profile failed for teacher ${teacher.id}: ${err.message}`));
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const teacherSchoolUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?school=${schoolId}`;

    await this.notificationService.sendCredentials({
      schoolId,
      recipientName: data.fullName,
      email: hasEmail ? data.email : undefined,
      phone: data.phone,
      username: hasEmail ? data.email : data.phone,
      password: tempPassword,
      role: 'Teacher',
      schoolName: school?.name,
      schoolUrl: teacherSchoolUrl,
    });

    return {
      message: 'Teacher created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        username: user.username,
      },
      credentialsSent: true,
    };
  }

  async login(identifier: string, password: string, schoolId?: string) {
    this.logger.log(`Login attempt for identifier: "${identifier}"${schoolId ? `, URL schoolId: ${schoolId}` : ''}`);

    const isEmail = identifier.includes('@');
    let user;

    const userInclude = {
      userRoles: { include: { role: true } },
      schoolUsers: { select: { schoolId: true, isPrimary: true } },
      school: { include: { institutionType: true } },
      teacher: { select: { id: true } },
    };

    if (isEmail) {
      user = await this.prisma.user.findFirst({
        where: { email: identifier.trim().toLowerCase() },
        include: userInclude,
      });
    } else {
      const trimmed = identifier.trim();
      user = await this.prisma.user.findFirst({
        where: { username: trimmed.toLowerCase() },
        include: userInclude,
      });

      if (!user) {
        const cleanedPhone = trimmed.replace(/[^0-9+]/g, '');
        user = await this.prisma.user.findFirst({
          where: { phone: cleanedPhone },
          include: userInclude,
        });
      }

      if (!user) {
        user = await this.prisma.user.findFirst({
          where: { student: { admissionNumber: trimmed } },
          include: userInclude,
        });
      }
    }

    this.logger.log(`User found: ${user?.email || user?.phone}, schoolId: ${user?.schoolId}`);

    if (!user) {
      this.logger.warn(`User not found for identifier: ${identifier}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${identifier}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const primaryRole = roles[0] || 'USER';

    // Fetch platform roles
    const platformRoles = await this.prisma.platformRoleAssignment.findMany({
      where: { userId: user.id, isActive: true },
      select: { role: true },
    });
    const platformRoleNames = platformRoles.map((pr) => pr.role);

    // Fetch school roles for the effective school
    const resolvedSchoolId = user.schoolId
      || user.schoolUsers?.find(su => su.isPrimary)?.schoolId
      || user.schoolUsers?.[0]?.schoolId
      || null;

    let schoolRoleNames: string[] = [];
    if (resolvedSchoolId) {
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId: user.id, schoolId: resolvedSchoolId },
      });
      if (membership) {
        const schoolRoles = await this.prisma.schoolRoleAssignment.findMany({
          where: { schoolMembershipId: membership.id, isActive: true },
          select: { role: true },
        });
        schoolRoleNames = schoolRoles.map((sr) => sr.role);
      }
    }

    // Merge all roles for backward compatibility
    const allRoles = [...new Set([...roles, ...schoolRoleNames, ...platformRoleNames])];

    const institutionType = user.school?.institutionType?.code || null;

    let effectiveSchoolId = resolvedSchoolId;
    let effectiveInstitutionType = institutionType;

    // If institutionType is null but we have a resolvedSchoolId, fetch it from the school
    if (!effectiveInstitutionType && resolvedSchoolId) {
      const resolvedSchool = await this.prisma.school.findUnique({
        where: { id: resolvedSchoolId },
        select: { institutionType: { select: { code: true } } },
      });
      effectiveInstitutionType = resolvedSchool?.institutionType?.code || null;
    }

    if (schoolId) {
      const schoolFromUrl = await this.prisma.school.findUnique({
        where: { id: schoolId },
        include: { institutionType: true },
      });
      if (schoolFromUrl?.institutionType) {
        effectiveSchoolId = schoolId;
        effectiveInstitutionType = schoolFromUrl.institutionType.code;
        this.logger.log(`Overriding school context from URL param: schoolId=${schoolId}, type=${effectiveInstitutionType}`);
      } else {
        this.logger.warn(`SchoolId from URL '${schoolId}' not found or has no type; using user's default school context`);
      }
    }

    let teacherId: string | undefined;
    let classTeacherOf: string | undefined;
    if (user.teacher) {
      teacherId = user.teacher.id;
      const cta = await this.prisma.classTeacherAssignment.findFirst({
        where: { teacherId: user.id, isActive: true, isPrimary: true },
        select: { classId: true },
      });
      classTeacherOf = cta?.classId;
    }

    const payload = {
      sub: user.id,
      schoolId: effectiveSchoolId,
      institutionType: effectiveInstitutionType,
      roles: allRoles,
      platformRoles: platformRoleNames,
      schoolRoles: schoolRoleNames,
      teacherId,
      classTeacherOf,
      type: 'user',
    };

    this.logger.log(
      `Login successful for ${identifier}, roles: ${allRoles.join(', ')}, schoolId: ${payload.schoolId}, type: ${effectiveInstitutionType}`,
    );

    if (effectiveSchoolId && allRoles.includes('Director')) {
      this.ensureTeacherRecord(user.id, effectiveSchoolId).catch(err =>
        this.logger.warn(`Failed to ensure Teacher record for Director ${user.id}: ${err.message}`),
      );
    }

    return {
      message: 'Login successful',
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: allRoles,
        platformRoles: platformRoleNames,
        schoolRoles: schoolRoleNames,
        primaryRole,
        schoolId: effectiveSchoolId,
        institutionType: effectiveInstitutionType,
        teacherId,
        classTeacherOf,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        school: { include: { institutionType: true } },
        teacher: { select: { id: true } },
        schoolUsers: {
          select: { schoolId: true, isPrimary: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const roles = user.userRoles.map((ur) => ur.role.name);

    const platformRoles = await this.prisma.platformRoleAssignment.findMany({
      where: { userId, isActive: true },
      select: { role: true },
    });
    const platformRoleNames = platformRoles.map((pr) => pr.role);

    const schoolUsers = user.schoolUsers || [];
    const resolvedSchoolId = user.schoolId
      || schoolUsers.find(su => su.isPrimary)?.schoolId
      || schoolUsers[0]?.schoolId
      || null;

    let schoolRoleNames: string[] = [];
    let institutionType = user.school?.institutionType?.code || null;

    if (resolvedSchoolId) {
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId, schoolId: resolvedSchoolId },
      });
      if (membership) {
        const schoolRoles = await this.prisma.schoolRoleAssignment.findMany({
          where: { schoolMembershipId: membership.id, isActive: true },
          select: { role: true },
        });
        schoolRoleNames = schoolRoles.map((sr) => sr.role);
      }

      if (!institutionType) {
        const resolvedSchool = await this.prisma.school.findUnique({
          where: { id: resolvedSchoolId },
          select: { institutionType: { select: { code: true } } },
        });
        institutionType = resolvedSchool?.institutionType?.code || null;
      }
    }

    const allRoles = [...new Set([...roles, ...schoolRoleNames, ...platformRoleNames])];

    // Fetch class teacher assignments
    const classTeacherOf = user.teacher
      ? (await this.prisma.classTeacherAssignment.findFirst({
          where: { teacherId: user.id, isActive: true, isPrimary: true },
          select: { classId: true },
        }))?.classId
      : undefined;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      roles: allRoles,
      schoolRoles: schoolRoleNames,
      platformRoles: platformRoleNames,
      schoolId: resolvedSchoolId,
      teacherId: user.teacher?.id,
      classTeacherOf,
      institutionType,
    };
  }

  async mobileLogin(
    email?: string,
    password?: string,
    deviceToken?: string,
    deviceId?: string,
    platform: string = 'android',
    username?: string,
  ) {
    this.logger.log(`Mobile login attempt - email: "${email}", username: "${username}"`);

    let user = null;

    if (username) {
      user = await this.prisma.user.findFirst({
        where: { username: username.toLowerCase() },
        include: {
          userRoles: { include: { role: true } },
          schoolUsers: { select: { schoolId: true, isPrimary: true } },
          school: {
            select: {
              id: true, name: true, logo: true, primaryColor: true,
              institutionType: { select: { code: true, name: true } },
            },
          },
        },
      });

      if (!user) {
        const cleanedPhone = username.replace(/[^0-9+]/g, '');
        user = await this.prisma.user.findFirst({
          where: { phone: cleanedPhone },
          include: {
            userRoles: { include: { role: true } },
            schoolUsers: { select: { schoolId: true, isPrimary: true } },
            school: {
              select: {
                id: true, name: true, logo: true, primaryColor: true,
                institutionType: { select: { code: true, name: true } },
              },
            },
          },
        });
      }

      if (!user) {
        user = await this.prisma.user.findFirst({
          where: { student: { admissionNumber: username } },
          include: {
            userRoles: { include: { role: true } },
            schoolUsers: { select: { schoolId: true, isPrimary: true } },
            school: {
              select: {
                id: true, name: true, logo: true, primaryColor: true,
                institutionType: { select: { code: true, name: true } },
              },
            },
          },
        });
      }
    }

    if (!user && email) {
      user = await this.prisma.user.findFirst({
        where: { email: email.trim().toLowerCase() },
        include: {
          userRoles: { include: { role: true } },
          schoolUsers: { select: { schoolId: true, isPrimary: true } },
          school: {
            select: {
              id: true, name: true, logo: true, primaryColor: true,
              institutionType: { select: { code: true, name: true } },
            },
          },
        },
      });
    }

    if (!user) {
      this.logger.warn(`User not found for email/username: ${email || username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!password) {
      throw new UnauthorizedException('Password is required');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${email || username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const primaryRole = roles[0] || 'USER';

    const platformRoles = await this.prisma.platformRoleAssignment.findMany({
      where: { userId: user.id, isActive: true },
      select: { role: true },
    });
    const platformRoleNames = platformRoles.map((pr) => pr.role);

    const resolvedSchoolId = user.schoolId
      || user.schoolUsers?.find((su: any) => su.isPrimary)?.schoolId
      || user.schoolUsers?.[0]?.schoolId
      || null;

    let schoolRoleNames: string[] = [];
    if (resolvedSchoolId) {
      const membership = await this.prisma.schoolUser.findFirst({
        where: { userId: user.id, schoolId: resolvedSchoolId },
      });
      if (membership) {
        const schoolRoles = await this.prisma.schoolRoleAssignment.findMany({
          where: { schoolMembershipId: membership.id, isActive: true },
          select: { role: true },
        });
        schoolRoleNames = schoolRoles.map((sr) => sr.role);
      }
    }

    const allRoles = [...new Set([...roles, ...schoolRoleNames, ...platformRoleNames])];

    if (deviceToken) {
      await this.pushNotificationService.registerDeviceToken(
        user.id,
        deviceToken,
        platform,
        deviceId,
      );
    }

    const institutionType = user.school?.institutionType?.code || null;

    const payload = {
      sub: user.id,
      schoolId: resolvedSchoolId,
      institutionType,
      roles: allRoles,
      platformRoles: platformRoleNames,
      schoolRoles: schoolRoleNames,
      type: 'user',
    };

    const schoolInfo = user.school
      ? {
          id: user.school.id,
          name: user.school.name,
          logo: user.school.logo,
          primaryColor: user.school.primaryColor || '#1E3A8A',
          institutionType: user.school.institutionType?.code || null,
        }
      : null;

    this.logger.log(
      `Mobile login successful for ${email || username}, roles: ${allRoles.join(', ')}`,
    );

    if (resolvedSchoolId && allRoles.includes('Director')) {
      this.ensureTeacherRecord(user.id, resolvedSchoolId).catch(err =>
        this.logger.warn(`Failed to ensure Teacher record for Director ${user.id}: ${err.message}`),
      );
    }

    return {
      message: 'Login successful',
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        primaryRole,
        schoolId: user.schoolId,
        studentId: user.studentId,
        institutionType,
        school: schoolInfo,
      },
    };
  }

  async registerSchool(data: any) {
    this.logger.log(
      `Registering school: ${data.schoolName}, director email: ${data.email}, type: ${data.institutionType || 'PRIMARY_SCHOOL'}`,
    );

    const institutionType = data.institutionType || 'PRIMARY_SCHOOL';

    const registerDto = new RegisterInstitutionDto();
    registerDto.institutionName = data.schoolName;
    registerDto.institutionType = institutionType as InstitutionTypeCodeEnum;
    registerDto.directorFirstName = data.directorFirstName || 'School';
    registerDto.directorLastName = data.directorLastName || 'Director';
    registerDto.email = data.email;
    registerDto.password = data.password;
    registerDto.phone = data.phone;
    registerDto.address = data.address;

    return this.institutionRegistrationService.registerInstitution(registerDto);
  }

  async registerTeacher(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    schoolId: string,
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    let teacherRole = await this.prisma.role.findFirst({
      where: { name: { equals: 'Teacher', mode: 'insensitive' } },
    });

    if (!teacherRole) {
      teacherRole = await this.prisma.role.create({ data: { name: 'Teacher' } });
      this.logger.warn('Teacher role not found - auto-created during teacher registration');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        schoolId,
      },
    });

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: teacherRole.id,
      },
    });

    // Create Teacher record
    const existingTeacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!existingTeacher) {
      const teacher = await this.prisma.teacher.create({
        data: {
          userId: user.id,
          schoolId,
          staffType: 'TEACHING',
        },
      });
      // Auto-sync to StaffHrProfile
      this.syncEngine.syncStaffProfile(teacher.id, schoolId)
        .then(result => this.logger.log(`Auto-sync to HR profile for registered teacher: created=${result.created}`))
        .catch(err => this.logger.error(`Auto-sync to HR profile failed for registered teacher: ${err.message}`));
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
        data: { schoolMembershipId: membership.id, role: 'Teacher', isActive: true },
      });
    } else {
      const existingTeacherRole = await this.prisma.schoolRoleAssignment.findFirst({
        where: { schoolMembershipId: existingMembership.id, role: 'Teacher' },
      });
      if (!existingTeacherRole) {
        await this.prisma.schoolRoleAssignment.create({
          data: { schoolMembershipId: existingMembership.id, role: 'Teacher', isActive: true },
        });
      }
    }

    return {
      message: 'Teacher created successfully',
      userId: user.id,
    };
  }

  async forgotPassword(identifier: string) {
    const isEmail = identifier.includes('@');
    let user;

    if (isEmail) {
      user = await this.prisma.user.findFirst({
        where: { email: identifier.trim().toLowerCase() },
      });
    } else {
      const cleanedPhone = identifier.trim().replace(/[^0-9+]/g, '');
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phone: { equals: cleanedPhone, mode: 'insensitive' } },
            { username: { equals: cleanedPhone, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!user) {
      return { message: 'If an account exists with that identifier, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    if (isEmail) {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      await this.emailService.sendPasswordResetEmail(user.email, resetLink);
      this.logger.log(`Password reset email sent to: ${user.email}`);
    } else {
      const otp = crypto.randomInt(100000, 999999).toString();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken: otp },
      });
      const message = `Your Smart Tech password reset OTP is: ${otp}. This code expires in 1 hour.`;
      await this.notificationService.sendGenericSms(user.phone, message, user.schoolId);
      this.logger.log(`Password reset SMS sent to: ${user.phone}`);
    }

    return { message: 'If an account exists with that identifier, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    this.logger.log(`Password reset successful for user: ${user.email}`);
    return { message: 'Password has been reset successfully' };
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async switchIdentity(systemUserId: string, schoolId: string) {
    const sysUser = await this.prisma.systemUser.findUnique({
      where: { id: systemUserId },
    });
    if (!sysUser) throw new NotFoundException('System user not found');

    const normalizedEmail = sysUser.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: {
        userRoles: { include: { role: true } },
        schoolUsers: { select: { schoolId: true, isPrimary: true } },
        teacher: { select: { id: true } },
      },
    });
    if (!user) {
      throw new NotFoundException('No linked school account found. Please enroll as staff first.');
    }

    const membership = await this.prisma.schoolUser.findFirst({
      where: { userId: user.id, schoolId },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this school.');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: { institutionType: true },
    });

    const userRoles = user.userRoles.map(ur => ur.role.name);

    const platformRoles = await this.prisma.platformRoleAssignment.findMany({
      where: { userId: user.id, isActive: true },
      select: { role: true },
    });
    const platformRoleNames = platformRoles.map(pr => pr.role);

    const schoolRoles = await this.prisma.schoolRoleAssignment.findMany({
      where: { schoolMembershipId: membership.id, isActive: true },
      select: { role: true },
    });
    const schoolRoleNames = schoolRoles.map(sr => sr.role);

    const allRoles = [...new Set([...userRoles, ...schoolRoleNames, ...platformRoleNames])];

    let teacherId: string | undefined;
    let classTeacherOf: string | undefined;
    if (user.teacher) {
      teacherId = user.teacher.id;
      const cta = await this.prisma.classTeacherAssignment.findFirst({
        where: { teacherId: user.id, isActive: true, isPrimary: true },
        select: { classId: true },
      });
      classTeacherOf = cta?.classId;
    }

    const payload = {
      sub: user.id,
      schoolId,
      institutionType: school?.institutionType?.code || null,
      roles: allRoles,
      platformRoles: platformRoleNames,
      schoolRoles: schoolRoleNames,
      teacherId,
      classTeacherOf,
      type: 'user',
    };

    return {
      message: `Switched to ${school?.name || 'school'}`,
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: allRoles,
        platformRoles: platformRoleNames,
        schoolRoles: schoolRoleNames,
        primaryRole: schoolRoleNames[0] || 'USER',
        schoolId,
        schoolName: school?.name,
        institutionType: school?.institutionType?.code || null,
        teacherId,
        classTeacherOf,
      },
    };
  }

  async getLinkedIdentities(systemUserId: string) {
    const sysUser = await this.prisma.systemUser.findUnique({
      where: { id: systemUserId },
    });
    if (!sysUser) throw new NotFoundException('System user not found');

    const normalizedEmail = sysUser.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: {
        schoolUsers: {
          include: {
            school: { include: { institutionType: true } },
            SchoolRoleAssignment: { where: { isActive: true }, select: { role: true } },
          },
        },
      },
    });

    if (!user) return { identities: [] };

    const identities = user.schoolUsers.map(su => ({
      schoolId: su.schoolId,
      schoolName: su.school.name,
      isPrimary: su.isPrimary,
      roles: su.SchoolRoleAssignment.map(sra => sra.role),
      institutionType: su.school.institutionType?.code || null,
    }));

    return { identities };
  }

  private async ensureTeacherRecord(userId: string, schoolId: string) {
    const existing = await this.prisma.teacher.findUnique({ where: { userId } });
    if (existing) return;

    await this.prisma.teacher.create({
      data: {
        userId,
        schoolId,
        staffType: 'TEACHING',
      },
    });
    this.logger.log(`Auto-created Teacher record for Director ${userId} at school ${schoolId}`);
  }
}
