import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateMockupDto } from './dto/create-mockup.dto';
import { UpdateMockupDto } from './dto/update-mockup.dto';

@Injectable()
export class LandingMockupService {
  private readonly MOCKUP_FOLDER = 'smart_tech/landing/mockups';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateMockupDto) {
    return this.prisma.landingMockup.create({ data: dto });
  }

  async findAll() {
    return this.prisma.landingMockup.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findActive() {
    return this.prisma.landingMockup.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const mockup = await this.prisma.landingMockup.findUnique({ where: { id } });
    if (!mockup) throw new NotFoundException('Mockup not found');
    return mockup;
  }

  async update(id: string, dto: UpdateMockupDto) {
    await this.findOne(id);
    return this.prisma.landingMockup.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.landingMockup.delete({ where: { id } });
  }

  async uploadImage(file: Express.Multer.File) {
    const result = await this.cloudinary.upload(file, this.MOCKUP_FOLDER, { resourceType: 'image' });
    return { url: result.secureUrl || result.url, publicId: result.publicId };
  }

  async uploadAndCreate(file: Express.Multer.File, dto: CreateMockupDto) {
    const { url } = await this.uploadImage(file);
    return this.create({ ...dto, imageUrl: url });
  }

  async getPublicMockups() {
    return this.prisma.landingMockup.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, role: true, category: true, imageUrl: true, thumbnailUrl: true },
    });
  }
}
