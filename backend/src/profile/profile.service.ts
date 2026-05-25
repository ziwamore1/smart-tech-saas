import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from '../common/services/image.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private imageService: ImageService,
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
    if (data.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, photoUrl: true },
    });

    return user;
  }

  async uploadPhoto(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    if (!this.imageService.validateMimeType(file.mimetype)) {
      await fs.remove(file.path);
      throw new BadRequestException('Only JPG, PNG, and WebP files are allowed');
    }

    const optimizedPath = await this.imageService.optimize(file.path, { width: 400, height: 400, quality: 85 });
    const photoUrl = this.imageService.getPhotoUrl(optimizedPath);

    const oldUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { photoUrl: true } });
    if (oldUser?.photoUrl) {
      const oldPath = path.join(__dirname, '../..', oldUser.photoUrl);
      await fs.remove(oldPath).catch(() => {});
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl },
    });

    return { photoUrl };
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

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }
}
