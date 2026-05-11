import axios from 'axios';
import { config } from '../config';
import {
  ReportCardData,
  TranscriptData,
  AnalyticsSummaryData,
  PerformanceProfileData,
  ReportType,
  SchoolInfo,
} from '../types';

export class DataFetcher {
  private api: ReturnType<typeof axios.create>;

  constructor() {
    this.api = axios.create({
      baseURL: config.api.baseUrl,
      timeout: 30000,
      headers: {
        'X-Internal-Api-Key': config.api.key,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetchReportCardData(schoolId: string, studentId: string, termId: string): Promise<ReportCardData> {
    const [reportRes, schoolRes, templateRes, legendRes] = await Promise.all([
      this.api.get(`/report-card/${studentId}/${termId}`),
      this.api.get(`/schools/${schoolId}`),
      this.api.get(`/report-templates/default?schoolId=${schoolId}`),
      this.api.get(`/grading-systems?schoolId=${schoolId}`),
    ]);

    const school = schoolRes.data as SchoolInfo;
    const report = reportRes.data as any;
    const legendData = legendRes.data as any[];
    const gradingSystem = legendData.find((g: any) => g.isDefault) || legendData[0];
    const gradingLegend = (gradingSystem?.gradeScales as any[])
      ?.map((s: any) => ({
        grade: s.grade,
        minScore: s.minScore,
        maxScore: s.maxScore,
        remark: s.remark,
        points: s.points,
      }))
      .sort((a: any, b: any) => b.minScore - a.minScore) || [];

    return {
      school,
      student: report.student,
      term: report.term,
      subjects: report.subjects,
      summary: report.summary,
      teacherComment: report.teacherComment,
      headComment: report.headComment,
      gradingLegend,
      template: this.buildTemplateConfig(templateRes.data),
    };
  }

  async fetchTranscriptData(schoolId: string, studentId: string): Promise<TranscriptData> {
    const [transcriptRes, schoolRes, templateRes] = await Promise.all([
      this.api.get(`/report-card/transcript/${studentId}/pdf`),
      this.api.get(`/schools/${schoolId}`),
      this.api.get(`/report-templates/default?schoolId=${schoolId}`),
    ]);

    const school = schoolRes.data as SchoolInfo;
    const transcript = transcriptRes.data as any;

    return {
      school,
      student: transcript.student,
      entries: transcript.entries || [],
      summary: transcript.summary || { totalTerms: 0, totalSubjects: 0, overallAverage: 0 },
      template: this.buildTemplateConfig(templateRes.data),
    };
  }

  async fetchAnalyticsSummaryData(
    schoolId: string,
    classId: string,
    termId: string,
  ): Promise<AnalyticsSummaryData> {
    const [classPerfRes, gradeDistRes, schoolRes, templateRes] = await Promise.all([
      this.api.get(`/analytics/class-performance?classId=${classId}&term=${termId}`),
      this.api.get(`/analytics/grade-distribution?classId=${classId}&termId=${termId}`),
      this.api.get(`/schools/${schoolId}`),
      this.api.get(`/report-templates/default?schoolId=${schoolId}`),
    ]);

    const school = schoolRes.data as SchoolInfo;
    const performance = classPerfRes.data as any;
    const distribution = gradeDistRes.data as any;

    const distItems = (distribution.labels as string[])?.map((label: string, i: number) => ({
      grade: label,
      count: (distribution.data as number[])?.[i] || 0,
      percentage: (((distribution.data as number[])?.[i] || 0) / (performance.studentCount || 1)) * 100,
    })) || [];

    const subjectAverages = performance.subjectAverages || [];
    const trends = performance.trends || [];

    return {
      school,
      className: performance.className || '',
      termName: performance.termName || '',
      academicYear: performance.academicYear || '',
      classAverage: performance.classAverage || 0,
      studentCount: performance.studentCount || 0,
      subjectCount: performance.subjectCount || 0,
      distribution: distItems,
      distributionMap: {
        labels: distItems.map((d: any) => d.grade),
        data: distItems.map((d: any) => d.count),
      },
      subjectLabels: subjectAverages.map((s: any) => s.subject),
      subjectAvgData: subjectAverages.map((s: any) => s.average),
      topStudents: performance.topStudents || [],
      subjectAverages,
      trends,
      template: this.buildTemplateConfig(templateRes.data),
    };
  }

  async fetchPerformanceProfileData(
    schoolId: string,
    studentId: string,
    termId: string,
  ): Promise<PerformanceProfileData> {
    const [profileRes, schoolRes, templateRes] = await Promise.all([
      this.api.get(`/intelligence/narrative/student/${studentId}?termId=${termId}`),
      this.api.get(`/schools/${schoolId}`),
      this.api.get(`/report-templates/default?schoolId=${schoolId}`),
    ]);

    const school = schoolRes.data as SchoolInfo;
    const profile = profileRes.data as any;
    const competencyScores = profile.competencyScores || [];

    return {
      school,
      student: profile.student || { id: studentId, firstName: '', lastName: '', admissionNumber: '' },
      className: profile.className || '',
      termName: profile.termName || '',
      academicYear: profile.academicYear || '',
      overallAverage: profile.overallAverage || 0,
      classRank: profile.classRank || 0,
      totalStudents: profile.totalStudents || 0,
      gpa: profile.gpa || 0,
      strengths: profile.strengths || [],
      weaknesses: profile.weaknesses || [],
      recommendations: profile.recommendations || [],
      subjectPerformance: profile.subjectPerformance || [],
      competencyScores,
      competencyLabels: competencyScores.map((c: any) => c.area),
      competencyDatasets: [{
        label: 'Competency Level',
        data: competencyScores.map((c: any) => c.score),
        color: this.getCompetencyColor(competencyScores),
      }],
      attendanceRate: profile.attendanceRate || 0,
      behavioralNotes: profile.behavioralNotes || [],
      template: this.buildTemplateConfig(templateRes.data),
    };
  }

  async fetchData(type: ReportType, schoolId: string, params: Record<string, any>): Promise<any> {
    switch (type) {
      case 'report-card':
        return this.fetchReportCardData(schoolId, params.studentId, params.termId);
      case 'transcript':
        return this.fetchTranscriptData(schoolId, params.studentId);
      case 'analytics-summary':
        return this.fetchAnalyticsSummaryData(schoolId, params.classId, params.termId);
      case 'performance-profile':
        return this.fetchPerformanceProfileData(schoolId, params.studentId, params.termId);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private getCompetencyColor(scores: Array<{ area: string; score: number; level: string }>): string {
    const avg = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 50;
    if (avg >= 70) return '#059669';
    if (avg >= 50) return '#d97706';
    return '#dc2626';
  }

  private buildTemplateConfig(template: any) {
    return {
      primaryColor: template?.primaryColor || '#1a56db',
      secondaryColor: template?.secondaryColor || '#f3f4f6',
      includeLogo: template?.includeLogo !== false,
      includeStamp: template?.includeStamp || false,
      includeSignature: template?.includeSignature || false,
      includeComments: template?.includeComments !== false,
      includeRankings: template?.includeRankings !== false,
      includeBestSix: template?.includeBestSix !== false,
      includeUniversity: template?.includeUniversity !== false,
      includeGrading: template?.includeGrading !== false,
      remarksEnabled: template?.remarksEnabled !== false,
      headerText: template?.headerText || '',
      footerText: template?.footerText || '',
      directorName: template?.directorName || '',
    };
  }
}
