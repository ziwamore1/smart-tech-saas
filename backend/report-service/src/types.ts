export type ReportType = 'report-card' | 'transcript' | 'analytics-summary' | 'performance-profile' | 'class-list' | 'attendance-register' | 'student-attendance';

export interface ReportJobData {
  jobId: string;
  type: ReportType;
  schoolId: string;
  params: Record<string, any>;
  apiBaseUrl: string;
  apiKey: string;
  templateOverrides?: Partial<ReportTemplateConfig>;
}

export interface ReportTemplateConfig {
  primaryColor: string;
  secondaryColor: string;
  includeLogo: boolean;
  includeStamp: boolean;
  includeSignature: boolean;
  includeComments: boolean;
  includeRankings: boolean;
  includeBestSix: boolean;
  includeUniversity: boolean;
  includeGrading: boolean;
  remarksEnabled: boolean;
  headerText: string;
  footerText: string;
  directorName: string;
}

export interface ReportResult {
  jobId: string;
  type: ReportType;
  schoolId: string;
  status: 'completed' | 'failed';
  pdfPath: string;
  pdfSize: number;
  generatedAt: string;
  error?: string;
}

export interface SchoolInfo {
  id: string;
  name: string;
  logoUrl?: string;
  logo?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

export interface SubjectResult {
  subject: string;
  score: number;
  grade: string;
  remark: string;
  points: number;
}

export interface ReportCardData {
  school: SchoolInfo;
  student: StudentInfo;
  term: {
    id: string;
    name: string;
    academicYear: string;
  };
  subjects: SubjectResult[];
  summary: {
    totalMarks: number;
    totalPoints: number;
    average: number;
    numberOfSubjects: number;
    bestSixTotal: number;
    eligibleForUniversity: boolean;
    positionInClass: number;
    totalStudents: number;
  };
  teacherComment?: string;
  headComment?: string;
  gradingLegend: Array<{
    grade: string;
    minScore: number;
    maxScore: number;
    remark: string;
    points: number;
  }>;
  template: ReportTemplateConfig;
}

export interface TranscriptData {
  school: SchoolInfo;
  student: StudentInfo;
  entries: Array<{
    academicYear: string;
    term: string;
    className: string;
    subject: string;
    score: number;
    grade: string;
    points: number;
  }>;
  summary: {
    totalTerms: number;
    totalSubjects: number;
    overallAverage: number;
  };
  template: ReportTemplateConfig;
}

export interface AnalyticsSummaryData {
  school: SchoolInfo;
  className: string;
  termName: string;
  academicYear: string;
  classAverage: number;
  studentCount: number;
  subjectCount: number;
  distribution: Array<{ grade: string; count: number; percentage: number }>;
  distributionMap: { labels: string[]; data: number[] };
  subjectLabels: string[];
  subjectAvgData: number[];
  topStudents: Array<{ name: string; average: number; position: number }>;
  subjectAverages: Array<{ subject: string; average: number; highest: number; lowest: number }>;
  trends: Array<{ label: string; value: number }>;
  template: ReportTemplateConfig;
}

export interface PerformanceProfileData {
  school: SchoolInfo;
  student: StudentInfo;
  className: string;
  termName: string;
  academicYear: string;
  overallAverage: number;
  classRank: number;
  totalStudents: number;
  gpa: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  subjectPerformance: Array<{
    subject: string;
    score: number;
    grade: string;
    points: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  competencyScores: Array<{
    area: string;
    score: number;
    level: string;
  }>;
  competencyLabels: string[];
  competencyDatasets: Array<{ label: string; data: number[]; color: string }>;
  attendanceRate: number;
  behavioralNotes: string[];
  template: ReportTemplateConfig;
}
