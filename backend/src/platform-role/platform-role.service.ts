import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformRoleService {
  private readonly logger = new Logger(PlatformRoleService.name);

  constructor(private prisma: PrismaService) {}

  async assignPlatformRole(userId: string, role: string, assignedBy?: string) {
    const existing = await this.prisma.platformRoleAssignment.findFirst({
      where: { userId, role, isActive: true },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.platformRoleAssignment.create({
      data: {
        userId,
        role,
        isActive: true,
      },
    });
  }

  async removePlatformRole(userId: string, role: string) {
    const assignment = await this.prisma.platformRoleAssignment.findFirst({
      where: { userId, role },
    });

    if (!assignment) {
      throw new NotFoundException('Platform role assignment not found');
    }

    await this.prisma.platformRoleAssignment.update({
      where: { id: assignment.id },
      data: { isActive: false, endDate: new Date() },
    });

    return { message: `Platform role ${role} removed` };
  }

  async getUserPlatformRoles(userId: string) {
    return this.prisma.platformRoleAssignment.findMany({
      where: { userId, isActive: true },
      select: { role: true, startDate: true },
    });
  }

  async getUsersByPlatformRole(role: string) {
    return this.prisma.platformRoleAssignment.findMany({
      where: { role, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            schoolId: true,
          },
        },
      },
    });
  }

  async getAllPlatformRoles() {
    const roles = await this.prisma.platformRoleAssignment.findMany({
      where: { isActive: true },
      select: { role: true },
      distinct: ['role'],
    });

    return roles.map(r => r.role);
  }
}
