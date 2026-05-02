import { Controller, Get, Post, Patch, Body, Param, Delete, Request } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('classrooms')
export class ClassroomController {
  constructor(private prisma: PrismaService) {
    console.log('ClassroomController initialized');
  }

  @Get()
  async findAll(@Request() req: any) {
    const where = req.user?.schoolId ? { schoolId: req.user.schoolId } : {};
    const classrooms = await this.prisma.classroom.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return { data: classrooms };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
    });
    return { data: classroom };
  }

@Post()
  async create(@Body() dto: { name: string; capacity?: number; schoolId: string; code?: string }) {
    const classroom = await this.prisma.classroom.create({
      data: {
        name: dto.name,
        capacity: dto.capacity,
        schoolId: dto.schoolId,
      },
    });
    return { data: classroom };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: { name?: string; capacity?: number; code?: string }) {
    const classroom = await this.prisma.classroom.update({
      where: { id },
      data: {
        name: dto.name,
        capacity: dto.capacity,
      },
    });
    return { data: classroom };
  }

  @Delete(':id')
  @Roles('Director', 'Admin')
  async delete(@Param('id') id: string) {
    await this.prisma.classroom.delete({ where: { id } });
    return { data: { success: true } };
  }
}
