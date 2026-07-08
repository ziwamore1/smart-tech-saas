import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdmissionNumberService {
  private readonly logger = new Logger(AdmissionNumberService.name);

  constructor(private prisma: PrismaService) {}

  async getNextAdmissionNumber(schoolId: string, academicYearId: string): Promise<string> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new Error(`Academic year ${academicYearId} not found`);
    }

    const year = academicYear.startDate.getFullYear();

    const sequence = await this.prisma.admissionSequence.upsert({
      where: { schoolId_academicYearId: { schoolId, academicYearId } },
      update: { currentSequence: { increment: 1 } },
      create: {
        schoolId,
        academicYearId,
        year,
        currentSequence: 1,
      },
    });

    const admissionNumber = `ST-${sequence.year}-${String(sequence.currentSequence).padStart(3, '0')}`;

    this.logger.log(`Generated admission number ${admissionNumber} for school ${schoolId}, year ${year}`);

    return admissionNumber;
  }

  async previewNextAdmissionNumber(schoolId: string, academicYearId: string): Promise<string> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new Error(`Academic year ${academicYearId} not found`);
    }

    const year = academicYear.startDate.getFullYear();

    const sequence = await this.prisma.admissionSequence.findUnique({
      where: { schoolId_academicYearId: { schoolId, academicYearId } },
    });

    const nextSeq = sequence ? sequence.currentSequence + 1 : 1;

    return `ST-${year}-${String(nextSeq).padStart(3, '0')}`;
  }

  async validateAdmissionNumber(schoolId: string, admissionNumber: string): Promise<boolean> {
    const existing = await this.prisma.student.findUnique({
      where: { admissionNumber_schoolId: { admissionNumber, schoolId } },
    });
    return !existing;
  }

  async setManualAdmissionNumber(
    schoolId: string,
    academicYearId: string,
    manualNumber: string,
  ): Promise<string> {
    const pattern = /^ST-(\d{4})-(\d{3})$/;
    const match = manualNumber.match(pattern);

    if (!match) {
      throw new Error(`Invalid admission number format: ${manualNumber}. Expected format: ST-YYYY-XXX`);
    }

    const year = parseInt(match[1], 10);
    const seq = parseInt(match[2], 10);

    const valid = await this.validateAdmissionNumber(schoolId, manualNumber);
    if (!valid) {
      throw new Error(`Admission number ${manualNumber} already exists in this school`);
    }

    const sequence = await this.prisma.admissionSequence.upsert({
      where: { schoolId_academicYearId: { schoolId, academicYearId } },
      update: {
        currentSequence: seq,
        year,
      },
      create: {
        schoolId,
        academicYearId,
        year,
        currentSequence: seq,
      },
    });

    if (seq > sequence.currentSequence) {
      await this.prisma.admissionSequence.update({
        where: { schoolId_academicYearId: { schoolId, academicYearId } },
        data: { currentSequence: seq },
      });
    }

    return manualNumber;
  }
}
