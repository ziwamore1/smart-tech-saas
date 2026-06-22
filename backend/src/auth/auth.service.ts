import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
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

    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.email?.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const nameParts = data.fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email: data.email?.toLowerCase() || `${data.schoolId}-${Date.now()}@placeholder.local`,
        phone: data.phone,
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

    const directorSchoolUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?school=${data.schoolId}`;

    await this.notificationService.sendCredentials({
      recipientName: data.fullName,
      email: data.email,
      phone: data.phone,
      username: data.email || data.phone,
      password: tempPassword,
      role: 'Director',
      schoolName: school.name,
      schoolUrl: directorSchoolUrl,
      appDownloadUrl: process.env.APP_DOWNLOAD_URL || 'https://play.google.com/store/apps',
    });

    return {
      message: 'Director created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        schoolId: user.schoolId,
        institutionType: school.institutionType?.code || null,
      },
      credentialsSent: true,
    };
  }

  async createTeacher(data: RegisterTeacherDto, directorId: string, schoolId: string) {
    this.logger.log(`Creating teacher at school: ${schoolId}`);

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const nameParts = data.fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const email = data.email || `${Date.now()}@placeholder.local`;

    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: data.phone,
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

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const teacherSchoolUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?school=${schoolId}`;

    await this.notificationService.sendCredentials({
      recipientName: data.fullName,
      email: data.email,
      phone: data.phone,
      username: data.email || data.phone,
      password: tempPassword,
      role: 'Teacher',
      schoolName: school?.name,
      schoolUrl: teacherSchoolUrl,
      appDownloadUrl: process.env.APP_DOWNLOAD_URL || 'https://play.google.com/store/apps',
    });

    return {
      message: 'Teacher created successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
      credentialsSent: true,
    };
  }

  async login(email: string, password: string, schoolId?: string) {
    this.logger.log(`Login attempt for email: "${email}"${schoolId ? `, URL schoolId: ${schoolId}` : ''}`);

    const user = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
      },
      include: {
        userRoles: {
          include: { role: true },
        },
        schoolUsers: {
          select: { schoolId: true, isPrimary: true },
        },
        school: {
          include: { institutionType: true },
        },
      },
    });
    
    this.logger.log(`User found: ${user?.email}, schoolId: ${user?.schoolId}`);

    if (!user) {
      this.logger.warn(`User not found for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const primaryRole = roles[0] || 'USER';

    const resolvedSchoolId = user.schoolId
      || user.schoolUsers?.find(su => su.isPrimary)?.schoolId
      || user.schoolUsers?.[0]?.schoolId
      || null;

    const institutionType = user.school?.institutionType?.code || null;

    let effectiveSchoolId = resolvedSchoolId;
    let effectiveInstitutionType = institutionType;

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

    const payload = {
      sub: user.id,
      schoolId: effectiveSchoolId,
      institutionType: effectiveInstitutionType,
      roles,
      type: 'user',
    };

    this.logger.log(
      `Login successful for ${email}, roles: ${roles.join(', ')}, schoolId: ${payload.schoolId}, type: ${effectiveInstitutionType}`,
    );
    this.logger.log(`User data - schoolId in DB: ${user.schoolId}, resolved: ${resolvedSchoolId}, effective: ${effectiveSchoolId}`);

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
        schoolId: effectiveSchoolId,
        institutionType: effectiveInstitutionType,
      },
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
        where: {
          OR: [
            { username },
            { student: { admissionNumber: username } },
          ],
        },
        include: {
          userRoles: { include: { role: true } },
          school: {
            select: {
              id: true, name: true, logo: true, primaryColor: true,
              institutionType: { select: { code: true, name: true } },
            },
          },
        },
      });
    }

    if (!user && email) {
      user = await this.prisma.user.findFirst({
        where: { email: email.trim().toLowerCase() },
        include: {
          userRoles: { include: { role: true } },
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
      schoolId: user.schoolId,
      institutionType,
      roles,
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
      `Mobile login successful for ${email || username}, roles: ${roles.join(', ')}`,
    );

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

    return {
      message: 'Teacher created successfully',
      userId: user.id,
    };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { message: 'If an account exists with that email, a password reset link has been sent.' };
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

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await this.emailService.sendPasswordResetEmail(user.email, resetLink);

    this.logger.log(`Password reset email sent to: ${user.email}`);
    return { message: 'If an account exists with that email, a password reset link has been sent.' };
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
}
