// ---------------------------------------------------------------------------
// Teacher Analysis & Teaching Intelligence — shared domain types
//
// These contracts describe the consolidated, evidence-based picture the
// TeacherAnalyticsService builds from the AUTHORITATIVE academic data pipeline
// (ComputedResult + legacy Result + TeachingAssignment + Attendance).
// ---------------------------------------------------------------------------

export type RiskLevel = 'HIGH' | 'MODERATE' | 'STABLE';
export type Trend = 'IMPROVING' | 'DECLINING' | 'STABLE' | 'INSUFFICIENT_DATA';
export type GenderGapClassific = 'FEMALE_ADVANTAGE' | 'MALE_ADVANTAGE' | 'NEGLIGIBLE_GAP' | 'SIGNIFICANT_GAP' | 'INSUFFICIENT_DATA';
export type QualityQuantityQuadrant =
  | 'HIGH_QUANTITY_HIGH_QUALITY'
  | 'HIGH_QUANTITY_LOW_QUALITY'
  | 'LOW_QUANTITY_HIGH_QUALITY'
  | 'LOW_QUANTITY_LOW_QUALITY';

export interface TeacherContext {
  userId: string;
  schoolId: string;
  teacherRecordId: string | null;
  teacherName: string;
  teacherPhoto: string | null;
  department: string | null;
  roles: string[];
  isDirector: boolean;
}

export interface AssignmentRef {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
  className: string;
  subjectName: string;
  subjectCode: string | null;
  levelTypeName: string | null;
  schoolId: string;
}

export interface ScoreStats {
  count: number;
  average: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
  stdDev: number | null;
  passRate: number | null;
  failRate: number | null;
  distinctionRate: number | null;
  creditRate: number | null;
}

export interface DistributionBand {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number | null;
}

export interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number | null;
}

export interface GenderStats extends ScoreStats {
  count: number;
  average: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
  passRate: number | null;
  failRate: number | null;
  distinctionRate: number | null;
}

export interface GenderAnalysis {
  available: boolean;
  female: GenderStats;
  male: GenderStats;
  unknown: { count: number };
  gap: {
    averageGap: number | null;
    passRateGap: number | null;
    classification: GenderGapClassific;
    interpretation: string | null;
  };
}

export interface AssignmentAnalytics {
  assignmentId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  academicYearName: string;
  enrolledStudents: number;
  assessedStudents: number;
  assessmentsAnalysed: number;
  participationRate: number | null;
  stats: ScoreStats;
  distribution: DistributionBand[];
  gradeDistribution: GradeDistribution[];
  gender: GenderAnalysis;
  qualityQuantity: {
    quadrant: QualityQuantityQuadrant;
    qualityScore: number | null;
    quantityScore: number | null;
    label: string;
  };
  improvingStudents: string[];
  decliningStudents: string[];
  trend: Trend;
  trendDelta: number | null;
  atRiskCount: number;
  assessmentCompletion: number | null;
}

export interface StudentRiskSummary {
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  className: string;
  gender: string | null;
  photoUrl: string | null;
  currentAverage: number | null;
  passFailStatus: 'PASS' | 'FAIL' | 'NO_DATA';
  weakestCompetency: string | null;
  trend: Trend;
  trendDelta: number | null;
  attendanceRate: number | null;
  riskLevel: RiskLevel;
  flags: string[];
  recommendedIntervention: string;
}

export interface CompetencyAnalysis {
  available: boolean;
  source: string | null;
  dataRequired: string | null;
  classCompetency: Array<{
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
    competencyName: string;
    averageMastery: number | null;
    affectedStudents: number;
    affectedPercentage: number | null;
    trend: Trend;
    status: 'MASTERED' | 'DEVELOPING' | 'WEAK' | 'CRITICAL';
  }>;
  weakestCompetency: { name: string; averageMastery: number | null; className: string } | null;
  strongestCompetency: { name: string; averageMastery: number | null; className: string } | null;
}

export interface TeachingLoad {
  subjectsTaught: string[];
  classesTaught: string[];
  totalStudents: number;
  totalAssessments: number;
  competencyCoverage: number | null;
  resultCompletion: number | null;
  assessmentsPerClass: Array<{ className: string; subjectName: string; expected: number; entered: number }>;
}

export interface HistoricalPoint {
  termId: string;
  termName: string;
  academicYearName: string;
  average: number | null;
  passRate: number | null;
  count: number;
  isCurrent: boolean;
}

export interface TeacherSummary {
  teacher: TeacherContext;
  academicYear: string | null;
  term: { id: string; name: string } | null;
  examType: string;
  assignments: AssignmentRef[];
  classesCount: number;
  subjectsCount: number;
  totalStudentsTaught: number;
  assessmentsAnalysed: number;
  overallAverage: number | null;
  overallPassRate: number | null;
  highestClassAverage: { className: string; subjectName: string; average: number } | null;
  lowestClassAverage: { className: string; subjectName: string; average: number } | null;
  strongestSubject: { subjectName: string; average: number | null } | null;
  weakestSubject: { subjectName: string; average: number | null } | null;
  strongestCompetency: string | null;
  weakestCompetency: string | null;
  studentsRequiringIntervention: number;
  studentsAtRisk: number;
  genderGap: number | null;
  genderGapClassification: GenderGapClassific;
  performanceIndicators: {
    improvingRatio: number | null;
    decliningRatio: number | null;
    highPerformers: number;
    lowPerformers: number;
  };
  lastUpdated: string;
  dataPeriod: string;
}

export interface InsightFact {
  type: 'FACT' | 'OBSERVATION' | 'POSSIBLE_EXPLANATION' | 'RECOMMENDED_ACTION';
  text: string;
  evidence: string | null;
}

export interface TeacherInsight {
  aiUsed: boolean;
  model: string | null;
  generatedAt: string;
  scope: 'teacher';
  whatIsHappening: string;
  whereIsTheProblem: string;
  howSerious: { level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'; text: string } | null;
  whichLearnersAreAffected: Array<{ learnerGroup: string; count: number; detail: string }>;
  whatMayBeContributing: string[];
  supportingEvidence: Array<{ observation: string; metric: string }>;
  recommendedNextSteps: string[];
  howToMeasureProgress: string[];
  actionPlan: Array<{
    problem: string;
    evidence: string;
    affectedLearners: string;
    intervention: string;
    duration: string;
    successIndicator: string;
    followUp: string;
  }>;
  strengths: string[];
  factCheck: InsightFact[];
}

export interface TeacherReportData {
  header: {
    schoolName: string;
    schoolLogo: string | null;
    schoolAddress: string | null;
    schoolContact: string | null;
    title: string;
    teacherName: string;
    teacherPhoto: string | null;
    department: string | null;
    academicYear: string | null;
    term: string | null;
    examType: string;
    generatedDate: string;
  };
  summary: TeacherSummary;
  assignments: AssignmentAnalytics[];
  competency: CompetencyAnalysis;
  atRisk: StudentRiskSummary[];
  insights: TeacherInsight;
  placeholders: Record<string, string>;
  collectionPlaceholders: {
    classes: any[];
    subjects: any[];
    competencies: any[];
    students: any[];
  };
}

export type TeacherAnalyticsReportRequest = {
  type: string;
  schoolId: string;
  userId: string;
  termId?: string;
  examType?: string;
  templateId?: string;
  options?: Record<string, any>;
};