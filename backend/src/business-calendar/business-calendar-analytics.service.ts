import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';

export const FINAL_STATUSES = ['COMPLETED', 'PARTIALLY_COMPLETED', 'CANCELLED', 'NOT_COMPLETED', 'POSTPONED'];
export const NON_COMPLETING_ACTIVE = ['SCHEDULED', 'IN_PROGRESS', 'DELAYED', 'POSTPONED', 'PLANNED', 'RESCHEDULED'];

export interface CalendarActivityFilters {
  calendarId?: string;
  termId?: string;
  departmentId?: string;
  categoryId?: string;
  officerId?: string;
  status?: string;
  priority?: string;
  start?: Date;
  end?: Date;
}

export interface StatusBreakdown {
  PLANNED: number;
  SCHEDULED: number;
  IN_PROGRESS: number;
  COMPLETED: number;
  PARTIALLY_COMPLETED: number;
  DELAYED: number;
  POSTPONED: number;
  CANCELLED: number;
  NOT_COMPLETED: number;
  RESCHEDULED: number;
}

export interface KeyMetrics {
  total: number;
  completed: number;
  partiallyCompleted: number;
  inProgress: number;
  delayed: number;
  postponed: number;
  cancelled: number;
  notCompleted: number;
  overdue: number;
  dueSoon7: number;
  dueSoon14: number;
  dueToday: number;
  completionRate: number;
  onTimeCompletionRate: number;
  targetAchievementRate: number;
  partialCompletionRate: number;
  failureRate: number;
  averageCompletionPercentage: number;
  weightedCompletionScore: number;
}

export interface DepartmentStat {
  departmentId: string | null;
  departmentName: string;
  planned: number;
  completed: number;
  completionRate: number;
  delayed: number;
  notCompleted: number;
  targetAchievement: number;
  averageCompletion: number;
  overdue: number;
}

export interface CategoryStat {
  categoryId: string | null;
  categoryName: string;
  planned: number;
  completed: number;
  completionRate: number;
  delayed: number;
  targetAchievement: number;
}

export interface ResponsibilityStat {
  officerId: string | null;
  officerName: string;
  assigned: number;
  completed: number;
  delayed: number;
  overdue: number;
  completionRate: number;
  targetAchievement: number;
}

export interface MonthlyTrendPoint {
  month: string;
  monthKey: string;
  planned: number;
  completed: number;
}

export interface WeeklyTrendPoint {
  week: string;
  weekKey: string;
  planned: number;
  completed: number;
}

export interface FailureReasonStat {
  reason: string;
  count: number;
}

export interface GoalProgress {
  id: string;
  title: string;
  description: string | null;
  targetPercentage: number;
  currentProgress: number;
  gap: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'ACHIEVED';
  deadline: Date | null;
  department: string | null;
  recommendedAction: string;
}

export interface OverdueActivityRow {
  id: string;
  title: string;
  departmentName: string | null;
  officerName: string | null;
  plannedDate: Date;
  status: string;
  completionPercentage: number;
  target: number | null;
  targetUnit: string | null;
  actual: number | null;
  achievement: number | null;
  daysOverdue: number;
  recommendedAction: string;
}

export interface UpcomingActivityRow {
  id: string;
  title: string;
  departmentName: string | null;
  officerName: string | null;
  plannedDate: Date;
  status: string;
  priority: string;
  completionPercentage: number;
  bucket: 'today' | 'within7' | 'within14' | 'later';
}

export interface CalendarAnalytics {
  school: { id: string; name: string; logo: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; motto: string | null };
  calendar: { id: string; name: string; academicYear: string | null; term: string | null; startDate: Date; endDate: Date; version: number } | null;
  reportPeriod: string;
  generatedAt: string;
  activities: any[];
  statusBreakdown: StatusBreakdown;
  metrics: KeyMetrics;
  departments: DepartmentStat[];
  categories: CategoryStat[];
  responsibilities: ResponsibilityStat[];
  monthlyTrend: MonthlyTrendPoint[];
  weeklyTrend: WeeklyTrendPoint[];
  failureReasons: FailureReasonStat[];
  overdue: OverdueActivityRow[];
  upcoming: { today: UpcomingActivityRow[]; within7: UpcomingActivityRow[]; within14: UpcomingActivityRow[]; later: UpcomingActivityRow[] };
  goals: GoalProgress[];
  plannedVsActual: { planned: number; completed: number; notCompleted: number; delayed: number; targetPlanned: number; targetActual: number; targetGap: number };
  aiInsights: string[];
  aiRecommendations: string[];
}

const WEIGHTS: Record<string, number> = { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 };

@Injectable()
export class BusinessCalendarAnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  private pct(part: number, whole: number) {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
  }

  private achievement(actual: number | null | undefined, target: number | null | undefined) {
    if (!target || !actual) return null;
    return Math.round((actual / target) * 1000) / 10;
  }

  private recommendedAction(row: any, now: Date): string {
    if (row.status === 'CANCELLED') return 'Re-plan if this activity is still required, otherwise capture the reason and mark as closed.';
    if (row.status === 'POSTPONED' || row.status === 'RESCHEDULED') return 'Confirm a new planned date and keep stakeholders informed of the new schedule.';
    if (row.status === 'DELAYED') return 'Review the delay reason, agree a revised completion date and escalate if the delay is critical.';
    if (row.status === 'NOT_COMPLETED' || row.status === 'PARTIALLY_COMPLETED') return 'Assess what remains outstanding, capture a failure reason and carry the unfinished elements into the next term.';
    if (row.status === 'IN_PROGRESS') return 'Track progress against the target and assign a clear owner to drive completion.';
    return 'Activity is overdue and still planned — confirm whether it happened, update its status and completion percentage, or reschedule it.';
  }

  private async loadActivities(schoolId: string, calendarId: string, filters: CalendarActivityFilters = {}) {
    const where: any = { schoolId, calendarId };
    if (filters.termId) where.termId = filters.termId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.officerId) where.officerId = filters.officerId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.start || filters.end) {
      where.startDate = {};
      if (filters.start) where.startDate.gte = filters.start;
      if (filters.end) where.startDate.lte = filters.end;
    }
    return this.prisma.calendarActivity.findMany({ where, include: { category: true, department: true, officer: true, subItems: true, children: true }, orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }] });
  }

  async analyse(schoolId: string, calendarId: string, filters: CalendarActivityFilters = {}): Promise<CalendarAnalytics> {
    const now = new Date();
    const [school, calendar, goals, activities] = await Promise.all([
      this.prisma.school.findUnique({ where: { id: schoolId } }),
      this.prisma.schoolBusinessCalendar.findFirst({ where: { id: calendarId, schoolId }, include: { academicYear: true, term: true } }),
      this.prisma.calendarGoal.findMany({ where: { schoolId, calendarId, ...(filters.termId ? { termId: filters.termId } : {}) }, include: { department: true } }),
      this.loadActivities(schoolId, calendarId, filters),
    ]);

    const statusBreakdown: StatusBreakdown = { PLANNED: 0, SCHEDULED: 0, IN_PROGRESS: 0, COMPLETED: 0, PARTIALLY_COMPLETED: 0, DELAYED: 0, POSTPONED: 0, CANCELLED: 0, NOT_COMPLETED: 0, RESCHEDULED: 0 };
    for (const row of activities) statusBreakdown[row.status as keyof StatusBreakdown] = (statusBreakdown[row.status as keyof StatusBreakdown] || 0) + 1;

    let completed = statusBreakdown.COMPLETED;
    let partiallyCompleted = statusBreakdown.PARTIALLY_COMPLETED;
    let inProgress = statusBreakdown.IN_PROGRESS;
    let delayed = statusBreakdown.DELAYED;
    let postponed = statusBreakdown.POSTPONED + statusBreakdown.RESCHEDULED;
    let cancelled = statusBreakdown.CANCELLED;
    let notCompleted = statusBreakdown.NOT_COMPLETED;
    let total = activities.length;

    const isDone = (row: any) => row.status === 'COMPLETED' || (row.status === 'COMPLETED' && row.completionPercentage >= 100);
    const onTime = activities.filter((row) => isDone(row) && row.actualCompletionDate && row.actualCompletionDate <= row.endDate).length;
    const completionRate = this.pct(completed, total);
    const onTimeCompletionRate = this.pct(onTime, completed || total);
    const targetAchievementValues = activities.filter((row) => row.target && row.actualOutcome && Number(row.actualOutcome)).map((row) => this.achievement(Number(row.actualOutcome), row.target) || 0);
    const targetAchievementRate = targetAchievementValues.length ? Math.round((targetAchievementValues.reduce((sum, v) => sum + v, 0) / targetAchievementValues.length) * 10) / 10 : null;
    const averageCompletionPercentage = total ? Math.round((activities.reduce((sum, row) => sum + (row.completionPercentage || (row.status === 'COMPLETED' ? 100 : 0)), 0) / total) * 10) / 10 : 0;
    const partialCompletionRate = this.pct(partiallyCompleted, total);
    const failureRate = this.pct(notCompleted, total);
    const weightedPoints = activities.reduce((sum, row) => sum + (WEIGHTS[row.priority as string] || 2) * (row.status === 'COMPLETED' ? 1 : row.status === 'PARTIALLY_COMPLETED' ? 0.5 : 0), 0);
    const weightedTotal = activities.reduce((sum, row) => sum + (WEIGHTS[row.priority as string] || 2), 0);
    const weightedCompletionScore = weightedTotal ? Math.round((weightedPoints / weightedTotal) * 1000) / 10 : 0;

    const overdue = activities.filter((row) => row.endDate < now && !isDone(row) && row.status !== 'CANCELLED' && row.status !== 'POSTPONED' && row.status !== 'RESCHEDULED').map((row): OverdueActivityRow => ({
      id: row.id,
      title: row.title,
      departmentName: row.department?.name || null,
      officerName: row.officer ? `${row.officer.firstName} ${row.officer.lastName}` : null,
      plannedDate: row.endDate,
      status: row.status,
      completionPercentage: row.completionPercentage || 0,
      target: row.target || null,
      targetUnit: row.targetUnit || null,
      actual: row.actualOutcome ? Number(row.actualOutcome) : null,
      achievement: row.target ? this.achievement(row.actualOutcome ? Number(row.actualOutcome) : null, row.target) : null,
      daysOverdue: Math.floor((now.getTime() - row.endDate.getTime()) / 86400000),
      recommendedAction: this.recommendedAction(row, now),
    }));
    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const upcoming: UpcomingActivityRow[] = activities.filter((row) => row.endDate >= now && !isDone(row) && ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'DELAYED', 'RESCHEDULED'].includes(row.status)).map((row) => {
      const diff = Math.floor((row.startDate.getTime() - now.getTime()) / 86400000);
      const bucket = diff <= 0 ? 'today' : diff <= 7 ? 'within7' : diff <= 14 ? 'within14' : 'later';
      return { id: row.id, title: row.title, departmentName: row.department?.name || null, officerName: row.officer ? `${row.officer.firstName} ${row.officer.lastName}` : null, plannedDate: row.startDate, status: row.status, priority: row.priority, completionPercentage: row.completionPercentage || 0, bucket };
    });
    const upcomingGrouped = {
      today: upcoming.filter((row) => row.bucket === 'today'),
      within7: upcoming.filter((row) => row.bucket === 'within7'),
      within14: upcoming.filter((row) => row.bucket === 'within14'),
      later: upcoming.filter((row) => row.bucket === 'later'),
    };

    const departmentMap = new Map<string, DepartmentStat>();
    for (const row of activities) {
      const key = row.departmentId || 'none';
      if (!departmentMap.has(key)) departmentMap.set(key, { departmentId: row.departmentId, departmentName: row.department?.name || 'Unassigned', planned: 0, completed: 0, completionRate: 0, delayed: 0, notCompleted: 0, targetAchievement: 0, averageCompletion: 0, overdue: 0 });
      const stat = departmentMap.get(key)!;
      stat.planned++;
      if (isDone(row)) stat.completed++;
      if (row.status === 'DELAYED') stat.delayed++;
      if (row.status === 'NOT_COMPLETED') stat.notCompleted++;
      if (row.endDate < now && !isDone(row)) stat.overdue++;
      stat.targetAchievement = Math.max(stat.targetAchievement, row.target ? this.achievement(row.actualOutcome ? Number(row.actualOutcome) : null, row.target) || 0 : 0);
      stat.averageCompletion += row.completionPercentage || 0;
    }
    const departments = [...departmentMap.values()].map((stat) => ({ ...stat, completionRate: this.pct(stat.completed, stat.planned), averageCompletion: stat.planned ? Math.round((stat.averageCompletion / stat.planned) * 10) / 10 : 0 })).sort((a, b) => a.completionRate - b.completionRate);

    const categoryMap = new Map<string, CategoryStat>();
    for (const row of activities) {
      const key = row.categoryId || 'none';
      if (!categoryMap.has(key)) categoryMap.set(key, { categoryId: row.categoryId, categoryName: row.category?.name || 'Other', planned: 0, completed: 0, completionRate: 0, delayed: 0, targetAchievement: 0 });
      const stat = categoryMap.get(key)!;
      stat.planned++;
      if (isDone(row)) stat.completed++;
      if (row.status === 'DELAYED') stat.delayed++;
      stat.targetAchievement = Math.max(stat.targetAchievement, row.target ? this.achievement(row.actualOutcome ? Number(row.actualOutcome) : null, row.target) || 0 : 0);
    }
    const categories = [...categoryMap.values()].map((stat) => ({ ...stat, completionRate: this.pct(stat.completed, stat.planned) })).sort((a, b) => b.planned - a.planned);

    const responsibilityMap = new Map<string, ResponsibilityStat>();
    for (const row of activities) {
      const key = row.officerId || 'none';
      if (!responsibilityMap.has(key)) responsibilityMap.set(key, { officerId: row.officerId, officerName: row.officer ? `${row.officer.firstName} ${row.officer.lastName}` : 'Unassigned', assigned: 0, completed: 0, delayed: 0, overdue: 0, completionRate: 0, targetAchievement: 0 });
      const stat = responsibilityMap.get(key)!;
      stat.assigned++;
      if (isDone(row)) stat.completed++;
      if (row.status === 'DELAYED') stat.delayed++;
      if (row.endDate < now && !isDone(row)) stat.overdue++;
      stat.targetAchievement = Math.max(stat.targetAchievement, row.target ? this.achievement(row.actualOutcome ? Number(row.actualOutcome) : null, row.target) || 0 : 0);
    }
    const responsibilities = [...responsibilityMap.values()].map((stat) => ({ ...stat, completionRate: this.pct(stat.completed, stat.assigned) })).sort((a, b) => b.assigned - a.assigned);

    const monthlyMap = new Map<string, MonthlyTrendPoint>();
    const weeklyMap = new Map<string, WeeklyTrendPoint>();
    for (const row of activities) {
      const monthKey = `${row.startDate.getFullYear()}-${String(row.startDate.getMonth() + 1).padStart(2, '0')}`;
      const month = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(row.startDate);
      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, { month, monthKey, planned: 0, completed: 0 });
      const mp = monthlyMap.get(monthKey)!;
      mp.planned++;
      if (isDone(row)) mp.completed++;
      const weekStart = new Date(row.startDate);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      const weekLabel = `w/c ${new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' }).format(weekStart)}`;
      if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { week: weekLabel, weekKey, planned: 0, completed: 0 });
      const wp = weeklyMap.get(weekKey)!;
      wp.planned++;
      if (isDone(row)) wp.completed++;
    }
    const monthlyTrend = [...monthlyMap.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const weeklyTrend = [...weeklyMap.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey));

    const failureReasonMap = new Map<string, FailureReasonStat>();
    for (const row of activities) {
      if (row.status === 'NOT_COMPLETED' || row.status === 'PARTIALLY_COMPLETED' || row.status === 'DELAYED') {
        const reason = row.failureReason || row.delayReason || 'reason not captured';
        if (!failureReasonMap.has(reason)) failureReasonMap.set(reason, { reason, count: 0 });
        failureReasonMap.get(reason)!.count++;
      }
    }
    const failureReasons = [...failureReasonMap.values()].sort((a, b) => b.count - a.count);

    const goalStats: GoalProgress[] = goals.map((goal) => {
      const progress = goal.currentProgress || this.pct(completed, total);
      const gap = Math.round((goal.targetPercentage - progress) * 10) / 10;
      const goalStatus = progress >= goal.targetPercentage ? 'ACHIEVED' : gap <= 10 ? 'ON_TRACK' : gap <= 25 ? 'AT_RISK' : 'OFF_TRACK';
      return { id: goal.id, title: goal.title, description: goal.description, targetPercentage: goal.targetPercentage, currentProgress: progress, gap, status: goalStatus as GoalProgress['status'], deadline: goal.deadline, department: goal.department?.name || null, recommendedAction: goalStatus === 'ACHIEVED' ? 'Maintain the current level of execution next term.' : gap <= 10 ? 'Continue current momentum — the target is within reach.' : gap <= 25 ? 'Review workload, unblock delays and re-focus resources on this goal.' : 'Redesign the plan, reduce scope or assign additional capacity before the deadline.' };
    });

    const plannedVsActual = {
      planned: total,
      completed,
      notCompleted: notCompleted + postponed,
      delayed,
      targetPlanned: activities.filter((row) => row.target).length,
      targetActual: targetAchievementValues.length,
      targetGap: targetAchievementValues.length ? Math.round((targetAchievementValues.reduce((sum, v) => sum + v, 0) / targetAchievementValues.length - 100) * 10) / 10 : 0,
    };

    return {
      school: { id: school?.id || schoolId, name: school?.name || 'School', logo: school?.logoUrl || school?.logo || null, address: school?.address || null, phone: school?.phone || null, email: school?.email || null, website: school?.website || null, motto: school?.motto || null },
      calendar: calendar ? { id: calendar.id, name: calendar.name, academicYear: calendar.academicYear?.name || null, term: calendar.term?.name || null, startDate: calendar.startDate, endDate: calendar.endDate, version: calendar.version } : null,
      reportPeriod: filters.start && filters.end ? `${new Intl.DateTimeFormat('en-GB').format(filters.start)} – ${new Intl.DateTimeFormat('en-GB').format(filters.end)}` : `${new Intl.DateTimeFormat('en-GB').format(calendar?.startDate || new Date())} – ${new Intl.DateTimeFormat('en-GB').format(calendar?.endDate || new Date())}`,
      generatedAt: now.toISOString(),
      activities: activities.map((row) => ({ ...row, achievement: row.target ? this.achievement(row.actualOutcome ? Number(row.actualOutcome) : null, row.target) : null, variance: row.target ? Math.round((((row.actualOutcome ? Number(row.actualOutcome) : 0) - (row.target || 0)) / (row.target || 1)) * 1000) / 10 : null })),
      statusBreakdown,
      metrics: { total, completed, partiallyCompleted, inProgress, delayed, postponed, cancelled, notCompleted, overdue: overdue.length, dueToday: upcomingGrouped.today.length, dueSoon7: upcomingGrouped.within7.length, dueSoon14: upcomingGrouped.within14.length, completionRate, onTimeCompletionRate, targetAchievementRate, partialCompletionRate, failureRate, averageCompletionPercentage, weightedCompletionScore },
      departments, categories, responsibilities,
      monthlyTrend, weeklyTrend, failureReasons,
      overdue,
      upcoming: upcomingGrouped,
      goals: goalStats,
      plannedVsActual,
      aiInsights: this.buildInsights({ total, completed, delayed, cancelled, notCompleted, partiallyCompleted, completionRate, targetAchievementRate, onTimeCompletionRate, departments, categories }, calendar?.term?.name || 'this term'),
      aiRecommendations: this.buildRecommendations({ departments, categories, failureReasons, overdue, goalStats }, now),
    };
  }

  private buildInsights(s: any, termLabel: string): string[] {
    const insights: string[] = [];
    insights.push(`During ${termLabel}, the school planned ${s.total} activities and completed ${s.completed}, resulting in a ${s.completionRate}% completion rate.`);
    if (s.targetAchievementRate != null) insights.push(`Target achievement reached ${s.targetAchievementRate}%, indicating that ${s.targetAchievementRate >= s.completionRate ? 'activities were completed while exceeding their intended targets.' : 'several activities were completed without fully achieving their intended outcomes.'}`);
    if (s.onTimeCompletionRate != null) insights.push(`Of completed activities, ${s.onTimeCompletionRate}% were completed on or before their planned date.`);
    if (s.delayed) insights.push(`${s.delayed} activities are delayed (${s.statusBreakdown?.DELAYED || 0} marked delayed, ${s.cancelled} cancelled, ${s.notCompleted} not completed).`);
    const weakest = [...s.departments].sort((a: any, b: any) => a.completionRate - b.completionRate)[0];
    const strongest = [...s.departments].sort((a: any, b: any) => b.completionRate - a.completionRate)[0];
    if (strongest && s.departments.length > 1) insights.push(`Strongest area: ${strongest.departmentName} with a ${strongest.completionRate}% completion rate.`);
    if (weakest && s.departments.length > 1) insights.push(`Weakest area: ${weakest.departmentName} with a ${weakest.completionRate}% completion rate — consider targeted support.`);
    return insights;
  }

  private buildRecommendations(s: any, now: Date): string[] {
    const recs: string[] = [];
    if (s.failureReasons?.length) {
      const top = s.failureReasons[0];
      recs.push(`${top.count} activity/activities recorded "${top.reason}" as the reason for non-completion. Review operational planning to address this recurring cause.`);
    }
    for (const dept of s.departments || []) {
      if (dept.delayed > 0) recs.push(`${dept.delayed} ${dept.departmentName} activit${dept.delayed > 1 ? 'ies are' : 'y is'} delayed. Establish a shared departmental activity calendar and early-warning reviews before the next term.`);
      if (dept.notCompleted > 0) recs.push(`${dept.notCompleted} ${dept.departmentName} activit${dept.notCompleted > 1 ? 'ies remain' : 'y remains'} incomplete.`);
    }
    const highPriorityOverdue = (s.overdue || []).filter((row: any) => row.status === 'IN_PROGRESS' || row.status === 'SCHEDULED' || row.status === 'PLANNED');
    if (highPriorityOverdue.length) recs.push(`${highPriorityOverdue.length} high-priority activit${highPriorityOverdue.length > 1 ? 'ies are' : 'y is'} overdue and require immediate attention before the term closes.`);
    for (const goal of s.goalStats || []) {
      if (goal.status === 'AT_RISK') recs.push(`Term goal "${goal.title}" is at risk with a ${goal.gap} percentage point gap. ${goal.recommendedAction}`);
      if (goal.status === 'OFF_TRACK') recs.push(`Term goal "${goal.title}" is off track. ${goal.recommendedAction}`);
    }
    if (!recs.length) recs.push('No urgent operational issues detected. Continue current planning and monitoring practices.');
    return recs;
  }
}