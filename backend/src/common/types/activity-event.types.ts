export enum ActivityEventType {
  // Authentication
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',

  // Results
  RESULT_ENTERED = 'RESULT_ENTERED',
  RESULT_BULK_ENTERED = 'RESULT_BULK_ENTERED',
  RESULT_PUBLISHED = 'RESULT_PUBLISHED',
  RESULT_SAVED = 'RESULT_SAVED',
  RESULTS_VERIFIED = 'RESULTS_VERIFIED',
  RESULTS_LOCKED = 'RESULTS_LOCKED',

  // Attendance
  ATTENDANCE_MARKED = 'ATTENDANCE_MARKED',
  ATTENDANCE_BULK_MARKED = 'ATTENDANCE_BULK_MARKED',
  ATTENDANCE_CHECKED_IN = 'ATTENDANCE_CHECKED_IN',
  ATTENDANCE_CHECKED_OUT = 'ATTENDANCE_CHECKED_OUT',

  // Exams
  EXAM_STARTED = 'EXAM_STARTED',
  EXAM_SUBMITTED = 'EXAM_SUBMITTED',
  EXAM_PUBLISHED = 'EXAM_PUBLISHED',

  // Assignments / Homework
  ASSIGNMENT_CREATED = 'ASSIGNMENT_CREATED',
  ASSIGNMENT_SUBMITTED = 'ASSIGNMENT_SUBMITTED',
  ASSIGNMENT_GRADED = 'ASSIGNMENT_GRADED',

  // AI Tutor
  AI_TUTOR_SESSION_STARTED = 'AI_TUTOR_SESSION_STARTED',
  AI_TUTOR_SESSION_ENDED = 'AI_TUTOR_SESSION_ENDED',
  AI_TUTOR_MESSAGE_SENT = 'AI_TUTOR_MESSAGE_SENT',

  // Report Cards
  REPORT_CARD_GENERATED = 'REPORT_CARD_GENERATED',

  // Enrollment
  STUDENT_ENROLLED = 'STUDENT_ENROLLED',

  // Administration
  TEACHER_CREATED = 'TEACHER_CREATED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  WORKFLOW_UPDATED = 'WORKFLOW_UPDATED',
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',

  // Timetable
  TIMETABLE_GENERATED = 'TIMETABLE_GENERATED',

  // System
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum ActivityCategory {
  RESULTS = 'RESULTS',
  ATTENDANCE = 'ATTENDANCE',
  EXAMS = 'EXAMS',
  ASSIGNMENTS = 'ASSIGNMENTS',
  AI_TUTOR = 'AI_TUTOR',
  REPORTS = 'REPORTS',
  ENROLLMENT = 'ENROLLMENT',
  ADMINISTRATION = 'ADMINISTRATION',
  TIMETABLE = 'TIMETABLE',
  SYSTEM = 'SYSTEM',
}

export enum ActivitySeverity {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  category: ActivityCategory;
  severity: ActivitySeverity;
  schoolId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  userRole: string;
  schoolId: string;
  lastSeen: Date;
  socketId: string;
  page?: string;
}

export interface LiveStats {
  usersOnline: number;
  teachersOnline: number;
  studentsOnline: number;
  teachersActiveNow: number;
  studentsLearningNow: number;
  activeExams: number;
  aiTutorSessions: number;
  attendanceMarkedToday: number;
  attendancePendingToday: number;
  resultsEnteredToday: number;
  assignmentsGradedToday: number;
  classesWithActivity: number;
  averageAttendanceRate: number;
}

export const CATEGORY_EVENT_MAP: Record<ActivityCategory, ActivityEventType[]> = {
  [ActivityCategory.RESULTS]: [
    ActivityEventType.RESULT_ENTERED,
    ActivityEventType.RESULT_BULK_ENTERED,
    ActivityEventType.RESULT_PUBLISHED,
    ActivityEventType.RESULT_SAVED,
    ActivityEventType.RESULTS_VERIFIED,
    ActivityEventType.RESULTS_LOCKED,
  ],
  [ActivityCategory.ATTENDANCE]: [
    ActivityEventType.ATTENDANCE_MARKED,
    ActivityEventType.ATTENDANCE_BULK_MARKED,
    ActivityEventType.ATTENDANCE_CHECKED_IN,
    ActivityEventType.ATTENDANCE_CHECKED_OUT,
  ],
  [ActivityCategory.EXAMS]: [
    ActivityEventType.EXAM_STARTED,
    ActivityEventType.EXAM_SUBMITTED,
    ActivityEventType.EXAM_PUBLISHED,
  ],
  [ActivityCategory.ASSIGNMENTS]: [
    ActivityEventType.ASSIGNMENT_CREATED,
    ActivityEventType.ASSIGNMENT_SUBMITTED,
    ActivityEventType.ASSIGNMENT_GRADED,
  ],
  [ActivityCategory.AI_TUTOR]: [
    ActivityEventType.AI_TUTOR_SESSION_STARTED,
    ActivityEventType.AI_TUTOR_SESSION_ENDED,
    ActivityEventType.AI_TUTOR_MESSAGE_SENT,
  ],
  [ActivityCategory.REPORTS]: [
    ActivityEventType.REPORT_CARD_GENERATED,
  ],
  [ActivityCategory.ENROLLMENT]: [
    ActivityEventType.STUDENT_ENROLLED,
  ],
  [ActivityCategory.ADMINISTRATION]: [
    ActivityEventType.USER_LOGIN,
    ActivityEventType.USER_LOGOUT,
    ActivityEventType.TEACHER_CREATED,
    ActivityEventType.PROFILE_UPDATED,
    ActivityEventType.WORKFLOW_UPDATED,
    ActivityEventType.NOTIFICATION_SENT,
  ],
  [ActivityCategory.TIMETABLE]: [
    ActivityEventType.TIMETABLE_GENERATED,
  ],
  [ActivityCategory.SYSTEM]: [
    ActivityEventType.SYSTEM_ALERT,
  ],
};
