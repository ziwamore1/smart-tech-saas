import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PredictiveAnalysisService {
  constructor(private prisma: PrismaService) {}

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[]): number {
    const m = this.mean(values);
    return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private logisticPredict(coefficients: number[], features: number[]): number {
    const z = coefficients.reduce((sum, c, i) => sum + c * (features[i] || 0), 0);
    return this.sigmoid(z);
  }

  private linearPredict(slope: number, intercept: number, x: number): number {
    return slope * x + intercept;
  }

  async predictStudentRisk(schoolId: string, classId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: { student: true },
    });

    const results = await this.prisma.result.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        schoolId,
      },
      include: { subject: true, term: { include: { academicYear: true } } },
      orderBy: { term: { startDate: 'desc' } },
    });

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: enrollments.map(e => e.studentId) },
        schoolId,
      },
    });

    const predictions: Array<{
      studentId: string;
      studentName: string;
      currentAverage: number;
      riskScore: number;
      riskLevel: string;
      failureProbability: number;
      factors: string[];
      recommendedAction: string;
    }> = [];

    for (const enrollment of enrollments) {
      const studentResults = results.filter(r => r.studentId === enrollment.studentId);
      const studentAttendance = attendanceRecords.filter(a => a.studentId === enrollment.studentId);

      if (studentResults.length < 2) continue;

      const scores = studentResults.map(r => r.score);
      const currentAvg = this.mean(scores);

      const recentScores = scores.slice(-3);
      const trend = recentScores.length >= 2
        ? recentScores[recentScores.length - 1] - recentScores[0]
        : 0;

      const attendanceRate = studentAttendance.length
        ? studentAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length / studentAttendance.length
        : 1;

      const failedSubjects = studentResults.filter(r => r.score < 50).length;
      const subjectCount = studentResults.length;

      const scoreVariance = this.stdDev(scores);
      const lowScoreRatio = scores.filter(s => s < 50).length / scores.length;

      const features = [
        currentAvg / 100,
        trend / 100,
        attendanceRate,
        1 - (failedSubjects / Math.max(subjectCount, 1)),
        1 - scoreVariance / 50,
        1 - lowScoreRatio,
        scores.length > 5 ? 1 : scores.length / 5,
      ];

      const coefficients = [-2.5, -1.8, -1.2, -1.5, -0.5, -2.0, 0.3];
      const riskScore = this.logisticPredict(coefficients, features);
      const failureProb = 1 - this.logisticPredict(
        coefficients.map((c, i) => i === 0 ? -c : c),
        features,
      );

      const riskLevel = riskScore >= 0.7 ? 'CRITICAL'
        : riskScore >= 0.5 ? 'HIGH'
        : riskScore >= 0.3 ? 'MODERATE'
        : 'LOW';

      const factors: string[] = [];
      if (currentAvg < 50) factors.push('Currently failing');
      if (trend < -10) factors.push(`Declining trend (${trend.toFixed(0)} points)`);
      if (attendanceRate < 0.8) factors.push(`Low attendance (${(attendanceRate * 100).toFixed(0)}%)`);
      if (failedSubjects > 2) factors.push(`Multiple failing subjects (${failedSubjects})`);
      if (scoreVariance > 20) factors.push('High score variability');

      const recommendedAction = riskLevel === 'CRITICAL'
        ? 'Immediate intervention required: parent meeting, remedial classes, counseling'
        : riskLevel === 'HIGH'
          ? 'Schedule intervention: additional tutoring, progress monitoring'
          : riskLevel === 'MODERATE'
            ? 'Monitor closely: weekly check-ins, targeted support'
            : 'Continue current approach with regular monitoring';

      predictions.push({
        studentId: enrollment.student.id,
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        currentAverage: Number(currentAvg.toFixed(2)),
        riskScore: Number(riskScore.toFixed(4)),
        riskLevel,
        failureProbability: Number((failureProb * 100).toFixed(2)),
        factors,
        recommendedAction,
      });
    }

    return {
      predictions: predictions.sort((a, b) => b.riskScore - a.riskScore),
      summary: {
        total: predictions.length,
        critical: predictions.filter(p => p.riskLevel === 'CRITICAL').length,
        high: predictions.filter(p => p.riskLevel === 'HIGH').length,
        moderate: predictions.filter(p => p.riskLevel === 'MODERATE').length,
        low: predictions.filter(p => p.riskLevel === 'LOW').length,
        atRisk: predictions.filter(p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH').length,
      },
    };
  }

  async predictSubjectOutcome(schoolId: string, studentId: string, subjectId: string) {
    const results = await this.prisma.result.findMany({
      where: { studentId, subjectId, schoolId },
      include: { term: { include: { academicYear: true } }, subject: true },
      orderBy: { term: { startDate: 'asc' } },
    });

    if (results.length < 2) {
      return { error: 'Need at least 2 terms of data for prediction' };
    }

    const scores = results.map(r => r.score);
    const indices = Array.from({ length: scores.length }, (_, i) => i);
    const n = scores.length;

    const xMean = this.mean(indices);
    const yMean = this.mean(scores);
    const num = indices.reduce((sum, xi, i) => sum + (xi - xMean) * (scores[i] - yMean), 0);
    const den = indices.reduce((sum, xi) => sum + (xi - xMean) ** 2, 0);
    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;

    const nextTerm = n;
    const predictedScore = this.linearPredict(slope, intercept, nextTerm);
    const clampedScore = Math.max(0, Math.min(100, predictedScore));

    const ssRes = scores.reduce((sum, yi, i) => sum + (yi - (slope * i + intercept)) ** 2, 0);
    const ssTot = scores.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    const trend = scores[scores.length - 1] - scores[0];
    const volatility = this.stdDev(scores);

    const failureProb = this.sigmoid((50 - clampedScore) / 15);

    return {
      studentId,
      subjectId,
      subjectName: results[0]?.subject?.name || '',
      historicalData: results.map(r => ({
        term: `${r.term.name} ${r.term.academicYear.name}`,
        score: r.score,
      })),
      prediction: {
        nextPredictedScore: Number(clampedScore.toFixed(2)),
        confidence: Number((rSquared * 100).toFixed(2)),
        trend: trend > 5 ? 'IMPROVING' : trend < -5 ? 'DECLINING' : 'STABLE',
        volatility: Number(volatility.toFixed(2)),
        failureProbability: Number((failureProb * 100).toFixed(2)),
      },
      regressionModel: {
        slope: Number(slope.toFixed(4)),
        intercept: Number(intercept.toFixed(2)),
        rSquared: Number(rSquared.toFixed(4)),
      },
    };
  }

  async getAtRiskStudents(schoolId: string, classId?: string) {
    const where: any = { schoolId };
    if (classId) {
      where.enrollments = { some: { classId, status: 'ACTIVE' } };
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        results: {
          include: { subject: true, term: { include: { academicYear: true } } },
          orderBy: { term: { startDate: 'desc' } },
        },
        attendances: true,
        enrollments: { where: { status: 'ACTIVE' }, include: { class: true } },
      },
    });

    const atRisk: Array<{
      studentId: string;
      studentName: string;
      className: string;
      riskFactors: string[];
      riskScore: number;
      suggestion: string;
    }> = [];

    for (const student of students) {
      const factors: string[] = [];
      let riskScore = 0;

      const scores = student.results.map(r => r.score);
      if (!scores.length) continue;

      const avg = this.mean(scores);
      if (avg < 50) {
        factors.push('Below passing average');
        riskScore += 0.3;
      }

      const recentScores = scores.slice(-3);
      if (recentScores.length >= 2) {
        const decline = recentScores[0] - recentScores[recentScores.length - 1];
        if (decline > 10) {
          factors.push(`Declining by ${decline.toFixed(0)} points`);
          riskScore += 0.2;
        }
      }

      const attendance = student.attendances;
      if (attendance.length > 0) {
        const present = attendance.filter(a => a.status === 'PRESENT').length;
        const rate = present / attendance.length;
        if (rate < 0.8) {
          factors.push(`Low attendance (${(rate * 100).toFixed(0)}%)`);
          riskScore += 0.2;
        }
      }

      const failed = scores.filter(s => s < 50).length;
      if (failed > 2) {
        factors.push(`${failed} subjects below pass mark`);
        riskScore += 0.15;
      }

      const failingRecent = recentScores.filter(s => s < 50).length;
      if (failingRecent >= 2) {
        factors.push('Multiple recent failures');
        riskScore += 0.15;
      }

      if (factors.length > 0) {
        atRisk.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          className: student.enrollments[0]?.class?.name || 'N/A',
          riskFactors: factors,
          riskScore: Number(riskScore.toFixed(2)),
          suggestion: riskScore >= 0.5
            ? 'Urgent intervention needed'
            : 'Monitor and provide additional support',
        });
      }
    }

    return atRisk.sort((a, b) => b.riskScore - a.riskScore);
  }

  async getDropoutPrediction(schoolId: string, classId?: string) {
    const where: any = { schoolId };
    if (classId) {
      where.enrollments = { some: { classId, status: 'ACTIVE' } };
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        results: {
          include: { term: true },
          orderBy: { term: { startDate: 'desc' } },
        },
        attendances: true,
        enrollments: { where: { status: 'ACTIVE' }, include: { class: true } },
        behavioralRecords: { orderBy: { recordDate: 'desc' }, take: 10 },
      },
    });

    const predictions: Array<{
      studentId: string;
      studentName: string;
      className: string;
      dropoutProbability: number;
      riskLevel: string;
      indicators: string[];
    }> = [];

    for (const student of students) {
      const indicators: string[] = [];
      const scores = student.results.map(r => r.score);

      if (!scores.length) continue;

      const avg = this.mean(scores);
      if (avg < 45) indicators.push('Critically low academic performance');

      if (scores.length >= 3) {
        const trend = scores[scores.length - 1] - scores[0];
        if (trend < -15) indicators.push('Severe declining performance trend');
      }

      const attendance = student.attendances;
      if (attendance.length > 0) {
        const absentRate = attendance.filter(a => a.status === 'ABSENT').length / attendance.length;
        if (absentRate > 0.3) indicators.push(`High absenteeism (${(absentRate * 100).toFixed(0)}%)`);
      }

      const behavioral = student.behavioralRecords;
      if (behavioral.length > 2) indicators.push('Multiple behavioral incidents');

      const consecutiveDeclines = scores.slice(-5).filter((s, i, arr) => i > 0 && s < arr[i - 1]).length;
      if (consecutiveDeclines >= 3) indicators.push('Consecutive performance decline');

      if (indicators.length === 0) continue;

      const probability = Math.min(0.95, indicators.length * 0.15 + (avg < 50 ? 0.1 : 0));
      const riskLevel = probability >= 0.5 ? 'HIGH' : probability >= 0.3 ? 'MODERATE' : 'LOW';

      predictions.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        className: student.enrollments[0]?.class?.name || 'N/A',
        dropoutProbability: Number((probability * 100).toFixed(2)),
        riskLevel,
        indicators,
      });
    }

    return predictions.sort((a, b) => b.dropoutProbability - a.dropoutProbability);
  }
}
