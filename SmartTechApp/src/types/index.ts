export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  schoolId: string | null;
  school?: School | null;
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
  email: string;
  password: string;
  deviceToken?: string;
  deviceId?: string;
  platform?: string;
}

export interface DashboardData {
  currentTerm: {
    id: string;
    name: string;
    academicYear: string;
  } | null;
  userType: 'parent' | 'student' | 'teacher' | 'other';
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
