import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const STAFF_ROLES = [
  'DIRECTOR',
  'DEPUTY DIRECTOR',
  'HEAD TEACHER',
  'DEPUTY HEAD',
  'DEPUTY',
  'HOD',
  'TEACHER',
  'CLASS TEACHER',
];

@Injectable()
export class OwnershipService {
  constructor(private prisma: PrismaService) {}

  isStaff(user: any): boolean {
    const roles = new Set((user.roles || []).map((r: string) => String(r).toUpperCase()));
    return STAFF_ROLES.some((r) => roles.has(r));
  }

  private hasRole(user: any, role: string): boolean {
    return (user.roles || []).some((r: string) => String(r).toUpperCase() === role.toUpperCase());
  }

  async getUserEmail(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  }

  async findStudentForUser(userId: string): Promise<{ id: string } | null> {
    return this.prisma.student.findFirst({
      where: { user: { id: userId } },
      select: { id: true },
    });
  }

  async findParentForUser(userId: string): Promise<{ id: string } | null> {
    const email = await this.getUserEmail(userId);
    if (!email) return null;
    return this.prisma.parent.findFirst({ where: { email }, select: { id: true } });
  }

  async resolveStudentId(user: any, requested: string): Promise<string> {
    if (requested && requested !== 'me') return requested;

    if (this.isStaff(user)) {
      throw new BadRequestException('A student id is required');
    }

    if (this.hasRole(user, 'STUDENT')) {
      const student = await this.findStudentForUser(user.id);
      if (!student) throw new NotFoundException('No student profile linked to your account');
      return student.id;
    }

    if (this.hasRole(user, 'PARENT')) {
      const parent = await this.findParentForUser(user.id);
      if (!parent) throw new NotFoundException('No parent profile linked to your account');
      const link = await this.prisma.parentStudent.findFirst({
        where: { parentId: parent.id },
        select: { studentId: true },
      });
      if (!link) throw new NotFoundException('No children linked to your account');
      return link.studentId;
    }

    throw new ForbiddenException('Access denied');
  }

  async assertCanViewStudent(user: any, studentId: string): Promise<void> {
    if (this.isStaff(user)) return;

    if (this.hasRole(user, 'STUDENT')) {
      const student = await this.findStudentForUser(user.id);
      if (student?.id === studentId) return;
      throw new ForbiddenException("You can only view your own records");
    }

    if (this.hasRole(user, 'PARENT')) {
      const parent = await this.findParentForUser(user.id);
      if (parent) {
        const link = await this.prisma.parentStudent.findFirst({
          where: { parentId: parent.id, studentId },
        });
        if (link) return;
      }
      throw new ForbiddenException("You can only view your own children's records");
    }

    throw new ForbiddenException('Access denied');
  }
}
