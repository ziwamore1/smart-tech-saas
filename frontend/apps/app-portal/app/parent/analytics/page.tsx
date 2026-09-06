'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { parentApi, termApi, academicYearApi, intelligenceApi } from '@/lib/api';

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
  subjectRank?: number;
}

interface ChildInfo {
  id: string;
  firstName: string;
  lastName: string;
  class?: string;
  attendancePercentage?: number;
}

function getGrade(score: number): string {
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function scoreColor(score: number): string {
  if (score >= 75) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function ParentAnalytics() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const { data: childrenData } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList = (Array.isArray(childrenData) ? childrenData : []) as ChildInfo[];
  const activeChildId = selectedChildId || childrenList[0]?.id || '';
  const activeChild = childrenList.find(c => c.id === activeChildId);

  const { data: termData } = useQuery({
    queryKey: ['current-term-analytics'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });
  const currentTermId = termData?.data?.id;

  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years-analytics'],
    queryFn: () => academicYearApi.getAll().then(r => r.data?.data || r.data || []),
    retry: false,
  });
  const academicYears = Array.isArray(academicYearsData) ? academicYearsData as any[] : [];
  const yearName = (id: string) => academicYears.find((a: any) => a.id === id)?.name || '';

  const { data: allResults = [] } = useQuery<ParentResult[]>({
    queryKey: ['parent-child-analytics-results', activeChildId],
    queryFn: () => activeChildId
      ? parentApi.getResults(activeChildId).then(r => r.data?.data || r.data || [])
      : Promise.resolve([]),
    enabled: !!activeChildId,
    retry: false,
  });

  const { data: allChildrenResults } = useQuery({
    queryKey: ['parent-all-children-analytics'],
    queryFn: () => parentApi.getAllChildrenResults().then(r => r.data),
    retry: false,
  });

  const { data: growth, isError: growthError } = useQuery({
    queryKey: ['parent-growth', activeChildId],
    queryFn: () => activeChildId
      ? intelligenceApi.getStudentGrowthTrajectory(activeChildId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!activeChildId,
    retry: false,
  });

  const { data: recommendations, isError: recError } = useQuery({
    queryKey: ['parent-recommendations', activeChildId, currentTermId],
    queryFn: () => (activeChildId && currentTermId)
      ? intelligenceApi.getStudentRecommendations(activeChildId, currentTermId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!activeChildId && !!currentTermId,
    retry: false,
  });

  const currentTermResults = useMemo(() => {
    if (!currentTermId || !activeChildId) return [];
    const childData = (allChildrenResults?.children || []).find(
      (cd: any) => cd.child.id === activeChildId,
    );
    return childData?.results || [];
  }, [allChildrenResults, activeChildId, currentTermId]);

  const heatmap = useMemo(() => {
    if (allResults.length === 0) return null;
    const subjects = [...new Set(allResults.map(r => r.subject))];
    const termLabels = [...new Set(allResults.map(r => {
      const y = yearName(r.academicYear);
      return y ? `${r.term} · ${y}` : r.term;
    }))];
    const values: number[][] = Array.from({ length: subjects.length }, () => Array(termLabels.length).fill(-1));
    allResults.forEach(r => {
      const si = subjects.indexOf(r.subject);
      const label = yearName(r.academicYear) ? `${r.term} · ${yearName(r.academicYear)}` : r.term;
      const ti = termLabels.indexOf(label);
      if (si >= 0 && ti >= 0) values[si][ti] = r.score;
    });
    return { subjects, termLabels, values };
  }, [allResults, academicYears]);

  const termTrend = useMemo(() => {
    const map = new Map<string, number[]>();
    allResults.forEach(r => {
      const label = `${r.term}${yearName(r.academicYear) ? ' (' + yearName(r.academicYear) + ')' : ''}`;
      const arr = map.get(label) || [];
      arr.push(r.score);
      map.set(label, arr);
    });
    return [...map.entries()].map(([label, scores]) => ({
      label,
      avg: scores.reduce((s, v) => s + v, 0) / scores.length,
    }));
  }, [allResults, academicYears]);

  const overallAverage = useMemo(
    () => currentTermResults.length > 0
      ? currentTermResults.reduce((s: number, r: any) => s + r.score, 0) / currentTermResults.length
      : 0,
    [currentTermResults],
  );

  const gradeDist = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    currentTermResults.forEach((r: any) => { counts[getGrade(r.score)]++; });
    return Object.entries(counts).filter(([, c]) => c > 0);
  }, [currentTermResults]);

  const subjectBars = useMemo(
    () => [...currentTermResults]
      .sort((a, b) => a.subject.localeCompare(b.subject))
      .map((r: any) => ({ subject: r.subject, score: r.score })),
    [currentTermResults],
  );

  const childrenComparison = useMemo(() => {
    const childData = (allChildrenResults?.children || []) as any[];
    return childData.map((cd: any) => ({
      name: `${cd.child.firstName} ${cd.child.lastName}`.trim(),
      avg: cd.results.length > 0
        ? cd.results.reduce((s: number, r: any) => s + r.score, 0) / cd.results.length
        : 0,
    }));
  }, [allChildrenResults]);

  const comparisonOption = {
    grid: { left: '8%', right: '8%', bottom: '18%', top: '14%' },
    xAxis: { type: 'category', data: childrenComparison.map(c => c.name), axisLabel: { fontSize: 11, rotate: childrenComparison.length > 3 ? 18 : 0, interval: 0 } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Overall Average',
      type: 'bar',
      data: childrenComparison.map(c => +c.avg.toFixed(1)),
      barWidth: 44,
      itemStyle: {
        color: (p: any) => ['#6366f1', '#ec4899', '#0ea5e9', '#f59e0b'][p.dataIndex % 4],
        borderRadius: [8, 8, 0, 0],
      },
      label: { show: true, position: 'top', fontSize: 11, formatter: (p: any) => p.value.toFixed(1) },
    }],
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
  };

  const subjectOption = {
    grid: { left: '8%', right: '8%', bottom: '20%', top: '10%' },
    xAxis: { type: 'category', data: subjectBars.map(s => s.subject), axisLabel: { fontSize: 10, interval: 0, rotate: subjectBars.length > 5 ? 35 : 0 } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Score',
      type: 'bar',
      data: subjectBars.map(s => +s.score.toFixed(1)),
      barWidth: '55%',
      itemStyle: { color: (p: any) => scoreColor(p.value), borderRadius: [6, 6, 0, 0] },
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: any) => p.value.toFixed(0) },
    }],
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
  };

  const pieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    color: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'],
    series: [{
      name: 'Grades',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 11, formatter: '{b} ({c})' },
      data: gradeDist.map(([g, c]) => ({ name: g, value: c })),
    }],
  };

  const heatmapOption = heatmap ? {
    grid: { left: '10%', right: '4%', bottom: '20%', top: '8%' },
    xAxis: { type: 'category', data: heatmap.termLabels, splitArea: { show: true }, axisLabel: { rotate: 35, fontSize: 10, width: 100, overflow: 'truncate' } },
    yAxis: { type: 'category', data: heatmap.subjects, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
    visualMap: {
      min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: '1%',
      inRange: { color: ['#fee2e2', '#fca5a5', '#fbbf24', '#34d399', '#059669'] },
      formatter: (v: any) => `${v}%`,
    },
    series: [{
      type: 'heatmap',
      data: heatmap.subjects.flatMap((s, si) => heatmap.termLabels.map((_, ti) => {
        const v = heatmap!.values[si][ti];
        return [ti, si, v === -1 ? null : v];
      })),
      label: {
        show: true,
        fontSize: 9,
        formatter: (p: any) => (p.value[2] === null ? '·' : (p.value[2] as number).toFixed(0)),
      },
    }],
    tooltip: {
      formatter: (p: any) => {
        if (p.data?.[2] === null || p.data?.[2] === undefined) {
          return `<strong>${heatmap!.subjects[p.data[1]]}</strong> — ${heatmap!.termLabels[p.data[0]]}<br/><span style="color:#9ca3af">No result</span>`;
        }
        return `<strong>${heatmap!.subjects[p.data[1]]}</strong> — ${heatmap!.termLabels[p.data[0]]}: <b>${(p.data[2] as number).toFixed(1)}%</b>`;
      },
    },
  } : null;

  const trendOption = {
    grid: { left: '8%', right: '8%', bottom: '18%', top: '10%' },
    xAxis: { type: 'category', data: termTrend.map(t => t.label), axisLabel: { fontSize: 10, interval: 0, rotate: termTrend.length > 3 ? 30 : 0 } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Overall Average',
      type: 'line',
      data: termTrend.map(t => +t.avg.toFixed(1)),
      smooth: true,
      symbolSize: 8,
      lineStyle: { color: '#6366f1', width: 3 },
      itemStyle: { color: '#6366f1' },
      areaStyle: { color: 'rgba(99,102,241,0.12)' },
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: any) => p.value.toFixed(1) },
    }],
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
  };

  const growthPoints = useMemo(() => {
    if (growthError || !growth?.terms || growth.terms.length === 0) return [];
    return growth.terms.map((t: any) => ({ label: t.termName, value: t.average }));
  }, [growth, growthError]);

  const growthOption = growthPoints.length > 0 ? {
    grid: { left: '8%', right: '8%', bottom: '18%', top: '10%' },
    xAxis: { type: 'category', data: growthPoints.map(p => p.label), axisLabel: { fontSize: 10, interval: 0, rotate: growthPoints.length > 3 ? 30 : 0 } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Average',
      type: 'line',
      data: growthPoints.map(p => +p.value.toFixed(1)),
      smooth: true,
      symbolSize: 8,
      lineStyle: { color: '#10b981', width: 3 },
      itemStyle: { color: '#10b981' },
      areaStyle: { color: 'rgba(16,185,129,0.12)' },
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: any) => p.value.toFixed(1) },
      markLine: growth.direction ? {
        data: [{ type: 'average', name: 'Average' }],
        lineStyle: { color: '#6366f1', type: 'dashed' },
      } : undefined,
    }],
  } : null;

  const recList = (recommendations?.recommendations || []).slice(0, 5) as any[];

  return (
    <div className="px-4 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
        <p className="text-gray-500">Detailed academic analytics for your children</p>
      </div>

      {childrenList.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-600 mb-3">Select a child</p>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
            {childrenList.map((c: ChildInfo) => (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl text-left transition-all border-2 ${
                  activeChildId === c.id
                    ? 'bg-indigo-50 border-indigo-500'
                    : 'bg-gray-50 border-transparent hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                <p className={`font-semibold text-sm ${activeChildId === c.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{c.class || 'Not assigned'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {childrenComparison.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">📊</span>
          <p className="text-gray-500 mt-4">No analytics data available yet</p>
          <p className="text-xs text-gray-400 mt-2">Analytics will appear once results are published.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className={`text-3xl font-bold ${overallAverage >= 75 ? 'text-emerald-600' : overallAverage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{overallAverage.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">Current Term Average</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className="text-3xl font-bold text-indigo-600">{currentTermResults.length}</p>
              <p className="text-xs text-gray-500 mt-1">Subjects Tracked</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{allResults.length}</p>
              <p className="text-xs text-gray-500 mt-1">Results (All Terms)</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className="text-3xl font-bold text-emerald-600">{activeChild?.attendancePercentage ?? '—'}%</p>
              <p className="text-xs text-gray-500 mt-1">Attendance</p>
            </div>
          </div>

          {childrenComparison.length > 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Children Comparison</h2>
                <p className="text-sm text-gray-500">Overall average per child</p>
              </div>
              <div className="p-5">
                <ReactECharts option={comparisonOption} style={{ height: 320 }} notMerge lazyUpdate />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Subject Performance</h2>
                <p className="text-sm text-gray-500">{activeChild?.firstName} {activeChild?.lastName}</p>
              </div>
              <div className="p-5">
                {subjectBars.length > 0 ? (
                  <ReactECharts option={subjectOption} style={{ height: 260 }} notMerge lazyUpdate />
                ) : (
                  <p className="text-center py-12 text-gray-400">No published results</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Grade Distribution</h2>
                <p className="text-sm text-gray-500">Grades for this term</p>
              </div>
              <div className="p-5">
                {gradeDist.length > 0 ? (
                  <ReactECharts option={pieOption} style={{ height: 260 }} notMerge lazyUpdate />
                ) : (
                  <p className="text-center py-12 text-gray-400">No grades yet</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Performance Summary</h2>
                <p className="text-sm text-gray-500">Strengths & areas to improve</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-700 mb-2">💪 Strengths (≥75%)</h3>
                  {currentTermResults.filter((r: any) => r.score >= 75).length === 0 ? (
                    <p className="text-xs text-gray-400">None yet</p>
                  ) : (
                    currentTermResults.filter((r: any) => r.score >= 75).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{r.subject}</span>
                        <span className="text-sm font-semibold text-emerald-600">{r.score.toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">🎯 Needs Support (&lt;50%)</h3>
                  {currentTermResults.filter((r: any) => r.score < 50).length === 0 ? (
                    <p className="text-xs text-emerald-600">All subjects above 50% — great job!</p>
                  ) : (
                    currentTermResults.filter((r: any) => r.score < 50).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{r.subject}</span>
                        <span className="text-sm font-semibold text-red-600">{r.score.toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {allResults.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Term-by-Term Trend</h2>
                  <p className="text-sm text-gray-500">Performance across terms & academic years</p>
                </div>
                <div className="p-5">
                  <ReactECharts option={trendOption} style={{ height: 280 }} notMerge lazyUpdate />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Subject × Term Heatmap</h2>
                  <p className="text-sm text-gray-500">Subject scores across all published terms</p>
                </div>
                <div className="p-5">
                  {heatmapOption ? (
                    <ReactECharts option={heatmapOption} style={{ height: 280 }} notMerge lazyUpdate />
                  ) : (
                    <p className="text-center py-12 text-gray-400">No heatmap data yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {growthPoints.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Growth Trajectory</h2>
                <p className="text-sm text-gray-500">Smart analytics trend for {activeChild?.firstName} {activeChild?.lastName}</p>
              </div>
              <div className="p-5">
                <ReactECharts option={growthOption} style={{ height: 280 }} notMerge lazyUpdate />
              </div>
            </div>
          )}

          {!recError && recList.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Smart Recommendations</h2>
                <p className="text-sm text-gray-500">Personalised suggestions to help your child improve</p>
              </div>
              <div className="divide-y divide-gray-50">
                {recList.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-4">
                    <span className={`shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${r.priority === 'CRITICAL' ? 'bg-red-500' : r.priority === 'HIGH' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                      {r.priority?.[0] || 'i'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.issue || r.category}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{r.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}