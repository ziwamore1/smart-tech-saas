export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  photoUrl?: string | null;
  createdAt?: string;
  roles: string[];
  schoolId: string | null;
  school?: School | null;
  institutionType?: string | null;
}

export const INSTITUTION_TYPES = {
  PRIMARY_SCHOOL: 'PRIMARY_SCHOOL',
  SECONDARY_SCHOOL: 'SECONDARY_SCHOOL',
  ADVANCED_SECONDARY: 'ADVANCED_SECONDARY',
  COLLEGE: 'COLLEGE',
  UNIVERSITY: 'UNIVERSITY',
} as const;

export type InstitutionTypeCode = keyof typeof INSTITUTION_TYPES;

export const INSTITUTION_TYPE_LABELS: Record<InstitutionTypeCode, string> = {
  PRIMARY_SCHOOL: 'Primary School',
  SECONDARY_SCHOOL: 'Secondary School',
  ADVANCED_SECONDARY: 'Advanced Secondary',
  COLLEGE: 'College',
  UNIVERSITY: 'University',
};

export const INSTITUTION_TYPE_ROLES: Record<InstitutionTypeCode, string[]> = {
  PRIMARY_SCHOOL: ['Head Teacher', 'Deputy Head', 'Director', 'Primary Teacher', 'Parent', 'Learner'],
  SECONDARY_SCHOOL: ['Head Teacher', 'Deputy Head', 'Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher', 'Parent', 'Student'],
  ADVANCED_SECONDARY: ['Head Teacher', 'Deputy Head', 'Director', 'Deputy Director', 'HOD', 'Teacher', 'Class Teacher', 'Parent', 'Student'],
  COLLEGE: ['Principal', 'Registrar', 'Lecturer', 'Student'],
  UNIVERSITY: ['Vice Chancellor', 'Dean', 'Lecturer', 'Research Supervisor', 'Student'],
};

export function getRolesForType(institutionType: string | null | undefined): string[] {
  if (!institutionType) return [];
  return INSTITUTION_TYPE_ROLES[institutionType as InstitutionTypeCode] || [];
}

export function isRoleForType(role: string, institutionType: string | null | undefined): boolean {
  if (!institutionType) return false;
  const roles = getRolesForType(institutionType);
  return roles.includes(role) || roles.some(r => r.toLowerCase() === role.toLowerCase());
}

export interface School {
  id: string;
  name: string;
  logo?: string | null;
  primaryColor?: string;
}

export interface LoginResponse {
  message: string;
  access_token: string;
  user: User;
}

export interface MobileLoginRequest {
  email?: string;
  username?: string;
  password: string;
  deviceToken?: string;
  deviceId?: string;
  platform?: string;
}

export interface SuperAdminLoginResponse {
  message: string;
  access_token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export interface DashboardData {
  currentTerm: {
    id: string;
    name: string;
    academicYear: string;
  } | null;
  userType: 'parent' | 'student' | 'teacher' | 'class_teacher' | 'director' | 'other';
  children?: Child[];
  stats?: DashboardStats;
  recentAnnouncements?: Announcement[];
  student?: StudentInfo;
  teacher?: TeacherInfo;
}

export interface DashboardStats {
  totalChildren?: number;
  resultsCount?: number;
  attendanceRate?: number;
  totalClasses?: number;
  classes?: { id: string; name: string }[];
  todayLessons?: number;
  totalStudents?: number;
  averageScore?: number;
  pendingTasks?: number;
  activeAlerts?: number;
  weakStudents?: number;
  topPerformers?: number;
}

export interface Child {
  id: string;
  name: string;
  admissionNumber: string;
  class: string;
}

export interface StudentInfo {
  id: string;
  name: string;
  admissionNumber: string;
  class: string;
}

export interface TeacherInfo {
  id: string;
  employeeNo: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  isRead: boolean;
  type: string;
  createdAt: string;
}

export interface TimetableSlot {
  id: string;
  day: number;
  period: number;
  subject: {
    id: string;
    name: string;
    code?: string;
  };
  teacher?: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  className?: string;
}

export interface StudentTimetable {
  className: string;
  timetable: TimetableSlot[];
}

export interface TeacherTimetable {
  assignments: TeachingAssignment[];
  timetable: TimetableSlot[];
}

export interface TeachingAssignment {
  id: string;
  class: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface Attendance {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
}

export interface Result {
  id: string;
  subject: {
    name: string;
  };
  score: number;
  grade?: string;
  remark?: string;
}

export interface ReportCard {
  studentId: string;
  termId: string;
  pdfUrl?: string;
}

export type UserRole = 'Student' | 'Parent' | 'Teacher' | 'Class Teacher' | 'Director' | 'SuperAdmin';

export interface LearningStyleResult {
  visual: number;
  aural: number;
  readWrite: number;
  kinesthetic: number;
  dominantStyle: string;
}

export interface AiTutorMessage {
  role: 'user' | 'tutor' | 'system';
  content: string;
  timestamp: string;
}

export interface AiTutorSession {
  sessionId: string;
  messages: AiTutorMessage[];
}

export interface BenchmarkComparison {
  subject: string;
  schoolAverage: number;
  nationalAverage: number;
  gap: number;
  significant: boolean;
}

export interface PsychometricResult {
  cronbachAlpha: number;
  splitHalf: number;
  itemCount: number;
  items: Array<{
    itemNumber: number;
    difficulty: number;
    discrimination: number;
    flag: string;
  }>;
}

export interface MobileIntelligence {
  studentStats: {
    average: number;
    grade: string;
    rank: number;
    totalStudents: number;
  } | null;
  learningStyle: LearningStyleResult | null;
  recentResults: Result[];
}

// ====== Template Builder Types ======

export interface TemplateCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

export interface TemplateComponent {
  id: string;
  templateId: string;
  type: string;
  label: string;
  content: any;
  styles: any;
  position: { x: number; y: number };
  size: { width: number; height: number };
  settings: any;
  placeholder?: string;
  isRequired: boolean;
  sortOrder: number;
  parentId?: string;
  children?: TemplateComponent[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  schoolId: string;
  templateType: string;
  status: string;
  pageSize?: string;
  orientation?: string;
  fontFamily?: string;
  fontSize?: number;
  primaryColor?: string;
  secondaryColor?: string;
  colorPalette?: any;
  layoutJson?: any;
  version: number;
  isDefault: boolean;
  categoryId?: string;
  category?: TemplateCategory;
  logoUrl?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  headerText?: string;
  footerText?: string;
  components: TemplateComponent[];
  certificate?: CertificateSettings;
  _count?: { components: number; versions: number };
  createdAt: string;
  updatedAt: string;
}

export interface CertificateSettings {
  id: string;
  templateId: string;
  certificateType: string;
  borderStyle: string;
  borderColor: string;
  sealUrl?: string;
  showQrCode: boolean;
  autoNumbering: boolean;
  nextNumber: number;
  showPhoto: boolean;
  signature1Label?: string;
  signature1Name?: string;
  signature1Title?: string;
  signature2Label?: string;
  signature2Name?: string;
  signature2Title?: string;
  awardText?: string;
  showBadge: boolean;
  badgeStyle: string;
  showWatermark: boolean;
  watermarkText?: string;
}

export interface AvailableComponent {
  type: string;
  label: string;
  icon: string;
  category: string;
}

// ====== AI Template Generator Types ======

export interface AITemplateSuggestion {
  id: string;
  title: string;
  description: string;
  type: string;
  preview: string;
  popularity: number;
}

export interface GeneratedLayout {
  pageSize: string;
  orientation: string;
  components: Partial<TemplateComponent>[];
}

// ====== Branding Preset Types ======

export interface BrandPreset {
  id: string;
  schoolId: string;
  name: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
    title: string;
  };
  logos: any;
  layout: {
    margins: { top: number; bottom: number; left: number; right: number };
    spacing: string;
  };
  metadata?: any;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ====== Template Marketplace Types ======

export interface MarketplaceItem {
  id: string;
  templateId: string;
  schoolId: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  price: number;
  previewUrl?: string;
  downloads: number;
  likes: number;
  featured: boolean;
  template?: { id: string; name: string; templateType: string; pageSize?: string };
  school?: { name: string };
  createdAt: string;
}

// ====== Cloud Asset Types ======

export interface TemplateAsset {
  id: string;
  schoolId: string;
  name: string;
  type: string;
  url: string;
  size: number;
  metadata?: {
    originalName?: string;
    mimeType?: string;
    thumbnailUrl?: string;
    alt?: string;
    tags?: string[];
    dimensions?: { width: number; height?: number };
  };
  createdAt: string;
}

export interface AssetCategory {
  id: string;
  label: string;
  icon: string;
}

// ====== Digital Signature Types ======

export interface DigitalSignature {
  id: string;
  schoolId: string;
  name: string;
  title?: string;
  email?: string;
  imageUrl?: string;
  signatureData?: string;
  certificate?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ====== Editor State Types ======

export interface EditorComponent extends TemplateComponent {
  isSelected: boolean;
  isLocked: boolean;
  isHidden: boolean;
}

export interface EditorState {
  template: ReportTemplate | null;
  components: EditorComponent[];
  selectedId: string | null;
  zoom: number;
  history: EditorSnapshot[];
  historyIndex: number;
  showGuides: boolean;
  snapToGrid: boolean;
  gridSize: number;
  clipboard: EditorComponent | null;
}

export interface EditorSnapshot {
  components: EditorComponent[];
}

// ====== Exam Types ======

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY' | 'MATCHING' | 'FILL_IN_BLANK' | 'STRUCTURED' | 'PRACTICAL';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'ADVANCED';
export type ExamType = 'EXAM' | 'QUIZ' | 'TEST' | 'MID_TERM' | 'END_TERM' | 'PRACTICAL' | 'OBJECTIVE' | 'STRUCTURED';

export interface Exam {
  id: string;
  title: string;
  description?: string;
  type: ExamType;
  classId: string;
  subjectId: string;
  termId: string;
  schoolId: string;
  templateId?: string;
  duration: number;
  totalScore: number;
  passingScore: number;
  instructions?: string;
  shuffleQuestions: boolean;
  showResults: boolean;
  maxAttempts: number;
  allowReview: boolean;
  randomizeOrder: boolean;
  scheduledAt?: string;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
  status: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  subject?: { id: string; name: string; code?: string };
  class?: { id: string; name: string };
  term?: { id: string; name: string };
  questions?: ExamQuestion[];
  sections?: ExamSection[];
  _count?: { questions: number; attempts: number };
}

export interface ExamQuestion {
  id: string;
  examId: string;
  sectionId?: string;
  question: string;
  questionType: QuestionType;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  score: number;
  difficulty: DifficultyLevel;
  competencyId?: string;
  topic?: string;
  tags: string[];
  partialScoring: boolean;
  negativeMarking: number;
  order: number;
  attachmentUrl?: string;
  metadata?: any;
}

export interface ExamSection {
  id: string;
  examId: string;
  title: string;
  instructions?: string;
  order: number;
  totalScore?: number;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  score?: number;
  totalScore?: number;
  percentage?: number;
  grade?: string;
  negativeScore: number;
  startedAt: string;
  submittedAt?: string;
  isSubmitted: boolean;
  isGraded: boolean;
  gradedAt?: string;
  gradedById?: string;
  timeSpent?: number;
  answers: ExamAnswer[];
  exam?: Exam;
}

export interface ExamAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  sectionId?: string;
  answer?: string;
  answerJson?: any;
  isCorrect?: boolean;
  score?: number;
  maxScore?: number;
  feedback?: string;
  gradedAt?: string;
  gradedById?: string;
  timeSpent?: number;
  question?: ExamQuestion;
}

export interface AutoMarkResult {
  attemptId: string;
  examId: string;
  studentId: string;
  score: number;
  totalScore: number;
  percentage: number;
  grade: string;
  isGraded: boolean;
  gradedAt: string;
  questionResults: Array<{
    questionId: string;
    score: number;
    maxScore: number;
    isCorrect: boolean;
    feedback: string;
  }>;
}

export interface ExamStats {
  examId: string;
  totalAttempts: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  medianScore: number;
  passRate: number;
  standardDeviation: number;
  averageTime: number;
  itemAnalysis: Array<{
    questionId: string;
    difficulty: number;
    discrimination: number;
    flag: string;
  }>;
  gradeDistribution: Array<{ grade: string; count: number; percentage: number }>;
}

export interface UploadedExam {
  id: string;
  title?: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  status: string;
  schoolId: string;
  createdById: string;
  createdAt: string;
}

// ========== STAFF POSITIONS & HIERARCHY ==========

export interface Department {
  id: string;
  name: string;
  code?: string;
  category: string;
  description?: string;
  isActive: boolean;
  _count?: { teachers: number; positions: number };
}

export interface StaffPosition {
  id: string;
  teacherId: string;
  positionType: 'DIRECTOR' | 'DEPUTY_DIRECTOR' | 'HEAD_TEACHER' | 'DEPUTY' | 'HOD' | 'SUBJECT_TEACHER' | 'CLASS_TEACHER' | 'SENIOR_TEACHER' | 'ADMINISTRATOR' | 'LOWER_PRIMARY_SENIOR_TEACHER' | 'UPPER_PRIMARY_SENIOR_TEACHER';
  departmentId?: string;
  classId?: string;
  isPrimary: boolean;
  isActive: boolean;
  teacher?: {
    id: string;
    employeeNo?: string;
    user?: { id: string; firstName: string; lastName: string; email: string };
  };
  department?: Department;
  class?: { id: string; name: string };
}

export interface HierarchyData {
  director?: { id: string; teacher: any } | null;
  deputyDirector?: { id: string; teacher: any }[];
  headTeacher?: { id: string; teacher: any } | null;
  deputies?: { id: string; teacher: any }[];
  departments: {
    department: Department;
    hod: { id: string; teacher: any; positionType?: string } | null;
    members: any[];
  }[];
  unassignedTeachers: any[];
}

export interface MonitoringChain {
  teacher: {
    id: string;
    user?: { id: string; firstName: string; lastName: string; email: string };
    departmentId?: string;
  };
  positions: { positionType: string; isPrimary: boolean }[];
  supervises: { id: string; positionType: string; teacher: any; department?: Department }[];
  supervisedBy: { id: string; positionType: string; teacher: any; department?: Department }[];
}

// ====== Grade7 ECZ Types ======

export interface Grade7Class {
  id: string;
  name: string;
  studentCount: number;
  teacherName?: string;
}

export interface Grade7MockExam {
  id: string;
  classId: string;
  termId: string;
  subjectId: string;
  title: string;
  paperType: 'SP1' | 'SP2' | 'MOCK';
  duration: number;
  totalScore: number;
  instructions?: string;
  questions?: any[];
  subject?: { id: string; name: string; code?: string };
  class?: { id: string; name: string };
  term?: { id: string; name: string };
  attempts?: Grade7ExamAttempt[];
  _count?: { attempts: number };
  createdAt: string;
}

export interface Grade7ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  totalScore: number;
  percentage: number;
  paper: string;
  student?: { id: string; firstName: string; lastName: string; admissionNo?: string };
}

export interface Grade7ScoreEntry {
  examId: string;
  studentId: string;
  score: number;
  totalScore?: number;
}

export interface Grade7BulkScoreEntry {
  examId: string;
  scores: Array<{ studentId: string; score: number }>;
}

export interface Grade7Result {
  id: string;
  studentId: string;
  classId: string;
  termId: string;
  sp1Score?: number;
  sp2Score?: number;
  mockScore?: number;
  combinedScore?: number;
  division?: string;
  divisionCode?: number;
  isEligible: boolean;
  rank?: number;
  student?: { id: string; firstName: string; lastName: string; admissionNo?: string };
}

export interface Grade7DivisionBreakdown {
  division: string;
  count: number;
  percentage: number;
  students: Grade7Result[];
}

export interface Grade7Ranking {
  studentId: string;
  studentName: string;
  admissionNo?: string;
  combinedScore: number;
  division: string;
  divisionCode: number;
  rank: number;
  totalStudents: number;
}

export interface SelectionPrediction {
  studentId: string;
  studentName: string;
  admissionNo?: string;
  combinedScore: number;
  division: string;
  predictedSchool?: string;
  predictedProgram?: string;
  confidence: number;
  cutoffScore?: number;
}

export interface Grade7ComputedResults {
  classId: string;
  termId: string;
  results: Grade7Result[];
  breakdown: Grade7DivisionBreakdown[];
  totalStudents: number;
}
