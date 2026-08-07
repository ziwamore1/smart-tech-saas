import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdmissionNumberService {
  private readonly logger = new Logger(AdmissionNumberService.name);

  constructor(private prisma: PrismaService) {}

  async getNextAdmissionNumber(schoolId: string, academicYearId: string, classId?: string): Promise<string> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new Error(`Academic year ${academicYearId} not found`);
    }

    const year = academicYear.startDate.getFullYear();
    const effectiveClassId = classId || '__SCHOOL__';

    const sequence = await this.prisma.admissionSequence.upsert({
      where: { schoolId_academicYearId_classId: { schoolId, academicYearId, classId: effectiveClassId } },
      update: { currentSequence: { increment: 1 } },
      create: {
        schoolId,
        academicYearId,
        classId: effectiveClassId,
        year,
        currentSequence: 1,
      },
    });

    const admissionNumber = `ST-${sequence.year}-${String(sequence.currentSequence).padStart(3, '0')}`;

    this.logger.log(`Generated admission number ${admissionNumber} for school ${schoolId}, class ${classId || 'school'}, year ${year}`);

    return admissionNumber;
  }

  async previewNextAdmissionNumber(schoolId: string, academicYearId: string, classId?: string): Promise<string> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new Error(`Academic year ${academicYearId} not found`);
    }

    const year = academicYear.startDate.getFullYear();
    const effectiveClassId = classId || '__SCHOOL__';

    const sequence = await this.prisma.admissionSequence.findUnique({
      where: { schoolId_academicYearId_classId: { schoolId, academicYearId, classId: effectiveClassId } },
    });

    const nextSeq = sequence ? sequence.currentSequence + 1 : 1;

    return `ST-${year}-${String(nextSeq).padStart(3, '0')}`;
  }

  async validateAdmissionNumber(schoolId: string, admissionNumber: string, classId?: string): Promise<boolean> {
    const where: any = { admissionNumber, schoolId };
    if (classId) where.classId = classId;
    const existing = await this.prisma.student.findFirst({ where });
    return !existing;
  }

  /**
   * Re-sequences the admission numbers for every ACTIVE student enrolled in a
   * class for a given academic year. Remaining students are renumbered from
   * ST-YYYY-001 upward (filling any gaps left by removed students) and the
   * class AdmissionSequence counter is reset so the next admitted student
   * continues seamlessly. This removes the need to manually backfill or
   * re-sequence a class after a student is removed.
   *
   * Student login credentials are untouched: only the Student.admissionNumber
   * column is updated, never the linked User record.
   */
  async resequenceClass(schoolId: string, academicYearId: string, classId: string): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.prisma.$transaction(
          (tx) => this.resequenceClassInTransaction(tx, schoolId, academicYearId, classId),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 },
        );
        return;
      } catch (error: any) {
        const message = String(error?.message || '');
        const retryable = error?.code === 'P2034' || message.includes('write conflict') || message.includes('deadlock');
        if (!retryable || attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  async resequenceClassInTransaction(
    tx: Prisma.TransactionClient,
    schoolId: string,
    academicYearId: string,
    classId: string,
  ): Promise<void> {
    const academicYear = await tx.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new Error(`Academic year ${academicYearId} not found`);
    }

    const year = academicYear.startDate.getFullYear();
    const prefix = `ST-${year}-`;

    const enrollments = await tx.enrollment.findMany({
      where: {
        classId,
        academicYearId,
        schoolId,
        status: 'ACTIVE',
      },
      orderBy: [{ sequenceNumber: 'asc' }, { student: { admissionNumber: 'asc' } }, { studentId: 'asc' }],
      select: { id: true, studentId: true, sequenceNumber: true, student: { select: { id: true, admissionNumber: true, classId: true } } },
    });

    const orderedEnrollments = [...enrollments].sort((a, b) => {
      if (a.sequenceNumber != null && b.sequenceNumber != null && a.sequenceNumber !== b.sequenceNumber) {
        return a.sequenceNumber - b.sequenceNumber;
      }
      if (a.sequenceNumber != null) return -1;
      if (b.sequenceNumber != null) return 1;
      const admissionCompare = a.student.admissionNumber.localeCompare(b.student.admissionNumber, undefined, { numeric: true });
      return admissionCompare || a.studentId.localeCompare(b.studentId);
    });

    // Clear positions before assigning the contiguous range so the unique
    // register constraint cannot collide with an existing position.
    await tx.enrollment.updateMany({
      where: { classId, academicYearId, schoolId, status: 'ACTIVE' },
      data: { sequenceNumber: null },
    });

    const currentClassStudents = orderedEnrollments.filter((enrollment) => enrollment.student.classId === classId);
    const attachedStudents = await tx.student.findMany({
      where: { classId },
      select: { id: true, admissionNumber: true },
    });
    const originalNumbers = new Map(attachedStudents.map((student) => [student.id, student.admissionNumber]));
    for (const student of attachedStudents) {
      await tx.student.update({
        where: { id: student.id },
        data: { admissionNumber: `TMP-${student.id.slice(0, 12)}` },
      });
    }

    for (let i = 0; i < orderedEnrollments.length; i++) {
      const enrollment = orderedEnrollments[i];
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { sequenceNumber: i + 1 },
      });
      if (enrollment.student.classId === classId) {
        await tx.student.update({
          where: { id: enrollment.student.id },
          data: { admissionNumber: `${prefix}${String(i + 1).padStart(3, '0')}` },
        });
      }
    }

    const activeStudentIds = new Set(currentClassStudents.map((enrollment) => enrollment.student.id));
    for (const student of attachedStudents) {
      if (activeStudentIds.has(student.id)) continue;
      const original = originalNumbers.get(student.id)!;
      const isUsedByActive = orderedEnrollments.some((enrollment, index) =>
        enrollment.student.classId === classId
        && `ST-${year}-${String(index + 1).padStart(3, '0')}` === original,
      );
      await tx.student.update({
        where: { id: student.id },
        data: { admissionNumber: isUsedByActive ? `HIST-${student.id.slice(0, 12)}` : original },
      });
    }

    await tx.admissionSequence.upsert({
      where: { schoolId_academicYearId_classId: { schoolId, academicYearId, classId } },
      update: { currentSequence: orderedEnrollments.length, year },
      create: {
        schoolId,
        academicYearId,
        classId,
        year,
        currentSequence: orderedEnrollments.length,
      },
    });

    this.logger.log(
      `Re-sequenced class ${classId} (${academicYearId}): ${orderedEnrollments.length} student(s) → ${prefix}001..${String(orderedEnrollments.length).padStart(3, '0')}`,
    );
  }

  async setManualAdmissionNumber(
    schoolId: string,
    academicYearId: string,
    manualNumber: string,
    classId?: string,
  ): Promise<string> {
    const pattern = /^ST-(\d{4})-(\d{3})$/;
    const match = manualNumber.match(pattern);

    if (!match) {
      throw new Error(`Invalid admission number format: ${manualNumber}. Expected format: ST-YYYY-XXX`);
    }

    const year = parseInt(match[1], 10);
    const seq = parseInt(match[2], 10);

    const valid = await this.validateAdmissionNumber(schoolId, manualNumber, classId);
    if (!valid) {
      throw new Error(`Admission number ${manualNumber} already exists in this school`);
    }

    const effectiveClassId = classId || '__SCHOOL__';

    const sequence = await this.prisma.admissionSequence.upsert({
      where: { schoolId_academicYearId_classId: { schoolId, academicYearId, classId: effectiveClassId } },
      update: {
        currentSequence: seq,
        year,
      },
      create: {
        schoolId,
        academicYearId,
        classId: effectiveClassId,
        year,
        currentSequence: seq,
      },
    });

    if (seq > sequence.currentSequence) {
      await this.prisma.admissionSequence.update({
        where: { schoolId_academicYearId_classId: { schoolId, academicYearId, classId: effectiveClassId } },
        data: { currentSequence: seq },
      });
    }

    return manualNumber;
  }
}
