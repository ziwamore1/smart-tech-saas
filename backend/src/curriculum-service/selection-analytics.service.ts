import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SelectionAnalysis {
  studentId: string;
  studentName: string;
  finalAggregate: number;
  division: string | null;
  schoolRank: number | null;
  districtRank: number | null;
  provinceRank: number | null;
  nationalRank: number | null;
  eligibilityScore: number;
  predictedSchools: string[];
  recommendation: string;
}

interface SchoolSelectionProfile {
  schoolId: string;
  schoolName: string;
  district: string;
  province: string;
  minEntryScore: number;
  capacity: number;
  competitiveness: string;
}

@Injectable()
export class SelectionAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async analyzeStudentSelection(studentId: string, termId: string): Promise<SelectionAnalysis> {
    const grade7Result = await this.prisma.grade7Result.findUnique({
      where: { studentId_termId: { studentId, termId } },
      include: { student: true },
    });
    if (!grade7Result) throw new NotFoundException('Grade 7 result not found for student');

    const student = grade7Result.student;
    const aggregate = grade7Result.finalAggregate || 0;
    const eligibilityScore = aggregate;

    // Predict schools based on score
    const predictedSchools = await this.predictSchools(aggregate, student.schoolId);

    // Generate recommendation
    const recommendation = this.generateRecommendation(aggregate, grade7Result.division);

    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      finalAggregate: aggregate,
      division: grade7Result.division,
      schoolRank: grade7Result.schoolRank,
      districtRank: grade7Result.districtRank,
      provinceRank: grade7Result.provinceRank,
      nationalRank: grade7Result.nationalRank,
      eligibilityScore,
      predictedSchools,
      recommendation,
    };
  }

  async analyzeClassSelection(
    classId: string,
    termId: string,
  ): Promise<{ students: SelectionAnalysis[]; summary: any }> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: { student: true },
    });

    const analyses: SelectionAnalysis[] = [];

    for (const enrollment of enrollments) {
      try {
        const analysis = await this.analyzeStudentSelection(enrollment.student.id, termId);
        analyses.push(analysis);
      } catch {
        // Skip students without Grade 7 results
      }
    }

    analyses.sort((a, b) => b.finalAggregate - a.finalAggregate);

    const divisionCounts: Record<string, number> = {};
    analyses.forEach((a) => {
      const d = a.division || 'Unknown';
      divisionCounts[d] = (divisionCounts[d] || 0) + 1;
    });

    return {
      students: analyses,
      summary: {
        total: analyses.length,
        averageScore: analyses.length > 0
          ? analyses.reduce((s, a) => s + a.finalAggregate, 0) / analyses.length
          : 0,
        highestScore: analyses.length > 0 ? analyses[0].finalAggregate : 0,
        lowestScore: analyses.length > 0 ? analyses[analyses.length - 1].finalAggregate : 0,
        divisionDistribution: divisionCounts,
        eligibleForForm1: analyses.filter((a) => a.finalAggregate >= 60).length,
        notEligible: analyses.filter((a) => a.finalAggregate < 60).length,
      },
    };
  }

  async getSchoolSelectionProfile(schoolId: string): Promise<SchoolSelectionProfile> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');

    return {
      schoolId: school.id,
      schoolName: school.name,
      district: school.district || 'Unknown',
      province: school.province || 'Unknown',
      minEntryScore: school.minEntryScore || 60,
      capacity: school.capacity || 200,
      competitiveness: this.computeCompetitiveness(school.minEntryScore || 60),
    };
  }

  async getDistrictRankings(district: string, termId: string) {
    const schools = await this.prisma.school.findMany({
      where: { district },
    });

    const results = await this.prisma.grade7Result.findMany({
      where: {
        schoolId: { in: schools.map((s) => s.id) },
        termId,
      },
      orderBy: { finalAggregate: 'desc' },
    });

    return results.map((r, i) => ({
      rank: i + 1,
      studentId: r.studentId,
      aggregate: r.finalAggregate,
      division: r.division,
      schoolId: r.schoolId,
    }));
  }

  async getProvinceRankings(province: string, termId: string) {
    const schools = await this.prisma.school.findMany({
      where: { province },
    });

    const results = await this.prisma.grade7Result.findMany({
      where: {
        schoolId: { in: schools.map((s) => s.id) },
        termId,
      },
      orderBy: { finalAggregate: 'desc' },
    });

    return results.map((r, i) => ({
      rank: i + 1,
      studentId: r.studentId,
      aggregate: r.finalAggregate,
      division: r.division,
      schoolId: r.schoolId,
      schoolName: schools.find((s) => s.id === r.schoolId)?.name || '',
    }));
  }

  async updateRanks(schoolId: string, termId: string) {
    const results = await this.prisma.grade7Result.findMany({
      where: { schoolId, termId },
      orderBy: { finalAggregate: 'desc' },
    });

    const updates = results.map((r, i) =>
      this.prisma.grade7Result.update({
        where: { id: r.id },
        data: { schoolRank: i + 1 },
      }),
    );
    await this.prisma.$transaction(updates);
  }

  // ===================== PRIVATE HELPERS =====================

  private async predictSchools(aggregate: number, currentSchoolId: string): Promise<string[]> {
    const schools = await this.prisma.school.findMany({
      where: {
        id: { not: currentSchoolId },
        minEntryScore: { lte: aggregate, not: null },
      },
      orderBy: { minEntryScore: 'desc' },
      take: 5,
    });

    return schools.map((s) => `${s.name} (min: ${s.minEntryScore})`);
  }

  private generateRecommendation(aggregate: number, division: string | null): string {
    if (aggregate >= 113) return 'Excellent performance — eligible for top secondary schools nationally';
    if (aggregate >= 90) return 'Very good performance — eligible for most secondary schools';
    if (aggregate >= 75) return 'Good performance — eligible for many secondary schools';
    if (aggregate >= 60) return 'Fair performance — eligible for some secondary schools';
    return 'Needs improvement — consider remedial programs or alternative pathways';
  }

  private computeCompetitiveness(minEntryScore: number): string {
    if (minEntryScore >= 100) return 'Very High';
    if (minEntryScore >= 80) return 'High';
    if (minEntryScore >= 60) return 'Moderate';
    return 'Open';
  }
}
