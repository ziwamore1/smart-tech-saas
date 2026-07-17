import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffSyncEngineService } from '../../shared/staff-sync-engine/staff-sync-engine.service';

@Injectable()
export class StaffRecordsService {
  private readonly logger = new Logger(StaffRecordsService.name);

  constructor(
    private prisma: PrismaService,
    private syncEngine: StaffSyncEngineService,
  ) {}

  // ══════════════════════════════════════════
  // HR PROFILES
  // ══════════════════════════════════════════

  async findAllProfiles(schoolId: string) {
    let profiles = await this.prisma.staffHrProfile.findMany({
      where: { schoolId },
      include: { qualifications: true, employmentRecords: true, positions: true },
      orderBy: { createdAt: 'desc' },
    });

    if (profiles.length === 0) {
      await this.autoSyncFromTeachers(schoolId);
      profiles = await this.prisma.staffHrProfile.findMany({
        where: { schoolId },
        include: { qualifications: true, employmentRecords: true, positions: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return profiles;
  }

  async autoSyncFromTeachers(schoolId: string) {
    const teachers = await this.prisma.teacher.findMany({
      where: { schoolId },
      include: { user: true },
    });

    let created = 0;
    for (const teacher of teachers) {
      const existing = await this.prisma.staffHrProfile.findUnique({
        where: { staffId: teacher.id },
      });
      if (existing) continue;

      const fullName = teacher.user
        ? `${teacher.user.firstName || ''} ${teacher.user.lastName || ''}`.trim()
        : 'Unknown';

      try {
        await this.prisma.staffHrProfile.create({
          data: {
            staffId: teacher.id,
            schoolId,
            teacherName: fullName,
            employeeNumber: teacher.employeeNo || null,
            gender: teacher.gender || null,
            emailAddress: teacher.user?.email || null,
            phoneNumber: teacher.user?.phone || null,
            substantivePosition: teacher.department || null,
            academicQualification: teacher.qualification || null,
            specialization: teacher.specialization || null,
            employmentStatus: 'ACTIVE',
            employmentType: teacher.staffType === 'NON_TEACHING' ? 'NON_TEACHING' : 'TEACHING',
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });
        created++;
      } catch (err: any) {
        this.logger.warn(`Failed to auto-sync teacher ${teacher.id}: ${err.message}`);
      }
    }

    if (created > 0) {
      this.logger.log(`Auto-synced ${created} teacher(s) to HR profiles for school ${schoolId}`);
    }
    return { created };
  }

  async findProfileById(id: string) {
    const profile = await this.prisma.staffHrProfile.findUnique({
      where: { id },
      include: {
        qualifications: true,
        employmentRecords: { orderBy: { startDate: 'desc' } },
        positions: { orderBy: { startDate: 'desc' } },
        allowances: { where: { isActive: true } },
        contracts: { where: { isCurrent: true } },
        transfers: { orderBy: { createdAt: 'desc' }, take: 10 },
        syncLogs: { orderBy: { syncedAt: 'desc' }, take: 10 },
      },
    });

    if (!profile) throw new NotFoundException('HR profile not found');
    return profile;
  }

  async findProfileByStaffId(staffId: string) {
    const profile = await this.prisma.staffHrProfile.findUnique({
      where: { staffId },
      include: {
        qualifications: true,
        employmentRecords: { orderBy: { startDate: 'desc' } },
        positions: { orderBy: { startDate: 'desc' } },
        allowances: { where: { isActive: true } },
        contracts: { where: { isCurrent: true } },
        transfers: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!profile) throw new NotFoundException('HR profile not found for this staff member');
    return profile;
  }

  async searchProfiles(schoolId: string, query: string) {
    return this.prisma.staffHrProfile.findMany({
      where: {
        schoolId,
        OR: [
          { teacherName: { contains: query, mode: 'insensitive' } },
          { employeeNumber: { contains: query, mode: 'insensitive' } },
          { nrcNumber: { contains: query, mode: 'insensitive' } },
          { tsNumber: { contains: query, mode: 'insensitive' } },
          { phoneNumber: { contains: query, mode: 'insensitive' } },
          { emailAddress: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  async createProfile(data: any, schoolId: string) {
    const existing = await this.prisma.staffHrProfile.findUnique({
      where: { staffId: data.staffId },
    });
    if (existing) return this.updateProfile(existing.id, data);

    const profile = await this.prisma.staffHrProfile.create({
      data: this.mapProfileData(data, schoolId),
    });

    await this.syncEngine.syncStaffProfile(data.staffId, schoolId);
    return profile;
  }

  async updateProfile(id: string, data: any) {
    const existing = await this.prisma.staffHrProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('HR profile not found');
    return this.prisma.staffHrProfile.update({
      where: { id },
      data: this.mapProfileData(data),
    });
  }

  async deleteProfile(id: string) {
    const existing = await this.prisma.staffHrProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('HR profile not found');
    await this.prisma.staffHrProfile.delete({ where: { id } });
    return { message: 'HR profile deleted successfully' };
  }

  private mapProfileData(data: any, schoolId?: string) {
    const fields: any = {};

    if (schoolId) fields.schoolId = schoolId;
    if (data.staffId !== undefined) fields.staffId = data.staffId;
    if (data.employeeNumber !== undefined) fields.employeeNumber = data.employeeNumber;
    if (data.province !== undefined) fields.province = data.province;
    if (data.district !== undefined) fields.district = data.district;
    if (data.station !== undefined) fields.station = data.station;
    if (data.teacherName !== undefined) fields.teacherName = data.teacherName;
    if (data.gender !== undefined) fields.gender = data.gender;
    if (data.dateOfBirth !== undefined) fields.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.maritalStatus !== undefined) fields.maritalStatus = data.maritalStatus;
    if (data.nrcNumber !== undefined) fields.nrcNumber = data.nrcNumber;
    if (data.tsNumber !== undefined) fields.tsNumber = data.tsNumber;
    if (data.aesNumber !== undefined) fields.aesNumber = data.aesNumber;
    if (data.substantivePosition !== undefined) fields.substantivePosition = data.substantivePosition;
    if (data.substantiveScale !== undefined) fields.substantiveScale = data.substantiveScale;
    if (data.actingPosition !== undefined) fields.actingPosition = data.actingPosition;
    if (data.administration !== undefined) fields.administration = data.administration;
    if (data.actingType !== undefined) fields.actingType = data.actingType;
    if (data.dateOfFirstAppointment !== undefined) fields.dateOfFirstAppointment = data.dateOfFirstAppointment ? new Date(data.dateOfFirstAppointment) : null;
    if (data.dateOfPresentAppointment !== undefined) fields.dateOfPresentAppointment = data.dateOfPresentAppointment ? new Date(data.dateOfPresentAppointment) : null;
    if (data.dateOfActingAppointment !== undefined) fields.dateOfActingAppointment = data.dateOfActingAppointment ? new Date(data.dateOfActingAppointment) : null;
    if (data.confirmed !== undefined) fields.confirmed = data.confirmed;
    if (data.expectedConfirmationDate !== undefined) fields.expectedConfirmationDate = data.expectedConfirmationDate ? new Date(data.expectedConfirmationDate) : null;
    if (data.allowancesEntitled !== undefined) fields.allowancesEntitled = data.allowancesEntitled;
    if (data.employmentStatus !== undefined) fields.employmentStatus = data.employmentStatus;
    if (data.employmentType !== undefined) fields.employmentType = data.employmentType;
    if (data.contractEffectiveDate !== undefined) fields.contractEffectiveDate = data.contractEffectiveDate ? new Date(data.contractEffectiveDate) : null;
    if (data.contractNormalised !== undefined) fields.contractNormalised = data.contractNormalised;
    if (data.contractEnd !== undefined) fields.contractEnd = data.contractEnd ? new Date(data.contractEnd) : null;
    if (data.retirementDate !== undefined) fields.retirementDate = data.retirementDate ? new Date(data.retirementDate) : null;
    if (data.payrollPoint !== undefined) fields.payrollPoint = data.payrollPoint;
    if (data.academicQualification !== undefined) fields.academicQualification = data.academicQualification;
    if (data.professionalQualification !== undefined) fields.professionalQualification = data.professionalQualification;
    if (data.yearOfQualification !== undefined) fields.yearOfQualification = data.yearOfQualification ? parseInt(data.yearOfQualification) : null;
    if (data.specialization !== undefined) fields.specialization = data.specialization;
    if (data.nationality !== undefined) fields.nationality = data.nationality;
    if (data.emailAddress !== undefined) fields.emailAddress = data.emailAddress;
    if (data.phoneNumber !== undefined) fields.phoneNumber = data.phoneNumber;
    if (data.currentPosition !== undefined) fields.currentPosition = data.currentPosition;
    if (data.gradeLevel !== undefined) fields.gradeLevel = data.gradeLevel;
    if (data.step !== undefined) fields.step = data.step ? parseInt(data.step) : null;
    if (data.taxId !== undefined) fields.taxId = data.taxId;
    if (data.pensionNumber !== undefined) fields.pensionNumber = data.pensionNumber;
    if (data.bankName !== undefined) fields.bankName = data.bankName;
    if (data.bankBranch !== undefined) fields.bankBranch = data.bankBranch;
    if (data.bankAccount !== undefined) fields.bankAccount = data.bankAccount;
    if (data.socialSecurityNumber !== undefined) fields.socialSecurityNumber = data.socialSecurityNumber;
    if (data.nextOfKin !== undefined) fields.nextOfKin = data.nextOfKin;
    if (data.nextOfKinContact !== undefined) fields.nextOfKinContact = data.nextOfKinContact;
    if (data.nextOfKinRelationship !== undefined) fields.nextOfKinRelationship = data.nextOfKinRelationship;
    if (data.dynamicFields !== undefined) fields.dynamicFields = data.dynamicFields as any;

    return fields;
  }

  // ══════════════════════════════════════════
  // EMPLOYMENT RECORDS
  // ══════════════════════════════════════════

  async findEmploymentRecords(profileId: string) {
    return this.prisma.staffEmploymentRecord.findMany({
      where: { profileId },
      orderBy: { startDate: 'desc' },
    });
  }

  async addEmploymentRecord(profileId: string, data: any) {
    const profile = await this.prisma.staffHrProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.staffEmploymentRecord.create({
      data: {
        profileId,
        schoolId: data.schoolId || profile.schoolId,
        schoolName: data.schoolName,
        position: data.position,
        scale: data.scale,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isCurrent: data.isCurrent !== undefined ? data.isCurrent : false,
        recordType: data.recordType || 'EMPLOYMENT',
        notes: data.notes,
      },
    });
  }

  async deleteEmploymentRecord(id: string) {
    await this.prisma.staffEmploymentRecord.delete({ where: { id } });
    return { message: 'Employment record deleted' };
  }

  // ══════════════════════════════════════════
  // POSITIONS
  // ══════════════════════════════════════════

  async findPositions(profileId: string) {
    return this.prisma.staffPosition.findMany({
      where: { profileId },
      orderBy: { startDate: 'desc' },
    });
  }

  async addPosition(profileId: string, data: any) {
    const profile = await this.prisma.staffHrProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    if (data.isCurrent) {
      await this.prisma.staffPosition.updateMany({
        where: { profileId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.staffPosition.create({
      data: {
        profileId,
        positionTitle: data.positionTitle,
        positionType: data.positionType || 'SUBSTANTIVE',
        scale: data.scale,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isCurrent: data.isCurrent !== undefined ? data.isCurrent : true,
        isActing: data.isActing || false,
        notes: data.notes,
      },
    });
  }

  // ══════════════════════════════════════════
  // ALLOWANCES
  // ══════════════════════════════════════════

  async findAllowances(profileId: string) {
    return this.prisma.staffAllowance.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addAllowance(profileId: string, data: any) {
    const profile = await this.prisma.staffHrProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    return this.prisma.staffAllowance.create({
      data: {
        profileId,
        allowanceName: data.allowanceName,
        allowanceType: data.allowanceType,
        amount: data.amount ? parseFloat(data.amount) : null,
        currency: data.currency || 'ZMW',
        isActive: true,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes,
      },
    });
  }

  async toggleAllowance(id: string) {
    const allowance = await this.prisma.staffAllowance.findUnique({ where: { id } });
    if (!allowance) throw new NotFoundException('Allowance not found');

    return this.prisma.staffAllowance.update({
      where: { id },
      data: { isActive: !allowance.isActive },
    });
  }

  // ══════════════════════════════════════════
  // CONTRACTS
  // ══════════════════════════════════════════

  async findContracts(profileId: string) {
    return this.prisma.staffContract.findMany({
      where: { profileId },
      orderBy: { startDate: 'desc' },
    });
  }

  async addContract(profileId: string, data: any) {
    const profile = await this.prisma.staffHrProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Profile not found');

    if (data.isCurrent) {
      await this.prisma.staffContract.updateMany({
        where: { profileId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return this.prisma.staffContract.create({
      data: {
        profileId,
        contractType: data.contractType,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isPermanent: data.isPermanent || false,
        isCurrent: data.isCurrent !== undefined ? data.isCurrent : true,
        documentUrl: data.documentUrl,
        notes: data.notes,
      },
    });
  }

  // ══════════════════════════════════════════
  // SYNC
  // ══════════════════════════════════════════

  async syncProfile(id: string) {
    const profile = await this.prisma.staffHrProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('HR profile not found');
    return this.syncEngine.syncStaffProfile(profile.staffId, profile.schoolId);
  }

  async syncAll(schoolId: string) {
    return this.syncEngine.syncAllStaff(schoolId);
  }

  async getSyncStatus(schoolId: string) {
    return this.syncEngine.getSyncStatus(schoolId);
  }

  async getSyncHistory(schoolId: string) {
    return this.syncEngine.getSyncHistory(schoolId);
  }

  async getSchoolInfo(schoolId: string) {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, province: true, district: true, logoUrl: true },
    });
  }

  // ══════════════════════════════════════════
  // TRANSFERS
  // ══════════════════════════════════════════

  async findAllTransfers(schoolId: string) {
    return this.prisma.staffTransfer.findMany({
      where: { OR: [{ fromSchoolId: schoolId }, { toSchoolId: schoolId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findTransferById(id: string) {
    const transfer = await this.prisma.staffTransfer.findUnique({
      where: { id },
      include: { profile: { select: { id: true, staffId: true, employeeNumber: true, teacherName: true } } },
    });
    if (!transfer) throw new NotFoundException('Staff transfer not found');
    return transfer;
  }

  async createTransfer(data: any) {
    if (!data.transferDate) data.transferDate = new Date().toISOString();
    if (!data.effectiveDate) data.effectiveDate = data.transferDate;

    return this.prisma.staffTransfer.create({
      data: {
        profileId: data.profileId,
        transferType: data.transferType,
        fromSchoolId: data.fromSchoolId,
        toSchoolId: data.toSchoolId,
        fromSchoolName: data.fromSchoolName,
        toSchoolName: data.toSchoolName,
        fromDistrict: data.fromDistrict,
        toDistrict: data.toDistrict,
        fromProvince: data.fromProvince,
        toProvince: data.toProvince,
        transferDate: new Date(data.transferDate),
        effectiveDate: new Date(data.effectiveDate),
        reason: data.reason,
        notes: data.notes,
        status: 'PENDING',
      },
    });
  }

  async approveTransfer(id: string, approvedBy: string) {
    const transfer = await this.prisma.staffTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Staff transfer not found');
    return this.prisma.staffTransfer.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    });
  }

  async completeTransfer(id: string) {
    const transfer = await this.prisma.staffTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Staff transfer not found');
    return this.prisma.staffTransfer.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  async deleteTransfer(id: string) {
    await this.prisma.staffTransfer.delete({ where: { id } });
    return { message: 'Staff transfer deleted' };
  }

  // ══════════════════════════════════════════
  // QUALIFICATIONS
  // ══════════════════════════════════════════

  async findQualificationsByProfile(profileId: string) {
    return this.prisma.staffQualification.findMany({
      where: { profileId },
      orderBy: { yearObtained: 'desc' },
    });
  }

  async addQualification(data: any) {
    return this.prisma.staffQualification.create({
      data: {
        profileId: data.profileId,
        qualificationType: data.qualificationType,
        qualificationName: data.qualificationName,
        institution: data.institution,
        yearObtained: data.yearObtained ? parseInt(data.yearObtained) : null,
        grade: data.grade,
        documentUrl: data.documentUrl,
      },
    });
  }

  async verifyQualification(id: string, verifiedBy: string) {
    const qual = await this.prisma.staffQualification.findUnique({ where: { id } });
    if (!qual) throw new NotFoundException('Qualification not found');
    return this.prisma.staffQualification.update({
      where: { id },
      data: { isVerified: true, verifiedBy, verifiedAt: new Date() },
    });
  }

  async deleteQualification(id: string) {
    await this.prisma.staffQualification.delete({ where: { id } });
    return { message: 'Qualification deleted' };
  }

  // ══════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════

  async getStaffAnalytics(schoolId: string) {
    const profiles = await this.prisma.staffHrProfile.findMany({
      where: { schoolId },
      select: {
        employmentStatus: true,
        employmentType: true,
        gradeLevel: true,
        dateOfFirstAppointment: true,
        gender: true,
        province: true,
        district: true,
        qualifications: { select: { qualificationType: true } },
      },
    });

    const total = profiles.length;
    const statusBreakdown = this.countBy(profiles, 'employmentStatus', 'UNKNOWN');
    const typeBreakdown = this.countBy(profiles, 'employmentType', 'UNKNOWN');
    const gradeBreakdown = this.countBy(profiles, 'gradeLevel', 'UNGRADED');
    const genderBreakdown = this.countBy(profiles, 'gender', 'UNSPECIFIED');
    const districtBreakdown = this.countBy(profiles, 'district', 'UNKNOWN');
    const provinceBreakdown = this.countBy(profiles, 'province', 'UNKNOWN');

    const now = new Date();
    const avgYearsInService = total > 0
      ? profiles.reduce((sum: number, p: any) => {
          if (!p.dateOfFirstAppointment) return sum;
          const diff = now.getFullYear() - new Date(p.dateOfFirstAppointment).getFullYear();
          return sum + diff;
        }, 0) / total
      : 0;

    const qualificationLevels = this.countBy(
      profiles.map((p: any) => ({ level: this.getHighestQualification(p.qualifications?.map((q: any) => q.qualificationType) || []) })),
      'level',
      'NONE',
    );

    return {
      total,
      statusBreakdown,
      typeBreakdown,
      gradeBreakdown,
      genderBreakdown,
      districtBreakdown,
      provinceBreakdown,
      avgYearsInService: Math.round(avgYearsInService * 10) / 10,
      qualificationLevels,
    };
  }

  private countBy(items: any[], field: string, defaultVal: string): Record<string, number> {
    return items.reduce((acc: Record<string, number>, item: any) => {
      const key = item[field] || defaultVal;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getHighestQualification(types: string[]): string {
    const order = ['PHD', 'MASTERS', 'DEGREE', 'DIPLOMA', 'CERTIFICATE'];
    for (const level of order) {
      if (types.some((t) => t.toUpperCase().includes(level))) return level;
    }
    return types[0] || 'NONE';
  }

  async getDistrictStaffSummary(district: string) {
    const schools = await this.prisma.school.findMany({
      where: { district },
      select: { id: true, name: true },
    });

    const schoolIds = schools.map((s) => s.id);
    const profiles = await this.prisma.staffHrProfile.findMany({
      where: { schoolId: { in: schoolIds } },
      select: { schoolId: true, employmentStatus: true, employmentType: true, gradeLevel: true, gender: true },
    });

    const bySchool = schools.map((school) => {
      const schoolProfiles = profiles.filter((p) => p.schoolId === school.id);
      return {
        schoolId: school.id,
        schoolName: school.name,
        total: schoolProfiles.length,
        active: schoolProfiles.filter((p) => p.employmentStatus === 'ACTIVE').length,
        permanent: schoolProfiles.filter((p) => p.employmentType === 'PERMANENT').length,
        contract: schoolProfiles.filter((p) => p.employmentType === 'CONTRACT').length,
      };
    });

    return { district, totalSchools: schools.length, totalStaff: profiles.length, bySchool };
  }
}
