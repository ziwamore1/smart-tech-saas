import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LevelTypeService {
  constructor(private prisma: PrismaService) {}

  async create(name: string, schoolId: string) {
    return this.prisma.levelType.create({
      data: {
        name,
        schoolId,
      },
    });
  }

  async findAll(schoolId: string) {
    return this.prisma.levelType.findMany({
      where: { schoolId },
      include: {
        classes: true,
      },
    });
  }
}
