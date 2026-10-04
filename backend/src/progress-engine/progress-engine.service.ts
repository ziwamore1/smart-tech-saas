import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VERIFIED_ASSESSMENT_STATUSES = ['VERIFIED', 'APPROVED', 'PUBLISHED'];
const VERIFIED_RESULT_STATUSES = ['COMPUTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'];

type Numeric = number | null | undefined;

function numbers(values: Numeric[]) {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function round(value: number | null, places = 2) {
  return value === null ? null : Number(value.toFixed(places));
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[]) {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function slope(values: number[]) {
  if (values.length < 2) return null;
  const xMean = (values.length - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const numerator = values.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0);
  const denominator = values.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0);
  return denominator ? numerator / denominator : 0;
}

function trend(values: number[]) {
  const current = numbers(values);
  if (current.length < 2) return { direction: 'INSUFFICIENT_DATA', strength: null, slope: null };
  const value = slope(current) || 0;
  const strength = Math.min(1, Math.abs(value) / 10);
  return {
    direction: value >= 2 ? 'IMPROVING' : value <= -2 ? 'DECLINING' : 'STABLE',
    strength: round(strength, 3),
    slope: round(value),
  };
}

@Injectable()
export class ProgressEngineService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertStudent(studentId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, schoolId },
      include: { enrollments: { include: { academicYear: true, class: true }, orderBy: { academicYear: { startDate: 'asc' } } } },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async getStudentProgressForOwner(studentId: string, schoolId: string, userId: string, ownerType: 'STUDENT' | 'PARENT', filters: Record<string, string | undefined> = {}) {
    const student = ownerType === 'STUDENT'
      ? await this.prisma.student.findFirst({ where: { id: studentId, schoolId, user: { id: userId } }, select: { id: true } })
      : await this.prisma.student.findFirst({ where: { id: studentId, schoolId, parents: { some: { parent: { userId } } } }, select: { id: true } });
    if (!student) throw new ForbiddenException('You may only view your permitted academic history');
    return this.getStudentProgress(student.id, schoolId, filters);
  }

  private async upsertEvidence(studentId: string, schoolId: string) {
    const assessmentResults = await this.prisma.studentAssessmentResult.findMany({
      where: { studentId, status: { in: VERIFIED_ASSESSMENT_STATUSES as any } },
      include: { term: { include: { academicYear: true } }, assessmentDef: { select: { id: true, name: true, category: true } } },
    });
    const computedResults = await this.prisma.computedResult.findMany({
      where: { studentId, schoolId, status: { in: VERIFIED_RESULT_STATUSES as any } },
      include: { term: { include: { academicYear: true } } },
    });
    const legacyResults = await this.prisma.result.findMany({
      where: { studentId, schoolId },
      include: { term: { include: { academicYear: true } } },
    });

    for (const result of assessmentResults) {
      await this.prisma.progressEvidence.upsert({
        where: { sourceType_sourceId: { sourceType: 'ASSESSMENT', sourceId: result.id } },
        create: {
          schoolId, sourceType: 'ASSESSMENT', sourceId: result.id, studentId,
          academicYearId: result.term.academicYearId, termId: result.termId, classId: result.classId,
          subjectId: result.subjectId, teacherId: result.enteredBy, assessmentId: result.assessmentDefId,
          assessmentTypeId: result.assessmentDefId, rawScore: result.rawScore, maxScore: result.maxScore,
          percentage: result.percentage, weightedScore: result.weightedScore, grade: result.grade,
          isAbsent: result.isAbsent, recordedAt: result.enteredAt, verifiedAt: result.verifiedAt,
          metadata: result.metadata as any,
        },
        update: {
          percentage: result.percentage, weightedScore: result.weightedScore, grade: result.grade,
          rawScore: result.rawScore, maxScore: result.maxScore, verifiedAt: result.verifiedAt,
          isAbsent: result.isAbsent, metadata: result.metadata as any,
        },
      });
    }

    for (const result of computedResults) {
      await this.prisma.progressEvidence.upsert({
        where: { sourceType_sourceId: { sourceType: 'TERM_RESULT', sourceId: result.id } },
        create: {
          schoolId, sourceType: 'TERM_RESULT', sourceId: result.id, studentId,
          academicYearId: result.term.academicYearId, termId: result.termId, classId: result.classId,
          subjectId: result.subjectId, percentage: result.finalPercentage, weightedScore: result.totalWeightedScore,
          grade: result.finalGrade, isAbsent: result.isAbsent, verifiedAt: result.verifiedAt,
          recordedAt: result.computedAt, metadata: result.metadata as any,
        },
        update: {
          percentage: result.finalPercentage, weightedScore: result.totalWeightedScore, grade: result.finalGrade,
          isAbsent: result.isAbsent, verifiedAt: result.verifiedAt, metadata: result.metadata as any,
        },
      });
    }

    // Legacy results are included as imported evidence so historical records are not lost.
    for (const result of legacyResults) {
      await this.prisma.progressEvidence.upsert({
        where: { sourceType_sourceId: { sourceType: 'IMPORTED_RESULT', sourceId: result.id } },
        create: {
          schoolId, sourceType: 'IMPORTED_RESULT', sourceId: result.id, studentId,
          academicYearId: result.term.academicYearId, termId: result.termId, classId: (await this.classForStudent(studentId, result.term.academicYearId)) || '',
          subjectId: result.subjectId, teacherId: result.teacherId, percentage: result.score, grade: result.grade,
          recordedAt: result.createdAt, imported: true, metadata: { remark: result.remark } as any,
        },
        update: { percentage: result.score, grade: result.grade, imported: true, metadata: { remark: result.remark } as any },
      });
    }

    return { assessmentResults, computedResults, legacyResults };
  }

  private async classForStudent(studentId: string, academicYearId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({ where: { studentId, academicYearId } });
    return enrollment?.classId;
  }

  private async buildSnapshots(studentId: string, schoolId: string, sources: any) {
    const termResults = new Map<string, any>();
    for (const result of sources.computedResults) {
      if (result.finalPercentage === null || result.isAbsent) continue;
      const normalized = { ...result, academicYearId: result.term.academicYearId };
      termResults.set(`${normalized.academicYearId}:${normalized.termId}:${normalized.classId}:${normalized.subjectId}`, normalized);
    }
    for (const result of sources.legacyResults) {
      const classId = await this.classForStudent(studentId, result.term.academicYearId);
      const key = `${result.term.academicYearId}:${result.termId}:${classId}:${result.subjectId}`;
      if (!termResults.has(key)) termResults.set(key, { ...result, academicYearId: result.term.academicYearId, classId, finalPercentage: result.score, finalGrade: result.grade, isAbsent: false });
    }
    const snapshots = [];
    for (const result of termResults.values()) {
      const evidence = sources.assessmentResults.filter((item: any) => item.termId === result.termId && item.subjectId === result.subjectId && item.percentage !== null && !item.isAbsent);
      const values = evidence.map((item: any) => item.percentage as number);
      const stats = values.length ? { average: values.reduce((a: number, b: number) => a + b, 0) / values.length, median: median(values), standardDeviation: standardDeviation(values) } : { average: result.finalPercentage, median: result.finalPercentage, standardDeviation: null };
      const snapshot = await this.prisma.academicProgressSnapshot.upsert({
        where: { studentId_academicYearId_termId_classId_subjectId: { studentId, academicYearId: result.academicYearId, termId: result.termId, classId: result.classId, subjectId: result.subjectId } },
        create: { schoolId, studentId, academicYearId: result.academicYearId, termId: result.termId, classId: result.classId, subjectId: result.subjectId, assessmentCount: values.length, averagePercentage: result.finalPercentage, weightedAverage: result.finalPercentage, median: stats.median, standardDeviation: stats.standardDeviation, grade: result.finalGrade, passStatus: result.finalPercentage >= 50 ? 'PASS' : 'FAIL', generatedAt: new Date() },
        update: { assessmentCount: values.length, averagePercentage: result.finalPercentage, weightedAverage: result.finalPercentage, median: stats.median, standardDeviation: stats.standardDeviation, grade: result.finalGrade, passStatus: result.finalPercentage >= 50 ? 'PASS' : 'FAIL', generatedAt: new Date() },
      });
      snapshots.push(snapshot);
    }
    await this.buildAnnualSummaries(studentId, schoolId, snapshots);
    return snapshots;
  }

  private async buildAnnualSummaries(studentId: string, schoolId: string, snapshots: any[]) {
    const byYear = new Map<string, any[]>();
    for (const snapshot of snapshots) byYear.set(snapshot.academicYearId, [...(byYear.get(snapshot.academicYearId) || []), snapshot]);
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: [...new Set(snapshots.map(item => item.subjectId))] } }, select: { id: true, name: true } });
    const terms = await this.prisma.term.findMany({ where: { id: { in: [...new Set(snapshots.map(item => item.termId))] } }, select: { id: true, startDate: true } });
    const termOrder = new Map(terms.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()).map((term, index) => [term.id, index]));
    const subjectNames = new Map(subjects.map(subject => [subject.id, subject.name]));
    for (const [academicYearId, items] of byYear) {
      const orderedItems = [...items].sort((a, b) => (termOrder.get(a.termId) ?? 0) - (termOrder.get(b.termId) ?? 0));
      const values = orderedItems.map(item => item.averagePercentage).filter((value): value is number => value !== null);
      const bySubject = new Map<string, number[]>();
      items.forEach(item => { if (item.averagePercentage !== null) bySubject.set(item.subjectId, [...(bySubject.get(item.subjectId) || []), item.averagePercentage]); });
      const subjectAverages = [...bySubject.entries()].map(([subjectId, scores]) => ({ subjectId, average: scores.reduce((a, b) => a + b, 0) / scores.length }));
      const strongest = subjectAverages.sort((a, b) => b.average - a.average)[0];
      const weakest = subjectAverages.sort((a, b) => a.average - b.average)[0];
      const first = values[0];
      const last = values[values.length - 1];
      await this.prisma.studentAcademicYearSummary.upsert({
        where: { studentId_academicYearId: { studentId, academicYearId } },
        create: { schoolId, studentId, academicYearId, classId: items[0]?.classId, overallAverage: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, median: median(values), subjectsTaken: subjectAverages.length, subjectsPassed: items.filter(item => item.passStatus === 'PASS').length, subjectsFailed: items.filter(item => item.passStatus === 'FAIL').length, strongestSubject: strongest ? subjectNames.get(strongest.subjectId) : null, weakestSubject: weakest ? subjectNames.get(weakest.subjectId) : null, improvementRate: values.length > 1 && first ? ((last - first) / first) * 100 : null, declineRate: values.length > 1 && first && last < first ? ((first - last) / first) * 100 : null, generatedAt: new Date() },
        update: { classId: items[0]?.classId, overallAverage: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, median: median(values), subjectsTaken: subjectAverages.length, subjectsPassed: items.filter(item => item.passStatus === 'PASS').length, subjectsFailed: items.filter(item => item.passStatus === 'FAIL').length, strongestSubject: strongest ? subjectNames.get(strongest.subjectId) : null, weakestSubject: weakest ? subjectNames.get(weakest.subjectId) : null, improvementRate: values.length > 1 && first ? ((last - first) / first) * 100 : null, declineRate: values.length > 1 && first && last < first ? ((first - last) / first) * 100 : null, generatedAt: new Date() },
      });
    }
  }

  async getStudentProgress(studentId: string, schoolId: string, filters: Record<string, string | undefined> = {}) {
    const student = await this.assertStudent(studentId, schoolId);
    const sources = await this.upsertEvidence(studentId, schoolId);
    const snapshots = await this.buildSnapshots(studentId, schoolId, sources);
    const terms = await this.prisma.term.findMany({ where: { id: { in: snapshots.map(item => item.termId) } }, include: { academicYear: true }, orderBy: { startDate: 'asc' } });
    const termMap = new Map(terms.map(term => [term.id, term]));
    const subjectIds = [...new Set(snapshots.map(item => item.subjectId))];
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true, code: true } });
    const annualSummaries = await this.prisma.studentAcademicYearSummary.findMany({ where: { studentId, schoolId }, orderBy: { generatedAt: 'asc' } });
    const subjectMap = new Map(subjects.map(subject => [subject.id, subject]));
    const filtered = snapshots.filter(snapshot => (!filters.academicYearId || snapshot.academicYearId === filters.academicYearId) && (!filters.termId || snapshot.termId === filters.termId) && (!filters.subjectId || snapshot.subjectId === filters.subjectId));
    const bySubject = new Map<string, any[]>();
    for (const snapshot of filtered) bySubject.set(snapshot.subjectId, [...(bySubject.get(snapshot.subjectId) || []), snapshot]);
    const subjectTrends = [...bySubject.entries()].map(([subjectId, items]) => ({ subject: subjectMap.get(subjectId), points: items.map(item => ({ academicYear: termMap.get(item.termId)?.academicYear.name, term: termMap.get(item.termId)?.name, percentage: item.averagePercentage, grade: item.grade })), trend: trend(items.map(item => item.averagePercentage)) }));
    const overallValues = filtered.map(item => item.averagePercentage).filter((value): value is number => value !== null);
    return {
      student: { id: student.id, name: `${student.firstName} ${student.lastName}`.trim(), admissionNumber: student.admissionNumber, photoUrl: student.photoUrl, grade: student.grade, className: student.className, status: student.status, enrollments: student.enrollments.map(item => ({ academicYear: item.academicYear.name, class: item.class.name, status: item.status })) },
      annualSummaries,
      summary: { average: overallValues.length ? round(overallValues.reduce((a, b) => a + b, 0) / overallValues.length) : null, median: round(median(overallValues)), trend: trend(overallValues), dataStatus: overallValues.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA' },
      timeline: filtered.map(item => ({ ...item, academicYear: termMap.get(item.termId)?.academicYear.name, term: termMap.get(item.termId)?.name, subject: subjectMap.get(item.subjectId) })),
      subjectTrends,
      evidence: sources.assessmentResults.filter(item => (!filters.termId || item.termId === filters.termId) && (!filters.subjectId || item.subjectId === filters.subjectId)).map(item => ({ id: item.id, termId: item.termId, subjectId: item.subjectId, assessmentId: item.assessmentDefId, assessmentName: item.assessmentDef?.name, assessmentCategory: item.assessmentDef?.category, score: item.rawScore, maxScore: item.maxScore, percentage: item.percentage, grade: item.grade, isAbsent: item.isAbsent, verifiedAt: item.verifiedAt })),
    };
  }

  async getClassProgress(classId: string, schoolId: string, filters: Record<string, string | undefined> = {}) {
    let snapshots = await this.prisma.academicProgressSnapshot.findMany({ where: { schoolId, classId, ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}), ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.subjectId ? { subjectId: filters.subjectId } : {}) } });
    if (!snapshots.length) {
      await this.recalculateClass(classId, schoolId);
      snapshots = await this.prisma.academicProgressSnapshot.findMany({ where: { schoolId, classId, ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}), ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.subjectId ? { subjectId: filters.subjectId } : {}) } });
    }
    const values = snapshots.map(item => item.averagePercentage).filter((value): value is number => value !== null);
    const byTerm = new Map<string, number[]>();
    snapshots.forEach(item => { if (item.averagePercentage !== null) byTerm.set(item.termId, [...(byTerm.get(item.termId) || []), item.averagePercentage]); });
    const terms = await this.prisma.term.findMany({ where: { id: { in: [...byTerm.keys()] } }, include: { academicYear: true }, orderBy: { startDate: 'asc' } });
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: [...new Set(snapshots.map(item => item.subjectId))] } }, select: { id: true, name: true } });
    return { classId, count: new Set(snapshots.map(item => item.studentId)).size, statistics: { count: values.length, mean: round(values.length ? values.reduce((a, b) => a + b, 0) / values.length : null), median: round(median(values)), standardDeviation: round(standardDeviation(values)), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, passRate: values.length ? round(values.filter(value => value >= 50).length / values.length * 100) : null }, trend: trend(terms.flatMap(term => byTerm.get(term.id) || []).length ? terms.map(term => { const termValues = byTerm.get(term.id) || []; return termValues.length ? termValues.reduce((a, b) => a + b, 0) / termValues.length : null; }) : []), periods: terms.map(term => { const scores = byTerm.get(term.id) || []; return { academicYear: term.academicYear.name, term: term.name, average: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, count: scores.length }; }), subjects };
  }

  async recalculateClass(classId: string, schoolId: string) {
    const enrollments = await this.prisma.enrollment.findMany({ where: { schoolId, classId, student: { status: 'ACTIVE' } }, select: { studentId: true } });
    let evidence = 0;
    let snapshots = 0;
    for (const enrollment of enrollments) {
      const result = await this.recalculateStudent(enrollment.studentId, schoolId);
      evidence += result.evidence;
      snapshots += result.snapshots;
    }
    return { classId, students: enrollments.length, evidence, snapshots, updatedAt: new Date() };
  }

  async getTeacherSubjectProgress(teacherId: string, subjectId: string, schoolId: string, filters: Record<string, string | undefined> = {}) {
    const evidence = await this.prisma.progressEvidence.findMany({
      where: { schoolId, teacherId, subjectId, sourceType: 'ASSESSMENT', ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}), ...(filters.termId ? { termId: filters.termId } : {}) },
      select: { termId: true, classId: true, percentage: true, isAbsent: true },
    });
    const values = evidence.map(item => item.percentage).filter((value): value is number => value !== null && value !== undefined);
    const terms = await this.prisma.term.findMany({ where: { id: { in: [...new Set(evidence.map(item => item.termId))] } }, include: { academicYear: true }, orderBy: { startDate: 'asc' } });
    const periods = terms.map(term => { const scores = evidence.filter(item => item.termId === term.id && item.percentage !== null).map(item => item.percentage as number); return { academicYear: term.academicYear.name, term: term.name, average: scores.length ? round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, assessed: scores.length }; });
    return { teacherId, subjectId, statistics: { count: values.length, mean: round(values.length ? values.reduce((a, b) => a + b, 0) / values.length : null), median: round(median(values)), standardDeviation: round(standardDeviation(values)), passRate: values.length ? round(values.filter(value => value >= 50).length / values.length * 100) : null }, trend: trend(periods.map(item => item.average)), periods };
  }

  async recalculateStudent(studentId: string, schoolId: string) {
    await this.assertStudent(studentId, schoolId);
    const sources = await this.upsertEvidence(studentId, schoolId);
    const snapshots = await this.buildSnapshots(studentId, schoolId, sources);
    return { studentId, snapshots: snapshots.length, evidence: sources.assessmentResults.length + sources.computedResults.length + sources.legacyResults.length, updatedAt: new Date() };
  }
}
