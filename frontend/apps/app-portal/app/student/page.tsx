'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import ReactECharts from 'echarts-for-react';
import { studentApi, resultApi, termApi, homeworkApi, assessmentApi, attendanceApi, examApi, notificationsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSchoolSocket } from '@/lib/use-school-socket';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  'B+': '#3b82f6',
  B: '#3b82f6',
  'B-': '#6366f1',
  'C+': '#f59e0b',
  C: '#f59e0b',
  D: '#f97316',
  E: '#ef4444',
  F: '#ef4444',
};

function getGrade(score: number): string {
  if (score >= 75) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 65) return 'B';
  if (score >= 60) return 'B-';
  if (score >= 55) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}

function gradeColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function StatCard({ label, value, gradient, icon, sub }: { label: string; value: string; gradient: string; icon: string; sub?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-sm bg-gradient-to-br ${gradient}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/80">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-white/70 mt-1">{sub}</p>}
        </div>
        <span className="text-3xl opacity-90">{icon}</span>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, action }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useSchoolSocket({
    'results:published': () => {
      queryClient.invalidateQueries({ queryKey: ['my-results'] });
    },
    'attendance:updated': () => {
      queryClient.invalidateQueries({ queryKey: ['my-attendance-dash'] });
    },
    'exam:published': () => {
      queryClient.invalidateQueries({ queryKey: ['student-exams-dash'] });
    },
  });

  const { data: studentRes } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => studentApi.getById('me').then(r => r.data),
    retry: false,
  });
  const student = studentRes?.data || studentRes;
  const studentId = student?.id || '';

  const { data: currentTermRes } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });
  const currentTerm = currentTermRes?.data;
  const termId = currentTerm?.id;

  const { data: resultsRes } = useQuery({
    queryKey: ['my-results', termId],
    queryFn: () => resultApi.getByStudent(studentId || 'me', termId || '').then(r => r.data?.data || r.data || []),
    enabled: !!termId,
    retry: false,
  });
  const currentResults = Array.isArray(resultsRes) ? resultsRes : [];

  const allTermResults = useMemo(() => {
    const map = new Map<string, any[]>();
    if (currentResults.length > 0) map.set(currentTerm?.name || 'Current Term', currentResults);
    return map;
  }, [currentResults, currentTerm]);

  const { data: attendanceRes } = useQuery({
    queryKey: ['my-attendance-dash', termId],
    queryFn: () => attendanceApi.getStudentSummary(studentId || 'me', { termId }).then(r => r.data),
    enabled: !!studentId,
    retry: false,
  });
  const attendance = attendanceRes?.data || attendanceRes;

  const { data: homeworkRes } = useQuery({
    queryKey: ['my-homework-dash', studentId],
    queryFn: () => homeworkApi.getByStudent(studentId).then(r => r.data?.data || r.data || []),
    enabled: !!studentId,
    retry: false,
  });
  const homework = Array.isArray(homeworkRes) ? homeworkRes : [];

  const { data: assessmentsRes } = useQuery({
    queryKey: ['my-assessments-dash', studentId, termId],
    queryFn: () => assessmentApi.getStudentAssessments(studentId, termId || '').then(r => r.data?.data || r.data || []),
    enabled: !!studentId && !!termId,
    retry: false,
  });
  const assessments = Array.isArray(assessmentsRes) ? assessmentsRes : [];

  const { data: notifsRes } = useQuery({
    queryKey: ['student-notifications'],
    queryFn: () => notificationsApi.getNotifications({ limit: 6 }).then(r => r.data).then(d => ({ notifications: d?.notifications || d?.data?.notifications || [], unread: d?.unreadCount ?? 0 })),
    retry: false,
  });
  const notifications = (notifsRes?.notifications || []) as NotificationItem[];

  const { data: availableExams } = useQuery({
    queryKey: ['student-exams-dash', termId],
    queryFn: () => examApi.getAll({ termId }).then(r => r.data?.data || r.data || []),
    enabled: !!termId,
    retry: false,
  });
  const exams = (Array.isArray(availableExams) ? availableExams : [])
    .filter((e: any) => e.isPublished && e.status !== 'ARCHIVED');

  const average = useMemo(() => {
    if (currentResults.length === 0) return 0;
    return currentResults.reduce((s, r: any) => s + (r.score || 0), 0) / currentResults.length;
  }, [currentResults]);

  const attendanceRate = useMemo(() => {
    if (attendance && typeof attendance === 'object' && !Array.isArray(attendance)) return attendance.attendanceRate ?? 0;
    const records = attendance && Array.isArray(attendance) ? attendance : [];
    if (records.length === 0) return 0;
    return Math.round((records.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length / records.length) * 100);
  }, [attendance]);

  const subjectScores = useMemo(
    () => [...currentResults]
      .sort((a: any, b: any) => (a.subject?.name || a.subject || '').localeCompare(b.subject?.name || b.subject || ''))
      .map((r: any) => ({ subject: r.subject?.name || r.subject || 'Subject', score: r.score || 0, grade: r.grade || getGrade(r.score || 0) })),
    [currentResults],
  );

  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = { A: 0, 'B+': 0, B: 0, 'B-': 0, 'C+': 0, C: 0, D: 0, E: 0, F: 0 };
    currentResults.forEach((r: any) => { const g = r.grade || getGrade(r.score || 0); if (counts[g] != null) counts[g]++; });
    return Object.entries(counts).filter(([, c]) => c > 0);
  }, [currentResults]);

  const upcomingHomework = useMemo(
    () => homework
      .filter((h: any) => new Date(h.dueDate) > new Date())
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4),
    [homework],
  );

  const attendanceStat = (key: string, label: string, color: string) => (
    <div className="text-center">
      <p className="text-xl font-bold text-gray-900">{attendance && !Array.isArray(attendance) ? attendance[key] ?? 0 : 0}</p>
      <p className={`text-xs ${color}`}>{label}</p>
    </div>
  );

  const feedItems = useMemo(() => {
    const items: { id: string; icon: string; title: string; detail: string; time: string; color: string; href: string }[] = [];
    upcomingHomework.forEach((h: any) => {
      items.push({
        id: `hw-${h.id}`,
        icon: '📚',
        title: h.title,
        detail: `${h.subject?.name || 'Homework'} due ${new Date(h.dueDate).toLocaleDateString()}`,
        time: 'Upcoming',
        color: 'bg-indigo-100 text-indigo-700',
        href: '/student/homework',
      });
    });
    exams.forEach((e: any) => {
      items.push({
        id: `exam-${e.id}`,
        icon: '📝',
        title: e.title,
        detail: `${e.subject?.name || 'Exam'} · ${e.duration || '?'} min · ends ${new Date(e.endsAt).toLocaleDateString()}`,
        time: new Date(e.endsAt).toLocaleDateString(),
        color: 'bg-purple-100 text-purple-700',
        href: '/student/exams',
      });
    });
    (notifications || []).forEach((n) => {
      items.push({
        id: n.id,
        icon: n.category === 'Attendance' ? '✅' : n.category === 'Finance' ? '💰' : n.category === 'AI Insights' ? '🤖' : '📢',
        title: n.title,
        detail: n.body,
        time: new Date(n.createdAt).toLocaleString(),
        color: n.isRead ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700',
        href: '/student/notifications',
      });
    });
    return items;
  }, [upcomingHomework, exams, notifications]);

  const subjectOption = useMemo(() => {
    if (subjectScores.length === 0) return null;
    return {
      grid: { left: '8%', right: '8%', bottom: '18%', top: '12%' },
      xAxis: {
        type: 'category',
        data: subjectScores.map(s => s.subject),
        axisLabel: { fontSize: 10, interval: 0, rotate: subjectScores.length > 5 ? 35 : 0 },
      },
      yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [{
        name: 'Score',
        type: 'bar',
        data: subjectScores.map(s => +s.score.toFixed(1)),
        barWidth: '55%',
        itemStyle: { color: (p: any) => gradeColor(p.value), borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top', fontSize: 10, formatter: (p: any) => p.value.toFixed(0) },
      }],
      tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
    };
  }, [subjectScores]);

  const gradeDistOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    color: GRADE_COLORS,
    series: [{
      name: 'Grades',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 12, formatter: '{b} ({c})' },
      data: gradeDistribution.map(([g, count]) => ({ name: g, value: count })),
    }],
  }), [gradeDistribution]);

  const termTrend = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    allTermResults.forEach((results, label) => {
      if (results.length > 0) {
        const avg = results.reduce((s, r: any) => s + (r.score || 0), 0) / results.length;
        out.push({ label, value: avg });
      }
    });
    return out;
  }, [allTermResults]);

  const trendOption = useMemo(() => ({
    grid: { left: '8%', right: '8%', bottom: '15%', top: '12%' },
    xAxis: { type: 'category', data: termTrend.map(t => t.label), axisLabel: { fontSize: 11, interval: 0 } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Average',
      type: 'line',
      data: termTrend.map(t => +t.value.toFixed(1)),
      smooth: true,
      symbolSize: 8,
      lineStyle: { color: '#6366f1', width: 3 },
      itemStyle: { color: '#6366f1' },
      areaStyle: { color: 'rgba(99,102,241,0.12)' },
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: any) => p.value.toFixed(1) },
    }],
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
  }), [termTrend]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {student?.firstName || user?.firstName || 'Student'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              {student?.class?.name || 'Student'} · {currentTerm?.name || 'Current Term'}
            </p>
          </div>
          {student?.photoUrl ? (
            <img src={student.photoUrl} alt="Student" className="w-14 h-14 rounded-full object-cover border-2 border-gray-200" />
          ) : (
            <span className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-2xl">👨‍🎓</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Average Score" value={average ? `${average.toFixed(1)}%` : '0%'} gradient="from-indigo-500 to-purple-600" icon="🎯" sub={currentTerm?.name || 'Current Term'} />
        <StatCard label="Subjects" value={String(new Set(subjectScores.map(s => s.subject)).size)} gradient="from-sky-500 to-blue-600" icon="📖" />
        <StatCard label="Attendance" value={`${attendanceRate}%`} gradient="from-emerald-500 to-green-600" icon="✅" sub="This term" />
        <StatCard label="Pending" value={String(upcomingHomework.length + exams.length)} gradient="from-amber-500 to-orange-600" icon="⏳" sub={`${upcomingHomework.length} homework · ${exams.length} exams`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <SectionCard title="Subject Performance" subtitle={currentTerm?.name || 'Current term'}>
          {subjectOption ? (
            <ReactECharts option={subjectOption} style={{ height: 320 }} notMerge lazyUpdate />
          ) : (
            <p className="text-center py-16 text-gray-400">No published results yet</p>
          )}
        </SectionCard>

        <SectionCard title="Grade Distribution" subtitle="Current term grades">
          {gradeDistribution.length > 0 ? (
            <ReactECharts option={gradeDistOption} style={{ height: 320 }} notMerge lazyUpdate />
          ) : (
            <p className="text-center py-16 text-gray-400">No grades yet</p>
          )}
        </SectionCard>

        <SectionCard title="Attendance Overview" subtitle="This term">
          <div className="flex justify-center gap-6 mt-2 flex-wrap">
            {attendanceStat('present', 'Present', 'text-green-600')}
            {attendanceStat('late', 'Late', 'text-yellow-600')}
            {attendanceStat('absent', 'Absent', 'text-red-600')}
            {attendanceStat('excused', 'Excused', 'text-purple-600')}
          </div>
          <div className="mt-6 text-center">
            <p className="text-4xl font-bold text-emerald-600">{attendanceRate}%</p>
            <p className="text-sm text-gray-500 mt-1">Attendance Rate</p>
            <Link href="/student/attendance" className="inline-block mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800">
              View Attendance →
            </Link>
          </div>
        </SectionCard>
      </div>

      {termTrend.length > 0 && (
        <div className="grid grid-cols-1 gap-6 mb-6">
          <SectionCard title="Performance Trend" subtitle="Average across terms">
            <ReactECharts option={trendOption} style={{ height: 280 }} notMerge lazyUpdate />
          </SectionCard>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SectionCard
          title="Live School Updates"
          subtitle="Homework, exams and school notices"
          action={<Link href="/student/homework" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View Homework →</Link>}
        >
          {feedItems.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No updates yet. Check back soon!</p>
          ) : (
            <div className="space-y-3">
              {feedItems.slice(0, 6).map(item => (
                <Link key={item.id} href={item.href} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/70 border border-gray-100 hover:border-indigo-200 transition-colors">
                  <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg ${item.color}`}>{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.detail}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Notifications & Alerts"
          subtitle="School announcements and reminders"
          action={<Link href="/student/notifications" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">View All →</Link>}
        >
          {notifications.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No notifications yet</p>
          ) : (
            <div className="space-y-3">
              {notifications.slice(0, 4).map(n => (
                <Link key={n.id} href="/student/notifications" className={`block p-3 rounded-xl border ${n.isRead ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-100'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-medium ${n.isRead ? 'text-gray-700' : 'text-blue-900'}`}>{n.title}</p>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.body}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                    <span className="text-[11px] font-medium text-indigo-500 px-1.5 py-0.5 bg-indigo-50 rounded-full">{n.category}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SectionCard title="Assessments Snapshot" subtitle="Recent continuous assessment scores">
          {assessments.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No assessment data yet</p>
          ) : (
            <div className="space-y-2">
              {assessments.slice(0, 6).map((a: any, i: number) => {
                const at = a.assessmentType || {};
                const pct = at.maxScore ? (a.score / at.maxScore) * 100 : null;
                return (
                  <div key={a.id || i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{at.name || 'Assessment'}</p>
                      <p className="text-xs text-gray-500">{at.termId ? `Score ${a.score}/${at.maxScore ?? '—'}` : 'Assessment'}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${pct == null ? 'bg-gray-100 text-gray-500' : pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {pct != null ? `${Math.round(pct)}%` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Upcoming Homework" subtitle="Due soon">
          {upcomingHomework.length === 0 ? (
            <p className="text-center py-12 text-gray-400">No upcoming homework — all caught up! 🎉</p>
          ) : (
            <div className="space-y-2">
              {upcomingHomework.map((h: any) => {
                const days = Math.ceil((new Date(h.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 border border-gray-100">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{h.title}</p>
                      <p className="text-xs text-gray-500">{h.subject?.name || 'Homework'}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${days <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                      {days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Quick Access" subtitle="Everything you need, one click away">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/student/ai-tutor" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white text-center hover:shadow-lg transition-shadow">
            <span className="text-3xl">🤖</span>
            <p className="font-medium text-sm">AI Tutor</p>
            <p className="text-xs text-indigo-200">Learn any subject & get help</p>
          </Link>
          <Link href="/student/library" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white text-center hover:shadow-lg transition-shadow">
            <span className="text-3xl">📚</span>
            <p className="font-medium text-sm">Library</p>
            <p className="text-xs text-sky-200">Browse learning resources</p>
          </Link>
          <Link href="/student/results" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 text-center hover:border-indigo-300 transition-colors">
            <span className="text-3xl">📝</span>
            <p className="font-medium text-sm text-gray-800">Results</p>
            <p className="text-xs text-gray-400">View published results</p>
          </Link>
          <Link href="/student/exams" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 text-center hover:border-indigo-300 transition-colors">
            <span className="text-3xl">📋</span>
            <p className="font-medium text-sm text-gray-800">Exams</p>
            <p className="text-xs text-gray-400">Take online exams</p>
          </Link>
          <Link href="/student/homework" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 text-center hover:border-indigo-300 transition-colors">
            <span className="text-3xl">📚</span>
            <p className="font-medium text-sm text-gray-800">Homework</p>
            <p className="text-xs text-gray-400">View & submit</p>
          </Link>
          <Link href="/student/attendance" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 text-center hover:border-indigo-300 transition-colors">
            <span className="text-3xl">✅</span>
            <p className="font-medium text-sm text-gray-800">Attendance</p>
            <p className="text-xs text-gray-400">Track your record</p>
          </Link>
          <Link href="/student/report-cards" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 text-center hover:border-indigo-300 transition-colors">
            <span className="text-3xl">📄</span>
            <p className="font-medium text-sm text-gray-800">Report Cards</p>
            <p className="text-xs text-gray-400">Download & print</p>
          </Link>
          <Link href="/student/assessments" className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-gray-200 text-center hover:border-indigo-300 transition-colors">
            <span className="text-3xl">📊</span>
            <p className="font-medium text-sm text-gray-800">Assessments</p>
            <p className="text-xs text-gray-400">View assessment scores</p>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
