import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';
import { normalizeZambianPhone } from '../common/utils/phone.util';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private schoolEvents: SchoolEventsGateway,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
        school: { select: { id: true, name: true, logo: true, primaryColor: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      photoUrl: user.photoUrl,
      roles: user.userRoles.map(r => r.role.name),
      school: user.school || null,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const normalizedEmail = data.email === undefined ? undefined : data.email.trim().toLowerCase();
    if (normalizedEmail !== undefined && !normalizedEmail) throw new BadRequestException('Email address cannot be blank');
    const existingUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) throw new NotFoundException('User not found');
    const parent = await this.prisma.parent.findFirst({ where: { OR: [{ userId }, { email: existingUser.email }] } });
    if (normalizedEmail) {
      const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
      const existingParent = await this.prisma.parent.findUnique({ where: { email: normalizedEmail } });
      if (existingParent && existingParent.id !== parent?.id) throw new ConflictException('Email already in use by a parent account');
    }

    const changes: string[] = [];
    if (data.firstName) changes.push('firstName');
    if (data.lastName) changes.push('lastName');
    if (normalizedEmail !== undefined) changes.push('email');
    if (data.phone !== undefined) changes.push('phone');

    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          firstName: data.firstName?.trim(),
          lastName: data.lastName?.trim(),
          email: normalizedEmail,
          phone: data.phone === undefined ? undefined : (data.phone.trim() || null),
        },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, photoUrl: true, schoolId: true },
      });
      if (parent && (normalizedEmail !== undefined || data.phone !== undefined || data.firstName !== undefined || data.lastName !== undefined)) {
        const phoneCheck = data.phone === undefined ? null : normalizeZambianPhone(data.phone);
        await tx.parent.update({
          where: { id: parent.id },
          data: {
            ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
            ...(data.phone !== undefined ? {
              phone: data.phone.trim() || null,
              phoneStatus: phoneCheck ? 'VALID' : data.phone.trim() ? 'INVALID' : 'MISSING',
              phoneStatusReason: phoneCheck ? null : data.phone.trim() ? 'The phone number is not valid.' : 'No phone number is recorded.',
              phoneValidatedAt: new Date(),
            } : {}),
            ...(data.firstName !== undefined ? { firstName: data.firstName.trim() } : {}),
            ...(data.lastName !== undefined ? { lastName: data.lastName.trim() } : {}),
          },
        });
      }
      return updatedUser;
    });

    if (user.schoolId) {
      this.schoolEvents.emitProfileUpdated(user.schoolId, {
        userId,
        updatedBy: userId,
        changes,
      });
    }

    return user;
  }

  async uploadPhoto(userId: string, photoUrl: string, photoPublicId: string): Promise<string | null> {
    if (!photoUrl) throw new BadRequestException('No photo URL provided');

    const oldUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { photoPublicId: true, schoolId: true } });
    const oldPublicId = oldUser?.photoPublicId || null;

    await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl, photoPublicId },
    });

    if (oldUser?.schoolId) {
      this.schoolEvents.emitProfileUpdated(oldUser.schoolId, {
        userId,
        updatedBy: userId,
        changes: ['photoUrl'],
      });
    }

    return oldPublicId;
  }

  async deletePhoto(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { photoUrl: true } });
    if (user?.photoUrl) {
      const filePath = path.join(__dirname, '../..', user.photoUrl);
      await fs.remove(filePath).catch(() => {});
      await this.prisma.user.update({ where: { id: userId }, data: { photoUrl: null } });
    }
    return { success: true };
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let isValid = false;
    try { isValid = await bcrypt.compare(data.currentPassword, user.password); } catch { isValid = false; }
    const legacySha256 = /^[a-f0-9]{64}$/i.test(user.password);
    if (!isValid && legacySha256) {
      isValid = crypto.createHash('sha256').update(data.currentPassword).digest('hex') === user.password;
    }
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.passwordHistory.create({ data: { userId, passwordHash: user.password } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword, mustChangePassword: false, lastPasswordChange: new Date() },
      }),
    ]);

    return { message: 'Password updated successfully' };
  }
}
