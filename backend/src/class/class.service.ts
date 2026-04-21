import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassService {
  constructor(private prisma: PrismaService) {}

  async create(
    name: string,
    levelTypeId: string,
    order: number,
    schoolId: string,
    capacity?: number,
  ) {
    // Ensure levelType belongs to this school
    const levelType = await this.prisma.levelType.findUnique({
      where: { id: levelTypeId },
    });

    if (!levelType) throw new NotFoundException('Level type not found');

    if (levelType.schoolId !== schoolId)
      throw new ForbiddenException('Invalid level type');

    return this.prisma.class.create({
      data: {
        name,
        order,
        levelTypeId,
        schoolId,
        capacity,
      },
    });
  }

  async findAll(schoolId: string) {
    return this.prisma.class.findMany({
      where: { schoolId },
      include: {
        levelType: true,
        _count: {
          select: {
            enrollments: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      },
      orderBy: [
        { levelTypeId: 'asc' },
        { order: 'asc' }
      ]
    });
  }

  async findByLevel(levelTypeId: string, schoolId: string) {
    return this.prisma.class.findMany({
      where: {
        levelTypeId,
        schoolId,
      },
    });
  }

  async update(id: string, data: { name?: string; capacity?: number | null; order?: number }, schoolId: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
    });

    if (!classEntity) throw new NotFoundException('Class not found');
    if (classEntity.schoolId !== schoolId) throw new ForbiddenException('Access denied');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.order !== undefined) updateData.order = data.order;

    return this.prisma.class.update({
      where: { id },
      data: updateData,
    });
  }
}
