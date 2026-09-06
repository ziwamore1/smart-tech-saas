'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '@/lib/auth-context';
import { parentApi, termApi, schoolApi, notificationsApi, messagesApi } from '@/lib/api';

interface ChildResult {
  child: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    className?: string;
    class?: string;
  };
  results: {
    id: string;
    subject: string;
    term: string;
    academicYear: string;
    score: number;
    grade: string;
    remark: string;
  }[];
}

interface AllChildrenResults {
  term: string | null;
  academicYear: string | null;
  children: ChildResult[];
}

interface ChildInfo {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className?: string;
  class?: string;
  classTeacher?: { userId: string; name: string } | null;
  attendancePercentage?: number;
  upcomingActivity?: { type: string; title: string; subject: string; dueDate: string } | null;
  photoUrl?: string | null;
}

interface ParentResult {
  id: string;
  subject: string;
  term: string;
  academicYear: string;
  score: number;
  grade: string;
  remark?: string;
  points?: number;
  gpa?: number;
  classRank?: number;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

function getGrade(score: number): string {
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function getScoreColor(score: number): string {
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

export default function ParentDashboard() {
  const { user } = useAuth();
  const [selectedChild, setSelectedChild] = useState<string>('');

  const { data: termData } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const { data: allData, isLoading: allLoading } = useQuery<AllChildrenResults>({
    queryKey: ['parent-all-children-results'],
    queryFn: () => parentApi.getAllChildrenResults().then(r => r.data),
    retry: false,
  });

  const { data: childrenData } = useQuery({
    queryKey: ['parent-children-dashboard'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
    retry: false,
  });

  const { data: school } = useQuery({
    queryKey: ['school-current-parent'],
    queryFn: () => schoolApi.getCurrentSchool().then(r => r.data),
    retry: false,
  });

  const { data: notifsData } = useQuery({
    queryKey: ['parent-notifications'],
    queryFn: () => notificationsApi.getNotifications({ limit: 6 }).then(r => r.data).then(d => ({ notifications: d?.notifications || d?.data?.notifications || [], unread: d?.unreadCount ?? 0 })),
    retry: false,
  });

  const { data: unreadMsgs } = useQuery({
    queryKey: ['parent-unread-messages'],
    queryFn: () => messagesApi.getUnreadCount().then(r => r.data?.unreadCount ?? 0),
    retry: false,
  });

  const children = (Array.isArray(childrenData) ? childrenData : []) as ChildInfo[];
  const resultsChildren = allData?.children || [];
  const termName = termData?.data?.name || allData?.term || 'Current Term';
  const currentChild = children.find(c => c.id === selectedChild) || children[0];
  const activeChildId = currentChild?.id || '';
  const institutionType = school?.institutionType?.name || school?.institutionType?.code || null;

  const { data: selectedChildResults, isLoading: resultsLoading } = useQuery<ParentResult[]>({
    queryKey: ['parent-child-all-term-results', activeChildId],
    queryFn: () => activeChildId
      ? parentApi.getResults(activeChildId).then(r => r.data?.data || r.data || [])
      : Promise.resolve([]),
    enabled: !!activeChildId,
    retry: false,
  });

  const currentChildResults = useMemo(() => {
    const childData = resultsChildren.find(c => c.child.id === activeChildId);
    return childData?.results || [];
  }, [resultsChildren, activeChildId]);

  const allSubjectNames = useMemo(
    () => [...new Set(resultsChildren.flatMap(c => c.results.map(r => r.subject)))],
    [resultsChildren],
  );

  const overallAverage = useMemo(() => {
    const all = resultsChildren.flatMap(c => c.results);
    if (all.length === 0) return 0;
    return all.reduce((s, r) => s + r.score, 0) / all.length;
  }, [resultsChildren]);

  const avgAttendance = useMemo(() => {
    if (children.length === 0) return 0;
    return Math.round(children.reduce((s: number, c) => s + (c.attendancePercentage ?? 0), 0) / children.length);
  }, [children]);

  const childAverages = useMemo(
    () => resultsChildren.map(cd => ({
      name: `${cd.child.firstName} ${cd.child.lastName}`.trim(),
      avg: cd.results.length > 0
        ? cd.results.reduce((s, r) => s + r.score, 0) / cd.results.length
        : 0,
    })),
    [resultsChildren],
  );

  const subjectScores = useMemo(
    () => [...currentChildResults]
      .sort((a, b) => a.subject.localeCompare(b.subject))
      .map(r => ({ subject: r.subject, score: r.score })),
    [currentChildResults],
  );

  const gradeDistribution = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    currentChildResults.forEach(r => { counts[getGrade(r.score)]++; });
    return Object.entries(counts).filter(([, c]) => c > 0);
  }, [currentChildResults]);

  const heatmap = useMemo(() => {
    const results = selectedChildResults || [];
    if (results.length === 0) return null;
    const subjects = [...new Set(results.map(r => r.subject))];
    const terms = [...new Set(results.map(r => `${r.term}${r.academicYear ? ' · ' + r.academicYear : ''}`))];
    const values: number[][] = Array.from({ length: subjects.length }, () => Array(terms.length).fill(-1));
    results.forEach(r => {
      const si = subjects.indexOf(r.subject);
      const ti = terms.indexOf(`${r.term}${r.academicYear ? ' · ' + r.academicYear : ''}`);
      if (si >= 0 && ti >= 0) values[si][ti] = r.score;
    });
    return { subjects, terms, values };
  }, [selectedChildResults]);

  const termTrend = useMemo(() => {
    const results = selectedChildResults || [];
    if (results.length === 0) return [];
    const map = new Map<string, { total: number; count: number }>();
    results.forEach(r => {
      const label = `${r.term}${r.academicYear ? ' (' + r.academicYear + ')' : ''}`;
      const cur = map.get(label) || { total: 0, count: 0 };
      cur.total += r.score;
      cur.count += 1;
      map.set(label, cur);
    });
    return [...map.entries()].map(([label, v]) => ({ label, value: v.total / v.count }));
  }, [selectedChildResults]);

  const comparisonOption = useMemo(() => ({
    grid: { left: '8%', right: '8%', bottom: '15%', top: '12%' },
    xAxis: {
      type: 'category',
      data: childAverages.map(c => c.name),
      axisLabel: { fontSize: 11, interval: 0, rotate: childAverages.length > 3 ? 18 : 0 },
    },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Average',
      type: 'bar',
      data: childAverages.map(c => +c.avg.toFixed(1)),
      barWidth: 44,
      itemStyle: {
        color: (p: any) => {
          const colors = ['#6366f1', '#ec4899', '#0ea5e9', '#f59e0b'];
          return colors[p.dataIndex % colors.length];
        },
        borderRadius: [8, 8, 0, 0],
      },
      label: { show: true, position: 'top', fontSize: 11, formatter: (p: any) => p.value.toFixed(1) },
    }],
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
  }), [childAverages]);

  const subjectOption = useMemo(() => ({
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
      itemStyle: {
        color: (p: any) => getScoreColor(p.value),
        borderRadius: [6, 6, 0, 0],
      },
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: any) => p.value.toFixed(0) },
    }],
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
  }), [subjectScores]);

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

  const trendOption = useMemo(() => ({
    grid: { left: '8%', right: '8%', bottom: '15%', top: '12%' },
    xAxis: {
      type: 'category',
      data: termTrend.map(t => t.label),
      axisLabel: { fontSize: 10, interval: 0, rotate: termTrend.length > 3 ? 30 : 0 },
    },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Overall Average',
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

  const heatmapOption = useMemo(() => {
    if (!heatmap) return null;
    const data: [number, number, number][] = [];
    heatmap.subjects.forEach((s, si) => {
      heatmap.terms.forEach((_, ti) => {
        const v = heatmap!.values[si][ti];
        data.push([ti, si, v === -1 ? null : v]);
      });
    });
    return {
      grid: { left: '10%', right: '4%', bottom: '18%', top: '8%' },
      xAxis: {
        type: 'category',
        data: heatmap.terms,
        splitArea: { show: true },
        axisLabel: { rotate: 35, fontSize: 10, width: 100, overflow: 'truncate' },
      },
      yAxis: { type: 'category', data: heatmap.subjects, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '1%',
        inRange: { color: ['#fee2e2', '#fca5a5', '#fbbf24', '#34d399', '#059669'] },
        formatter: (v: any) => `${v}%`,
      },
      series: [{
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontSize: 9,
          formatter: (p: any) => (p.value[2] === null ? '·' : (p.value[2] as number).toFixed(0)),
        },
      }],
      tooltip: {
        formatter: (p: any) => {
          if (p.data?.[2] === null || p.data?.[2] === undefined) return `<strong>${heatmap!.subjects[p.data[1]]}</strong> — ${heatmap!.terms[p.data[0]]}<br/><span style="color:#9ca3af">No result</span>`;
          return `<strong>${heatmap!.subjects[p.data[1]]}</strong> — ${heatmap!.terms[p.data[0]]}: <b>${(p.data[2] as number).toFixed(1)}%</b>`;
        },
      },
    };
  }, [heatmap]);

  const notifications = (notifsData?.notifications || []) as NotificationItem[];

  const feedItems = useMemo(() => {
    const items: { id: string; icon: string; title: string; detail: string; time: string; color: string }[] = [];
    children.forEach(c => {
      if (c.upcomingActivity?.title) {
        items.push({
          id: `hw-${c.id}`,
          icon: '📚',
          title: `${c.firstName}: ${c.upcomingActivity.title}`,
          detail: `${c.upcomingActivity.subject || 'Homework'} due ${new Date(c.upcomingActivity.dueDate).toLocaleDateString()}`,
          time: 'Upcoming',
          color: 'bg-indigo-100 text-indigo-700',
        });
      }
    });
    notifications.forEach(n => {
      items.push({
        id: n.id,
        icon: n.category === 'Attendance' ? '✅' : n.category === 'Finance' ? '💰' : n.category === 'AI Insights' ? '🤖' : '📢',
        title: n.title,
        detail: n.body,
        time: new Date(n.createdAt).toLocaleString(),
        color: n.isRead ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700',
      });
    });
    return items.sort((a, b) => (a.time === 'Upcoming' ? 1 : 0) - (b.time === 'Upcoming' ? 1 : 0));
  }, [children, notifications]);

  const loading = allLoading || (activeChildId && resultsLoading);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome, {user?.firstName || 'Parent'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              {school?.name || 'Smart Tech'} · {termName}
            </p>
          </div>
          {institutionType && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm">
              <span>🏫</span> {institutionType}
            </span>
          )}
        </div>

        {(allData?.academicYear || allData?.term) && (
          <p className="text-sm text-gray-500 mt-2">
            Results shown for {allData?.term || 'current term'}{allData?.academicYear ? ` · Academic Year: ${allData.academicYear}` : ''}
          </p>
        )}
      </div>

      {loading && children.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Loading your children&apos;s data...</div>
      ) : children.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-6xl">👨‍👩‍👧</span>
          <h2 className="text-xl font-semibold text-gray-700 mt-4 mb-2">No children linked yet</h2>
          <p className="text-gray-500">Contact your school to link your children to this parent account.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Children" value={String(children.length)} gradient="from-indigo-500 to-purple-600" icon="👨‍👩‍👧" />
            <StatCard label="Approved Subjects" value={resultsChildren.flatMap(c => c.results).length === 0 ? '0' : String(new Set(resultsChildren.flatMap(c => c.results.map(r => r.subject))).size)} gradient="from-sky-500 to-blue-600" icon="📖" />
            <StatCard label="Overall Average" value={`${overallAverage.toFixed(1)}%`} gradient="from-emerald-500 to-green-600" icon="🎯" />
            <StatCard label="Attendance Rate" value={`${avgAttendance}%`} gradient="from-amber-500 to-orange-600" icon="✅" />
          </div>

          {children.length > 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
              <p className="text-sm font-medium text-gray-600 mb-3">Select a child to compare details</p>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
                {children.map(c => {
                  const active = c.id === activeChildId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedChild(c.id)}
                      className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl text-left transition-all duration-150 border-2 ${
                        active
                          ? 'bg-indigo-50 border-indigo-500 shadow-sm scale-[1.02]'
                          : 'bg-gray-50 border-transparent hover:border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${active ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.class || 'Not assigned'}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <SectionCard title="Children Comparison" subtitle="Overall average per child (current term)">
              {childAverages.length > 0 ? (
                <ReactECharts option={comparisonOption} style={{ height: 320 }} notMerge lazyUpdate />
              ) : (
                <p className="text-center py-16 text-gray-400">No published results yet</p>
              )}
            </SectionCard>

            <SectionCard
              title="Subject Performance"
              subtitle={currentChild ? `${currentChild.firstName} ${currentChild.lastName} · ${termName}` : 'Select a child'}
            >
              {subjectScores.length > 0 ? (
                <ReactECharts option={subjectOption} style={{ height: 320 }} notMerge lazyUpdate />
              ) : (
                <p className="text-center py-16 text-gray-400">No published results yet</p>
              )}
            </SectionCard>

            <SectionCard title="Grade Distribution" subtitle={currentChild ? `${currentChild.firstName} ${currentChild.lastName} · ${termName}` : 'Grade breakdown'}>
              {gradeDistribution.length > 0 ? (
                <ReactECharts option={gradeDistOption} style={{ height: 320 }} notMerge lazyUpdate />
              ) : (
                <p className="text-center py-16 text-gray-400">No grades yet</p>
              )}
            </SectionCard>
          </div>

          {selectedChildResults && selectedChildResults.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SectionCard
                title="Term-by-Term Performance Trend"
                subtitle={`${currentChild?.firstName || ''} ${currentChild?.lastName || ''} across terms & academic years`}
              >
                {termTrend.length > 0 ? (
                  <ReactECharts option={trendOption} style={{ height: 320 }} notMerge lazyUpdate />
                ) : (
                  <p className="text-center py-16 text-gray-400">No trend data yet</p>
                )}
              </SectionCard>

              <SectionCard
                title="Subject × Term Heatmap"
                subtitle="Scores per subject across published terms"
              >
                {heatmap ? (
                  <ReactECharts option={heatmapOption} style={{ height: 320 }} notMerge lazyUpdate />
                ) : (
                  <p className="text-center py-16 text-gray-400">No heatmap data yet</p>
                )}
              </SectionCard>
            </div>
          )}

          {children.length > 1 && subjectScores.length > 0 && (
            <SectionCard title="Subject Comparison — All Children" subtitle="Scores for each subject across all children">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 pr-4 font-semibold text-gray-700 text-sm">Subject</th>
                      {resultsChildren.map(cd => (
                        <th key={cd.child.id} className="text-center py-3 px-3 font-semibold text-gray-700 text-sm min-w-[120px]">
                          <div>{cd.child.firstName}</div>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200">
                            {cd.child.className || cd.child.class || '—'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allSubjectNames.map((subject, idx) => (
                      <tr key={subject} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{subject}</td>
                        {resultsChildren.map(cd => {
                          const result = cd.results.find(r => r.subject === subject);
                          return (
                            <td key={cd.child.id} className="py-3 px-3 text-center">
                              {result ? (
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-800">
                                    {result.score.toFixed(1)}% · {result.grade}
                                  </span>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden max-w-[90px]">
                                    <div className={`h-full rounded-full ${getScoreColor(result.score)}`} style={{ width: `${Math.min(result.score, 100)}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard
              title="Live School Updates"
              subtitle="Latest activities, results and notices"
              action={
                <Link href="/parent/messages" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                  View Messages {unreadMsgs ? `· ${unreadMsgs} unread` : ''} →
                </Link>
              }
            >
              {feedItems.length === 0 ? (
                <p className="text-center py-12 text-gray-400">No updates yet. Check back soon!</p>
              ) : (
                <div className="space-y-3">
                  {feedItems.slice(0, 6).map(item => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/70 border border-gray-100">
                      <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg ${item.color}`}>{item.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.detail}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Notifications & Alerts"
              subtitle="School announcements and reminders"
              action={
                <Link href="/parent/notifications" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                  View All →
                </Link>
              }
            >
              {notifications.length === 0 ? (
                <p className="text-center py-12 text-gray-400">No notifications yet</p>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 4).map(n => (
                    <div key={n.id} className={`p-3 rounded-xl border ${n.isRead ? 'bg-gray-50 border-gray-100' : 'bg-blue-50 border-blue-100'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium ${n.isRead ? 'text-gray-700' : 'text-blue-900'}`}>{n.title}</p>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.body}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                        <span className="text-[11px] font-medium text-indigo-500 px-1.5 py-0.5 bg-indigo-50 rounded-full">{n.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="mt-6 flex gap-3 flex-wrap">
            <Link href="/parent/results" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all">
              📝 Results
            </Link>
            <Link href="/parent/homework" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all">
              📚 Homework
            </Link>
            <Link href="/parent/report-cards" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all">
              📄 Report Cards
            </Link>
            <Link href="/parent/attendance" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all">
              ✅ Attendance
            </Link>
            <Link href="/parent/assessments" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all">
              📊 Assessments
            </Link>
            <Link href="/parent/analytics" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all">
              📈 Analytics
            </Link>
            <Link href="/parent/messages" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all">
              💬 Messages {unreadMsgs ? `(${unreadMsgs})` : ''}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}