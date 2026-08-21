import { Injectable, Logger, Optional } from '@nestjs/common';
import { SchoolEventsGateway } from '../school-events.gateway';
import {
  ActivityEvent,
  ActivityEventType,
  ActivityCategory,
  ActivitySeverity,
  PresenceInfo,
  LiveStats,
} from '../types/activity-event.types';

@Injectable()
export class SchoolActivityService {
  private readonly logger = new Logger(SchoolActivityService.name);

  private readonly MAX_FEED_SIZE = 500;
  private readonly PRESENCE_TIMEOUT_MS = 5 * 60 * 1000;
  private readonly DAILY_COUNTER_RESET_MS = 60 * 1000;

  private activityFeedBySchool = new Map<string, ActivityEvent[]>();
  private presenceBySchool = new Map<string, Map<string, PresenceInfo>>();
  private dailyCountersBySchool = new Map<string, Map<string, number>>();

  private constructor() {}

  getGateway(): SchoolEventsGateway | undefined {
    return this._gateway;
  }

  private _gateway: SchoolEventsGateway | null = null;

  setGateway(gateway: SchoolEventsGateway) {
    this._gateway = gateway;
  }

  publish(event: Omit<ActivityEvent, 'id' | 'timestamp'>): ActivityEvent {
    const fullEvent: ActivityEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date(),
    };

    this.addToFeed(event.schoolId, fullEvent);
    this.incrementCounter(event.schoolId, 'total');
    this.incrementCounter(event.schoolId, event.type);

    if (this._gateway) {
      this._gateway.emitToSchool(event.schoolId, 'activity:live', fullEvent);
      this._gateway.emitToSchool(event.schoolId, 'activity:stats', this.getLiveStats(event.schoolId));
    }

    this.logger.debug(`Published activity: ${event.type} in school ${event.schoolId}`);
    return fullEvent;
  }

  private addToFeed(schoolId: string, event: ActivityEvent) {
    if (!this.activityFeedBySchool.has(schoolId)) {
      this.activityFeedBySchool.set(schoolId, []);
    }
    const feed = this.activityFeedBySchool.get(schoolId)!;
    feed.unshift(event);
    if (feed.length > this.MAX_FEED_SIZE) {
      feed.length = this.MAX_FEED_SIZE;
    }
  }

  getFeed(schoolId: string, limit = 50, offset = 0, category?: ActivityCategory): ActivityEvent[] {
    const feed = this.activityFeedBySchool.get(schoolId) || [];
    if (category) {
      const categoryEvents = this.getEventsForCategory(category);
      return feed.filter(e => categoryEvents.includes(e.type)).slice(offset, offset + limit);
    }
    return feed.slice(offset, offset + limit);
  }

  private getEventsForCategory(category: ActivityCategory): ActivityEventType[] {
    const map: Record<ActivityCategory, ActivityEventType[]> = {
      [ActivityCategory.RESULTS]: [
        ActivityEventType.RESULT_ENTERED, ActivityEventType.RESULT_BULK_ENTERED,
        ActivityEventType.RESULT_PUBLISHED, ActivityEventType.RESULT_SAVED,
        ActivityEventType.RESULTS_VERIFIED, ActivityEventType.RESULTS_LOCKED,
      ],
      [ActivityCategory.ATTENDANCE]: [
        ActivityEventType.ATTENDANCE_MARKED, ActivityEventType.ATTENDANCE_BULK_MARKED,
        ActivityEventType.ATTENDANCE_CHECKED_IN, ActivityEventType.ATTENDANCE_CHECKED_OUT,
      ],
      [ActivityCategory.EXAMS]: [
        ActivityEventType.EXAM_STARTED, ActivityEventType.EXAM_SUBMITTED, ActivityEventType.EXAM_PUBLISHED,
      ],
      [ActivityCategory.ASSIGNMENTS]: [
        ActivityEventType.ASSIGNMENT_CREATED, ActivityEventType.ASSIGNMENT_SUBMITTED,
        ActivityEventType.ASSIGNMENT_GRADED,
      ],
      [ActivityCategory.AI_TUTOR]: [
        ActivityEventType.AI_TUTOR_SESSION_STARTED, ActivityEventType.AI_TUTOR_SESSION_ENDED,
        ActivityEventType.AI_TUTOR_MESSAGE_SENT,
      ],
      [ActivityCategory.REPORTS]: [ActivityEventType.REPORT_CARD_GENERATED],
      [ActivityCategory.ENROLLMENT]: [ActivityEventType.STUDENT_ENROLLED],
      [ActivityCategory.ADMINISTRATION]: [
        ActivityEventType.USER_LOGIN, ActivityEventType.USER_LOGOUT,
        ActivityEventType.TEACHER_CREATED, ActivityEventType.PROFILE_UPDATED,
        ActivityEventType.WORKFLOW_UPDATED, ActivityEventType.NOTIFICATION_SENT,
      ],
      [ActivityCategory.TIMETABLE]: [ActivityEventType.TIMETABLE_GENERATED],
      [ActivityCategory.SYSTEM]: [ActivityEventType.SYSTEM_ALERT],
    };
    return map[category] || [];
  }

  getLiveStats(schoolId: string): LiveStats {
    const presence = this.getPresence(schoolId);
    const counters = this.dailyCountersBySchool.get(schoolId) || new Map();

    const teachersOnline = presence.filter(p => p.userRole === 'Teacher' || p.userRole === 'HOD' || p.userRole === 'Director').length;
    const studentsOnline = presence.filter(p => p.userRole === 'Student').length;

    const teacherPages = presence.filter(p =>
      (p.userRole === 'Teacher' || p.userRole === 'HOD' || p.userRole === 'Director') &&
      p.page && !['/login', '/dashboard', '/settings'].includes(p.page)
    ).length;

    const studentLearningPages = presence.filter(p =>
      p.userRole === 'Student' &&
      p.page && (
        p.page.includes('ai-tutor') ||
        p.page.includes('exam') ||
        p.page.includes('assignment') ||
        p.page.includes('learning')
      )
    ).length;

    return {
      usersOnline: presence.length,
      teachersOnline,
      studentsOnline,
      teachersActiveNow: teacherPages,
      studentsLearningNow: studentLearningPages,
      activeExams: counters.get('EXAM_STARTED') || 0,
      aiTutorSessions: counters.get('AI_TUTOR_SESSION_STARTED') || 0,
      attendanceMarkedToday: (counters.get('ATTENDANCE_MARKED') || 0) + (counters.get('ATTENDANCE_BULK_MARKED') || 0),
      attendancePendingToday: Math.max(0, (counters.get('ATTENDANCE_MARKED') || 0) - (counters.get('ATTENDANCE_MARKED') || 0)),
      resultsEnteredToday: (counters.get('RESULT_ENTERED') || 0) + (counters.get('RESULT_BULK_ENTERED') || 0) + (counters.get('RESULT_SAVED') || 0),
      assignmentsGradedToday: counters.get('ASSIGNMENT_GRADED') || 0,
      classesWithActivity: this.getUniqueClassesWithActivity(schoolId),
      averageAttendanceRate: 0,
    };
  }

  private getUniqueClassesWithActivity(schoolId: string): number {
    const feed = this.activityFeedBySchool.get(schoolId) || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const classes = new Set<string>();
    for (const event of feed) {
      if (event.timestamp >= today && event.metadata?.classId) {
        classes.add(event.metadata.classId);
      }
    }
    return classes.size;
  }

  trackPresence(schoolId: string, userId: string, userName: string, userRole: string, socketId: string, page?: string) {
    if (!this.presenceBySchool.has(schoolId)) {
      this.presenceBySchool.set(schoolId, new Map());
    }
    const schoolPresence = this.presenceBySchool.get(schoolId)!;
    schoolPresence.set(userId, {
      userId,
      userName,
      userRole,
      schoolId,
      lastSeen: new Date(),
      socketId,
      page,
    });

    if (this._gateway) {
      this._gateway.emitToSchool(schoolId, 'presence:update', this.getPresenceArray(schoolId));
      this._gateway.emitToSchool(schoolId, 'activity:stats', this.getLiveStats(schoolId));
    }
  }

  removePresence(schoolId: string, socketId: string) {
    const schoolPresence = this.presenceBySchool.get(schoolId);
    if (!schoolPresence) return;

    for (const [userId, info] of schoolPresence.entries()) {
      if (info.socketId === socketId) {
        schoolPresence.delete(userId);
        break;
      }
    }

    if (this._gateway) {
      this._gateway.emitToSchool(schoolId, 'presence:update', this.getPresenceArray(schoolId));
      this._gateway.emitToSchool(schoolId, 'activity:stats', this.getLiveStats(schoolId));
    }
  }

  updatePresencePage(schoolId: string, userId: string, page: string) {
    const schoolPresence = this.presenceBySchool.get(schoolId);
    if (!schoolPresence) return;
    const info = schoolPresence.get(userId);
    if (info) {
      info.page = page;
      info.lastSeen = new Date();
    }
  }

  getPresence(schoolId: string): PresenceInfo[] {
    this.cleanupStalePresence(schoolId);
    return this.getPresenceArray(schoolId);
  }

  private getPresenceArray(schoolId: string): PresenceInfo[] {
    const schoolPresence = this.presenceBySchool.get(schoolId);
    return schoolPresence ? Array.from(schoolPresence.values()) : [];
  }

  private cleanupStalePresence(schoolId: string) {
    const schoolPresence = this.presenceBySchool.get(schoolId);
    if (!schoolPresence) return;
    const now = Date.now();
    for (const [userId, info] of schoolPresence.entries()) {
      if (now - info.lastSeen.getTime() > this.PRESENCE_TIMEOUT_MS) {
        schoolPresence.delete(userId);
      }
    }
  }

  private incrementCounter(schoolId: string, key: string) {
    if (!this.dailyCountersBySchool.has(schoolId)) {
      this.dailyCountersBySchool.set(schoolId, new Map());
    }
    const counters = this.dailyCountersBySchool.get(schoolId)!;
    counters.set(key, (counters.get(key) || 0) + 1);
  }

  private generateId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
