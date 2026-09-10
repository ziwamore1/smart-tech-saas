import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { InstitutionProvisioningService } from './institution-provisioning.service';
import { RegisterInstitutionDto, InstitutionTypeCodeEnum } from './dto/institution-type.dto';
import { EmailService } from '../email/email.service';

const escapeHtml = (value: string | undefined) =>
  String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] || character));

@Injectable()
export class InstitutionRegistrationService {
  private readonly logger = new Logger(InstitutionRegistrationService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private provisioningService: InstitutionProvisioningService,
    private emailService: EmailService,
  ) {}

  async registerInstitution(dto: RegisterInstitutionDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const institutionType = await this.prisma.institutionType.findUnique({
      where: { code: dto.institutionType as any },
    });

    if (!institutionType) {
      throw new BadRequestException(`Invalid institution type: ${dto.institutionType}`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const registrationNumber = await this.generateRegistrationNumber();

    const school = await this.prisma.school.create({
      data: {
        name: dto.institutionName,
        institutionTypeId: institutionType.id,
        registrationNumber,
        subscriptionStatus: 'pending_review',
        email: normalizedEmail,
        phone: dto.phone,
        address: dto.address,
        isActive: false,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.directorFirstName,
        lastName: dto.directorLastName,
        email: normalizedEmail,
        password: hashedPassword,
        schoolId: school.id,
      },
    });

    const institutionRoles = await this.prisma.institutionTypeRole.findMany({
      where: {
        institutionTypeId: institutionType.id,
        isActive: true,
      },
      include: { role: true },
    });

    for (const typeRole of institutionRoles) {
      const role = await this.prisma.role.upsert({
        where: { name: typeRole.role.name },
        update: {},
        create: { name: typeRole.role.name },
      });

      try {
        await this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });
      } catch (e) {
        // Role assignment may already exist
      }
    }

    // Auto-create Teacher record for Director so they appear in staff register and analytics
    const existingTeacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
    if (!existingTeacher) {
      await this.prisma.teacher.create({
        data: {
          userId: user.id,
          schoolId: school.id,
          staffType: 'TEACHING',
        },
      });
    }

    // Ensure SchoolUser membership exists
    const existingMembership = await this.prisma.schoolUser.findFirst({
      where: { userId: user.id, schoolId: school.id },
    });
    if (!existingMembership) {
      const membership = await this.prisma.schoolUser.create({
        data: { userId: user.id, schoolId: school.id, isPrimary: true },
      });
      // Create SchoolRoleAssignment for Director
      await this.prisma.schoolRoleAssignment.create({
        data: { schoolMembershipId: membership.id, role: 'Director', isActive: true },
      });
    }

    const registrationRequest = await this.prisma.schoolRegistrationRequest.create({
      data: {
        schoolId: school.id,
        directorUserId: user.id,
        schoolName: dto.institutionName,
        directorFirstName: dto.directorFirstName,
        directorLastName: dto.directorLastName,
        email: normalizedEmail,
        phone: dto.phone,
        address: dto.address,
        institutionType: dto.institutionType,
        registrationPurpose: (dto as any).registrationPurpose,
        expectedLearners: (dto as any).expectedLearners,
        contactPreference: (dto as any).contactPreference,
        messages: {
          create: {
            direction: 'INBOUND',
            subject: 'Initial school registration request',
            message: (dto as any).message || 'The applicant submitted a school registration request.',
            senderEmail: normalizedEmail,
          },
        },
      },
    });

    const ownerEmail = process.env.SYSTEM_OWNER_EMAIL || process.env.SUPPORT_EMAIL;
    const applicantName = `${dto.directorFirstName} ${dto.directorLastName}`.trim();
    const safeApplicantName = escapeHtml(applicantName);
    const safeInstitutionName = escapeHtml(dto.institutionName);
    const safeEmail = escapeHtml(normalizedEmail);
    const safeRegistrationNumber = escapeHtml(registrationNumber);
    if (ownerEmail) {
      this.emailService.sendMail(
        ownerEmail,
        `New school registration request: ${dto.institutionName}`,
        `<p>A new school registration request is awaiting review.</p><p><strong>School:</strong> ${safeInstitutionName}<br/><strong>Applicant:</strong> ${safeApplicantName}<br/><strong>Email:</strong> ${safeEmail}<br/><strong>Registration number:</strong> ${safeRegistrationNumber}</p>`,
      ).catch((error) => this.logger.warn(`Registration owner notification failed: ${error.message}`));
    }
    this.emailService.sendMail(
      normalizedEmail,
      'We received your Smart Tech school registration request',
      `<p>Hello ${safeApplicantName},</p><p>We received your request for <strong>${safeInstitutionName}</strong>. The workspace is pending System Owner review. Please reply to this email or contact the Smart Tech team for guidance. Access and the trial period will begin after approval.</p><p>Your reference number is <strong>${safeRegistrationNumber}</strong>.</p>`,
    ).catch((error) => this.logger.warn(`Registration applicant notification failed: ${error.message}`));

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const primaryRole = roles[0] || 'USER';

    this.logger.log(`Institution registered: ${school.id} (${dto.institutionName}) type: ${dto.institutionType}`);

    return {
      message: 'Registration request received. Your school will be activated after System Owner review.',
      requestId: registrationRequest.id,
      registrationNumber,
      status: 'PENDING_REVIEW',
      institution: {
        id: school.id,
        name: school.name,
        type: dto.institutionType,
        registrationNumber,
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        primaryRole,
        schoolId: school.id,
      },
    };
  }

  private async generateRegistrationNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `ST-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.school.findUnique({ where: { registrationNumber: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    throw new BadRequestException('Unable to allocate a school registration number. Please try again.');
  }

  async getRegistrationSteps() {
    const types = await this.prisma.institutionType.findMany({
      where: { isActive: true },
      select: {
        code: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      steps: [
        { step: 1, name: 'Select Institution Type', description: 'Choose your institution category' },
        { step: 2, name: 'Assign Curriculum Structure', description: 'Configure academic structure' },
        { step: 3, name: 'Assign Modules', description: 'Select enabled modules' },
        { step: 4, name: 'Provision Institution', description: 'Create and configure institution' },
        { step: 5, name: 'Generate Workspace', description: 'Launch your institution workspace' },
      ],
      institutionTypes: types,
    };
  }
}
