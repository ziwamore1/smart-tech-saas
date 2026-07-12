import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InstitutionProvisioningService } from './institution-provisioning.service';
import { RegisterInstitutionDto, InstitutionTypeCodeEnum } from './dto/institution-type.dto';

@Injectable()
export class InstitutionRegistrationService {
  private readonly logger = new Logger(InstitutionRegistrationService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private provisioningService: InstitutionProvisioningService,
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

    const school = await this.prisma.school.create({
      data: {
        name: dto.institutionName,
        institutionTypeId: institutionType.id,
        subscriptionStatus: 'trial',
        email: normalizedEmail,
        phone: dto.phone,
        address: dto.address,
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

    await this.provisioningService.provisionInstitution(school.id, dto.institutionType);

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

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });

    const roles = userRoles.map((ur) => ur.role.name);
    const primaryRole = roles[0] || 'USER';

    const payload = {
      sub: user.id,
      schoolId: school.id,
      institutionType: dto.institutionType,
      roles,
      type: 'user',
    };

    this.logger.log(`Institution registered: ${school.id} (${dto.institutionName}) type: ${dto.institutionType}`);

    return {
      message: 'Institution registered successfully',
      access_token: await this.jwtService.signAsync(payload),
      institution: {
        id: school.id,
        name: school.name,
        type: dto.institutionType,
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
