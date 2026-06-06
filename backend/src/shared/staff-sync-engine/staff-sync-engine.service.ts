import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class StaffSyncEngineService {
  private readonly logger = new Logger(StaffSyncEngineService.name);

  constructor(private prisma: PrismaService) {}

  private computeHash(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  async syncStaffProfile(teacherId: string, schoolId: string): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, created: 0, updated: 0, failed: 0, errors: [] };

    try {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        include: { user: true },
      });

      if (!teacher) {
        result.failed++;
        result.errors.push(`Teacher ${teacherId} not found`);
        return result;
      }

      const currentData = {
        employeeNumber: teacher.employeeNo,
        firstName: teacher.user?.firstName,
        lastName: teacher.user?.lastName,
        email: teacher.user?.email,
        phone: teacher.user?.phone,
        department: teacher.department,
        qualification: teacher.qualification,
        specialization: teacher.specialization,
        yearsOfExperience: teacher.yearsOfExperience,
        gender: teacher.gender,
        staffType: teacher.staffType,
        schoolId: teacher.schoolId,
      };

      const hash = this.computeHash(currentData);

      const existing = await this.prisma.staffHrProfile.findUnique({
        where: { staffId: teacherId },
      });

      if (existing) {
        if (existing.syncHash !== hash) {
          await this.prisma.staffHrProfile.update({
            where: { id: existing.id },
            data: {
              employeeNumber: teacher.employeeNo,
              syncHash: hash,
              syncStatus: 'SYNCED',
              lastSyncedAt: new Date(),
            },
          });

          await this.prisma.staffSyncLog.create({
            data: {
              profileId: existing.id,
              syncType: 'UPDATE',
              source: 'OPERATIONAL',
              changes: currentData as any,
              status: 'SUCCESS',
            },
          });

          result.updated++;
        }
      } else {
        const profile = await this.prisma.staffHrProfile.create({
          data: {
            staffId: teacherId,
            schoolId,
            employeeNumber: teacher.employeeNo,
            syncHash: hash,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });

        await this.prisma.staffSyncLog.create({
          data: {
            profileId: profile.id,
            syncType: 'CREATE',
            source: 'OPERATIONAL',
            changes: currentData as any,
            status: 'SUCCESS',
          },
        });

        result.created++;
      }

      result.synced++;
    } catch (error: any) {
      this.logger.error(`Sync failed for teacher ${teacherId}: ${error.message}`);
      result.failed++;
      result.errors.push(error.message);
    }

    return result;
  }

  async syncAllStaff(schoolId: string): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, created: 0, updated: 0, failed: 0, errors: [] };

    try {
      const teachers = await this.prisma.teacher.findMany({
        where: { schoolId },
      });

      for (const teacher of teachers) {
        const syncResult = await this.syncStaffProfile(teacher.id, schoolId);
        result.synced += syncResult.synced;
        result.created += syncResult.created;
        result.updated += syncResult.updated;
        result.failed += syncResult.failed;
        result.errors.push(...syncResult.errors);
      }

      this.logger.log(`Sync all staff for school ${schoolId}: ${result.synced} synced, ${result.created} created, ${result.updated} updated, ${result.failed} failed`);
    } catch (error: any) {
      this.logger.error(`Bulk sync failed for school ${schoolId}: ${error.message}`);
      result.failed++;
      result.errors.push(error.message);
    }

    return result;
  }

  async getProfileByStaffId(staffId: string) {
    return this.prisma.staffHrProfile.findUnique({
      where: { staffId },
      include: {
        qualifications: true,
        syncLogs: { orderBy: { syncedAt: 'desc' }, take: 5 },
      },
    });
  }

  async getSyncStatus(schoolId: string) {
    const profiles = await this.prisma.staffHrProfile.findMany({
      where: { schoolId },
      select: {
        id: true,
        syncStatus: true,
        lastSyncedAt: true,
        staffId: true,
      },
    });

    const total = profiles.length;
    const synced = profiles.filter(p => p.syncStatus === 'SYNCED').length;
    const pending = profiles.filter(p => p.syncStatus === 'PENDING').length;
    const conflict = profiles.filter(p => p.syncStatus === 'CONFLICT').length;

    return { total, synced, pending, conflict, profiles };
  }

  async getSyncHistory(schoolId: string, limit = 50) {
    return this.prisma.staffSyncLog.findMany({
      where: {
        profile: { schoolId },
      },
      orderBy: { syncedAt: 'desc' },
      take: limit,
      include: {
        profile: { select: { staffId: true, employeeNumber: true } },
      },
    });
  }
}
