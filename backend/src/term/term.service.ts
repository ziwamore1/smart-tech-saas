// src/term/term.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class TermService {
  constructor(private prisma: PrismaService) {}

  async create(data: any, schoolId: string) {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });

    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new Error('Invalid academic year');
    }

    return this.prisma.term.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        academicYearId: data.academicYearId,
      },
    });
  }

  async getCurrent(schoolId: string) {
    if (!schoolId) {
      return null;
    }

    const term = await this.prisma.term.findFirst({
      where: {
        isCurrent: true,
        academicYear: { schoolId },
      },
      include: { academicYear: true },
    });
    return term;
  }

  async findAll(academicYearId: string) {
    return this.prisma.term.findMany({
      where: { academicYearId },
      orderBy: { startDate: 'asc' },
    });
  }

  async findAllBySchool(schoolId: string) {
    return this.prisma.term.findMany({
      where: {
        academicYear: { schoolId },
      },
      include: { academicYear: true },
      orderBy: { startDate: 'desc' },
    });
  }

  async setCurrent(id: string, schoolId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id },
      include: { academicYear: true },
    });

    if (!term) {
      throw new Error('Term not found');
    }

    if (term.academicYear.schoolId !== schoolId)
      throw new Error('Access denied');

    await this.prisma.term.updateMany({
      where: { academicYearId: term.academicYearId },
      data: { isCurrent: false },
    });

    return this.prisma.term.update({
      where: { id },
      data: { isCurrent: true },
    });
  }

  async finalizeResults(schoolId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    if (term.resultsFinalized) {
      throw new ForbiddenException('Results already finalized');
    }

    return this.prisma.term.update({
      where: { id: termId },
      data: {
        resultsFinalized: true,
      },
    });
  }

  async unfinalizeResults(schoolId: string, termId: string) {
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!term || term.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Invalid term');
    }

    return this.prisma.term.update({
      where: { id: termId },
      data: {
        resultsFinalized: false,
      },
    });
  }
}
