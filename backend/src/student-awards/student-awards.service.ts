import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const SPORTS_CATEGORIES = [
  'ATHLETICS', 'FOOTBALL', 'BASKETBALL', 'VOLLEYBALL', 'NETBALL', 'RUGBY', 'HOCKEY',
  'TENNIS', 'TABLE_TENNIS', 'BADMINTON', 'SWIMMING', 'BOXING', 'WRESTLING', 'GYMNASTICS',
  'CRICKET', 'HANDBALL', 'BASEBALL', 'SOFTBALL', 'CYCLING', 'MARTIAL_ARTS', 'ARCHERY',
  'ROWING', 'CHESS', 'DRAUGHTS', 'OTHER',
] as const;

const ROLE_CATALOG: Record<string, Array<{ code: string; title: string; minimumPoints: number }>> = {
  PRIMARY_SCHOOL: [
    { code: 'HEAD_BOY', title: 'Head Boy', minimumPoints: 20 }, { code: 'HEAD_GIRL', title: 'Head Girl', minimumPoints: 20 },
    { code: 'VICE_HEAD_BOY', title: 'Vice Head Boy', minimumPoints: 15 }, { code: 'VICE_HEAD_GIRL', title: 'Vice Head Girl', minimumPoints: 15 },
    { code: 'DEPUTY_HEAD_BOY', title: 'Deputy Head Boy', minimumPoints: 15 }, { code: 'DEPUTY_HEAD_GIRL', title: 'Deputy Head Girl', minimumPoints: 15 },
    { code: 'SENIOR_PREFECT', title: 'Senior Prefect', minimumPoints: 15 }, { code: 'CLASS_PREFECT', title: 'Class Prefect', minimumPoints: 10 },
    { code: 'SPORTS_PREFECT', title: 'Sports Prefect', minimumPoints: 10 }, { code: 'GENERAL_PREFECT', title: 'General Prefect', minimumPoints: 10 },
  ],
  SECONDARY_SCHOOL: [
    { code: 'HEAD_BOY', title: 'Head Boy', minimumPoints: 30 }, { code: 'HEAD_GIRL', title: 'Head Girl', minimumPoints: 30 },
    { code: 'VICE_HEAD_BOY', title: 'Vice Head Boy', minimumPoints: 25 }, { code: 'VICE_HEAD_GIRL', title: 'Vice Head Girl', minimumPoints: 25 },
    { code: 'DEPUTY_HEAD_BOY', title: 'Deputy Head Boy', minimumPoints: 25 }, { code: 'DEPUTY_HEAD_GIRL', title: 'Deputy Head Girl', minimumPoints: 25 },
    { code: 'PU_PREFECT', title: 'PU Prefect', minimumPoints: 20 }, { code: 'SPORTS_PREFECT', title: 'Sports Prefect', minimumPoints: 15 },
    { code: 'ACADEMIC_PREFECT', title: 'Academic Prefect', minimumPoints: 15 }, { code: 'GENERAL_PREFECT', title: 'General Prefect', minimumPoints: 15 },
    { code: 'HOUSE_CAPTAIN', title: 'House Captain', minimumPoints: 15 }, { code: 'CLASS_PREFECT', title: 'Class Prefect', minimumPoints: 10 },
  ],
  ADVANCED_SECONDARY: [
    { code: 'HEAD_BOY', title: 'Head Boy', minimumPoints: 30 }, { code: 'HEAD_GIRL', title: 'Head Girl', minimumPoints: 30 },
    { code: 'VICE_HEAD_BOY', title: 'Vice Head Boy', minimumPoints: 25 }, { code: 'VICE_HEAD_GIRL', title: 'Vice Head Girl', minimumPoints: 25 },
    { code: 'PU_PREFECT', title: 'PU Prefect', minimumPoints: 20 }, { code: 'SPORTS_PREFECT', title: 'Sports Prefect', minimumPoints: 15 },
    { code: 'ACADEMIC_PREFECT', title: 'Academic Prefect', minimumPoints: 15 }, { code: 'GENERAL_PREFECT', title: 'General Prefect', minimumPoints: 15 },
  ],
  COLLEGE: [
    { code: 'UNION_PRESIDENT', title: 'Union President', minimumPoints: 35 }, { code: 'UNION_VICE_PRESIDENT', title: 'Union Vice President', minimumPoints: 30 },
    { code: 'UNION_SECRETARY', title: 'Union Secretary', minimumPoints: 25 }, { code: 'UNION_TREASURER', title: 'Union Treasurer', minimumPoints: 25 },
    { code: 'FACULTY_REPRESENTATIVE', title: 'Faculty Representative', minimumPoints: 20 }, { code: 'CLASS_REPRESENTATIVE', title: 'Class Representative', minimumPoints: 15 },
  ],
  UNIVERSITY: [
    { code: 'UNION_PRESIDENT', title: 'Union President', minimumPoints: 40 }, { code: 'UNION_VICE_PRESIDENT', title: 'Union Vice President', minimumPoints: 35 },
    { code: 'UNION_SECRETARY', title: 'Union Secretary', minimumPoints: 30 }, { code: 'UNION_TREASURER', title: 'Union Treasurer', minimumPoints: 30 },
    { code: 'SCHOOL_REPRESENTATIVE', title: 'School Representative', minimumPoints: 25 }, { code: 'FACULTY_REPRESENTATIVE', title: 'Faculty Representative', minimumPoints: 25 },
    { code: 'CLASS_REPRESENTATIVE', title: 'Class Representative', minimumPoints: 15 },
  ],
};

@Injectable()
export class StudentAwardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(schoolId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { institutionType: { select: { code: true } } } });
    const tier = String(school?.institutionType?.code || 'SECONDARY_SCHOOL');
    const customRoles = await this.prisma.studentLeadershipRole.findMany({ where: { schoolId, institutionTier: tier, isActive: true }, select: { code: true, title: true, minimumPoints: true } });
    return { institutionTier: tier, leadershipRoles: [...(ROLE_CATALOG[tier] || ROLE_CATALOG.SECONDARY_SCHOOL), ...customRoles], sportsCategories: SPORTS_CATEGORIES };
  }

  async addRole(schoolId: string, data: any) {
    const title = String(data.title || '').trim();
    const code = String(data.code || title).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!title || !code) throw new BadRequestException('Leadership role title is required');
    const minimumPoints = Math.max(1, Math.round(Number(data.minimumPoints) || 10));
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { institutionType: { select: { code: true } } } });
    return this.prisma.studentLeadershipRole.create({ data: { schoolId, code, title, minimumPoints, institutionTier: data.institutionTier || school?.institutionType?.code || 'SECONDARY_SCHOOL' } });
  }

  async appoint(schoolId: string, appointedBy: string, data: any) {
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, status: 'ACTIVE' }, select: { id: true } });
    if (!student) throw new NotFoundException('Active student not found in this school');
    const catalog = await this.getCatalog(schoolId);
    const role = catalog.leadershipRoles.find((item) => item.code === data.roleCode);
    if (!role) throw new BadRequestException('Leadership role is not available for this institution type');
    if (!data.startDate) throw new BadRequestException('Leadership appointment startDate is required');
    return this.prisma.studentLeadershipAppointment.create({
      data: { schoolId, studentId: student.id, classId: data.classId || null, roleCode: role.code, roleTitle: role.title, institutionTier: catalog.institutionTier, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null, appointedBy, recommendation: data.recommendation || null },
      include: { duties: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    });
  }

  async addDuty(schoolId: string, appointmentId: string, data: any) {
    const appointment = await this.prisma.studentLeadershipAppointment.findFirst({ where: { id: appointmentId, schoolId } });
    if (!appointment) throw new NotFoundException('Leadership appointment not found');
    if (!data.title || Number(data.pointsPossible) < 1) throw new BadRequestException('Duty title and positive pointsPossible are required');
    return this.prisma.studentLeadershipDuty.create({ data: { appointmentId, title: data.title, description: data.description || null, pointsPossible: Math.round(Number(data.pointsPossible)), evidence: data.evidence || null } });
  }

  async completeDuty(schoolId: string, dutyId: string, verifiedBy: string, data: any) {
    const duty = await this.prisma.studentLeadershipDuty.findFirst({ where: { id: dutyId, appointment: { schoolId } }, include: { appointment: true } });
    if (!duty) throw new NotFoundException('Leadership duty not found');
    const points = Math.max(0, Math.min(duty.pointsPossible, Math.round(Number(data.pointsAwarded))));
    const updated = await this.prisma.studentLeadershipDuty.update({ where: { id: dutyId }, data: { status: 'VERIFIED', pointsAwarded: points, completedAt: new Date(), verifiedBy, evidence: data.evidence || duty.evidence } });
    const totals = await this.prisma.studentLeadershipDuty.aggregate({ where: { appointmentId: duty.appointmentId, status: 'VERIFIED' }, _sum: { pointsAwarded: true } });
    await this.prisma.studentLeadershipAppointment.update({ where: { id: duty.appointmentId }, data: { totalPoints: totals._sum.pointsAwarded || 0 } });
    return updated;
  }

  async recommendSport(schoolId: string, recommendedBy: string, data: any) {
    const category = String(data.sportCategory || '').toUpperCase();
    if (!SPORTS_CATEGORIES.includes(category as any)) throw new BadRequestException('Unsupported sports category');
    const student = await this.prisma.student.findFirst({ where: { id: data.studentId, schoolId, status: 'ACTIVE' }, select: { id: true } });
    if (!student) throw new NotFoundException('Active student not found in this school');
    if (!data.startDate || !data.recommendation) throw new BadRequestException('Sport startDate and teacher recommendation are required');
    return this.prisma.studentSportsParticipation.create({ data: { schoolId, studentId: student.id, sportCategory: category, eventLevel: data.eventLevel || 'SCHOOL', startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : null, teacherRecommended: true, recommendedBy, recommendation: data.recommendation, pointsAwarded: Math.max(0, Math.round(Number(data.pointsAwarded) || 0)), status: 'VERIFIED', evidence: data.evidence || null } });
  }

  async getEligibility(schoolId: string, studentId: string, category: string) {
    const normalized = String(category || '').toUpperCase();
    if (normalized === 'LEADERSHIP') {
      const appointments = await this.prisma.studentLeadershipAppointment.findMany({ where: { schoolId, studentId, status: { in: ['ACTIVE', 'COMPLETED'] } }, include: { duties: true }, orderBy: { startDate: 'desc' } });
      const customRoles = await this.prisma.studentLeadershipRole.findMany({ where: { schoolId }, select: { code: true, institutionTier: true, minimumPoints: true } });
      const eligible = appointments.filter((a) => {
        const minimum = (ROLE_CATALOG[a.institutionTier] || []).find((r) => r.code === a.roleCode)?.minimumPoints
          ?? customRoles.find((r) => r.code === a.roleCode && r.institutionTier === a.institutionTier)?.minimumPoints;
        return Boolean(minimum) && Boolean(a.endDate || a.status === 'COMPLETED') && a.totalPoints >= (minimum as number);
      });
      return { eligible: eligible.length > 0, category: normalized, requirements: ['Appointment recorded for the correct institution hierarchy', 'Tenure completed or appointment marked COMPLETED', 'Verified duty points meet the role threshold'], evidence: eligible };
    }
    if (normalized === 'SPORTS') {
      const participation = await this.prisma.studentSportsParticipation.findMany({ where: { schoolId, studentId, status: 'VERIFIED', teacherRecommended: true, pointsAwarded: { gte: 10 } }, orderBy: { pointsAwarded: 'desc' } });
      return { eligible: participation.length > 0, category: normalized, requirements: ['Teacher recommendation', 'Recognized sports category', 'Verified participation evidence', 'At least 10 activity points'], evidence: participation };
    }
    return { eligible: false, category: normalized, requirements: ['A dedicated eligibility rule is required for this non-academic award'], evidence: [] };
  }
}
