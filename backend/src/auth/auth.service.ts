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
import { PushNotificationService } from '../push-notification/push-notification.service';
import { NotificationService } from '../notification/notification.service';
import { RegisterSuperAdminDto, CreateSchoolDto, CreateDirectorDto, RegisterTeacherDto } from './dto/registration.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private pushNotificationService: PushNotificationService,
    private notificationService: NotificationService,
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

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

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

    const school = await this.prisma.school.create({
      data: {
        name: data.schoolName,
        address: data.address,
        email: data.email,
        phone: data.phone,
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
      },
    };
  }

  async createDirector(data: CreateDirectorDto, superAdminId: string) {
    this.logger.log(`Creating director for school: ${data.schoolId}`);

    const school = await this.prisma.school.findUnique({
      where: { id: data.schoolId },
    });

    if (!school) {
      throw new BadRequestException('School not found');
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

    const directorRole = await this.prisma.role.findUnique({
      where: { name: 'Director' },
    });

    if (!directorRole) {
      throw new Error('Director role not found');
    }

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: directorRole.id,
      },
    });

    await this.notificationService.sendCredentials({
      recipientName: data.fullName,
      email: data.email,
      phone: data.phone,
      username: data.email || data.phone,
      password: tempPassword,
      role: 'Director',
      schoolName: school.name,
      schoolUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
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

    const teacherRole = await this.prisma.role.findFirst({
      where: { name: 'Teacher' },
    });

    if (!teacherRole) {
      throw new Error('Teacher role not found');
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

    await this.notificationService.sendCredentials({
      recipientName: data.fullName,
      email: data.email,
      phone: data.phone,
      username: data.email || data.phone,
      password: tempPassword,
      role: 'Teacher',
      schoolName: school?.name,
      schoolUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
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

  async login(email: string, password: string) {
    this.logger.log(`Login attempt for email: "${email}"`);

    const user = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

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

    const payload = {
      sub: user.id,
      schoolId: user.schoolId,
      roles,
      type: 'user',
    };

    this.logger.log(
      `Login successful for ${email}, roles: ${roles.join(', ')}, schoolId: ${payload.schoolId}`,
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
      },
    };
  }

  async mobileLogin(
    email: string,
    password: string,
    deviceToken?: string,
    deviceId?: string,
    platform: string = 'android',
  ) {
    this.logger.log(`Mobile login attempt for email: "${email}"`);

    const user = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
      },
      include: {
        userRoles: {
          include: { role: true },
        },
        school: {
          select: {
            id: true,
            name: true,
            logo: true,
            primaryColor: true,
          },
        },
      },
    });

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

    if (deviceToken) {
      await this.pushNotificationService.registerDeviceToken(
        user.id,
        deviceToken,
        platform,
        deviceId,
      );
    }

    const payload = {
      sub: user.id,
      schoolId: user.schoolId,
      roles,
      type: 'user',
    };

    const schoolInfo = user.school
      ? {
          id: user.school.id,
          name: user.school.name,
          logo: user.school.logo,
          primaryColor: user.school.primaryColor || '#1E3A8A',
        }
      : null;

    this.logger.log(
      `Mobile login successful for ${email}, roles: ${roles.join(', ')}`,
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
        school: schoolInfo,
      },
    };
  }

  async registerSchool(data: any) {
    this.logger.log(
      `Registering school: ${data.schoolName}, director email: ${data.email}`,
    );

    const normalizedEmail = data.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    this.logger.log(
      `Password hash generated: ${hashedPassword.substring(0, 20)}...`,
    );

    const school = await this.prisma.school.create({
      data: {
        name: data.schoolName,
        subscriptionStatus: 'trial',
      },
    });
    this.logger.log(`School created: ${school.id}`);

    const user = await this.prisma.user.create({
      data: {
        firstName: data.directorFirstName,
        lastName: data.directorLastName,
        email: normalizedEmail,
        password: hashedPassword,
        schoolId: school.id,
      },
    });
    this.logger.log(
      `User created: ${user.id}, email: ${user.email}, schoolId: ${user.schoolId}`,
    );

    const directorRole = await this.prisma.role.findUnique({
      where: { name: 'Director' },
    });

    if (!directorRole) {
      throw new Error('Director role not found. Please run seed script.');
    }

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: directorRole.id,
      },
    });
    this.logger.log(
      `UserRole created for user: ${user.id}, role: ${directorRole.name}`,
    );

    const payload = {
      sub: user.id,
      schoolId: school.id,
      roles: ['Director'],
      type: 'user',
    };

    return {
      message: 'School registered successfully',
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: ['Director'],
        primaryRole: 'Director',
        schoolId: school.id,
      },
    };
  }

  async registerTeacher(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    schoolId: string,
  ) {
    const teacherRole = await this.prisma.role.findFirst({
      where: { name: 'Teacher' },
    });

    if (!teacherRole) {
      throw new Error('Teacher role not found');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
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

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
