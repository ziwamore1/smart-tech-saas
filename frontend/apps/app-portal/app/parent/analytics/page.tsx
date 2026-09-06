'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { parentApi, termApi, intelligenceApi } from '@/lib/api';

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

function trendBadge(trend?: string) {
  if (trend === 'improving') return { label: '📈 Improving', className: 'bg-emerald-100 text-emerald-700' };
  if (trend === 'declining') return { label: '📉 Declining', className: 'bg-red-100 text-red-700' };
  return { label: '➖ Stable', className: 'bg-gray-100 text-gray-600' };
}

function weaknessColor(score: number): string {
  if (score < 40) return 'text-red-600 bg-red-50 border-red-200';
  if (score < 50) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-yellow-700 bg-yellow-50 border-yellow-200';
}

function percentilePhrase(p?: number): string {
  if (p == null) return '';
  if (p >= 90) return `performs better than ${Math.round(p)}% of the class — that is outstanding work`;
  if (p >= 75) return `performs better than ${Math.round(p)}% of the class — strong, above-average performance`;
  if (p >= 50) return `performs better than ${Math.round(p)}% of the class — right around the class middle`;
  if (p >= 25) return `performs better than ${Math.round(p)}% of the class — a little below the class average`;
  return `performs better than only ${Math.round(p)}% of the class — well below the class average`;
}

function zScorePhrase(z?: number): string {
  if (z == null) return '';
  if (z >= 1) return `is scoring well above the school average for this term`;
  if (z >= 0.3) return `is scoring above the school average`;
  if (z > -0.3) return `is performing right in line with the school average`;
  if (z > -1) return `is scoring slightly below the school average`;
  return `is scoring well below the school average right now`;
}

function consistencyPhrase(sd?: number): string {
  if (sd == null) return '';
  if (sd < 6) return `very consistent — results stay close together across subjects`;
  if (sd < 12) return `steady overall, with a few naturally stronger or weaker subjects`;
  return `uneven — some subjects are much stronger than others, worth a closer look`;
}

function trendPhrase(direction?: string, slope?: number): string {
  if (direction === 'improving') return `showing a clear upward trend — keep encouraging the hard work`;
  if (direction === 'declining') return `scores have been trending downward — early support now will help turn it around`;
  if (direction === 'volatile') return `performance has swung between terms — steady study habits may help`;
  return `staying steady across terms, which is a solid foundation`;
}

function bandOf(avg: number) {
  if (avg >= 80) return { label: 'Excellent', tone: 'text-emerald-700 bg-emerald-100 border-emerald-200', icon: '🏆', blurb: 'Consistently strong across subjects.' };
  if (avg >= 70) return { label: 'Strong', tone: 'text-blue-700 bg-blue-100 border-blue-200', icon: '💪', blurb: 'Solid overall performance.' };
  if (avg >= 60) return { label: 'Good', tone: 'text-indigo-700 bg-indigo-100 border-indigo-200', icon: '👍', blurb: 'Healthy average — room to reach even higher.' };
  if (avg >= 50) return { label: 'Fair', tone: 'text-amber-700 bg-amber-100 border-amber-200', icon: '📘', blurb: 'Passing, but focused support can raise the grades.' };
  if (avg >= 40) return { label: 'Needs support', tone: 'text-orange-700 bg-orange-100 border-orange-200', icon: '⚠️', blurb: 'Below pass mark — targeted help is recommended.' };
  return { label: 'At risk', tone: 'text-red-700 bg-red-100 border-red-200', icon: '🚨', blurb: 'Urgent attention and intervention are recommended.' };
}

function subjectStatus(score: number) {
  if (score >= 75) return { label: 'Strong', cls: 'bg-emerald-100 text-emerald-700' };
  if (score >= 60) return { label: 'Good', cls: 'bg-blue-100 text-blue-700' };
  if (score >= 50) return { label: 'Developing', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'At risk', cls: 'bg-red-100 text-red-700' };
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
  const currentTermId = termData?.id;
  const currentTermName = termData?.name;
  const currentYearName = termData?.academicYear?.name;

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

  const { data: competencyDiag } = useQuery({
    queryKey: ['parent-competency-diag', activeChildId, currentTermId],
    queryFn: () => (activeChildId && currentTermId)
      ? intelligenceApi.getCompetencyDiagnosis(activeChildId, currentTermId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!activeChildId && !!currentTermId,
    retry: false,
  });

  const { data: weaknessProfile } = useQuery({
    queryKey: ['parent-weaknesses', activeChildId],
    queryFn: () => activeChildId
      ? intelligenceApi.getStudentWeaknesses(activeChildId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!activeChildId,
    retry: false,
  });

  const { data: aiStats } = useQuery({
    queryKey: ['parent-ai-stats', activeChildId],
    queryFn: () => activeChildId
      ? intelligenceApi.getStudentStats(activeChildId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!activeChildId,
    retry: false,
  });

  const aiWeaknesses = useMemo(() => {
    if (weaknessProfile && Array.isArray(weaknessProfile.weaknesses)) return weaknessProfile.weaknesses;
    if (competencyDiag && !competencyDiag.error && Array.isArray(competencyDiag.weakestAreas)) {
      return competencyDiag.weakestAreas.map((a: any) => ({
        learningArea: a.area,
        subject: a.subject,
        currentScore: a.score,
        trend: a.status === 'CRITICAL' ? 'declining' : '',
        recommendation: a.status === 'CRITICAL'
          ? `Critical weakness in ${a.area}. This area needs urgent attention in ${a.subject}.`
          : `Below expectations in ${a.area}. Recommend focused practice and support in ${a.subject}.`,
      }));
    }
    return [];
  }, [weaknessProfile, competencyDiag]);

  const aiStrengths = useMemo(() => {
    if (competencyDiag && !competencyDiag.error && Array.isArray(competencyDiag.strongestAreas)) {
      return competencyDiag.strongestAreas;
    }
    return [];
  }, [competencyDiag]);

  const currentTermResults = useMemo(() => {
    if (!currentTermId || !currentTermName) return [];
    return allResults.filter(r =>
      r.term === currentTermName &&
      (!currentYearName || !r.academicYear || r.academicYear === currentYearName),
    );
  }, [allResults, currentTermId, currentTermName, currentYearName]);

  const heatmap = useMemo(() => {
    if (allResults.length === 0) return null;
    const subjects = [...new Set(allResults.map(r => r.subject))];
    const termLabels = [...new Set(allResults.map(r => {
      const y = r.academicYear;
      return y ? `${r.term} · ${y}` : r.term;
    }))];
    const values: number[][] = Array.from({ length: subjects.length }, () => Array(termLabels.length).fill(-1));
    allResults.forEach(r => {
      const si = subjects.indexOf(r.subject);
      const label = r.academicYear ? `${r.term} · ${r.academicYear}` : r.term;
      const ti = termLabels.indexOf(label);
      if (si >= 0 && ti >= 0) values[si][ti] = r.score;
    });
    return { subjects, termLabels, values };
  }, [allResults]);

  const termTrend = useMemo(() => {
    const map = new Map<string, number[]>();
    allResults.forEach(r => {
      const label = `${r.term}${r.academicYear ? ' (' + r.academicYear + ')' : ''}`;
      const arr = map.get(label) || [];
      arr.push(r.score);
      map.set(label, arr);
    });
    return [...map.entries()].map(([label, scores]) => ({
      label,
      avg: scores.reduce((s, v) => s + v, 0) / scores.length,
    }));
  }, [allResults]);

  const overallAverage = useMemo(
    () => currentTermResults.length > 0
      ? currentTermResults.reduce((s: number, r: ParentResult) => s + r.score, 0) / currentTermResults.length
      : 0,
    [currentTermResults],
  );

  const gradeDist = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    currentTermResults.forEach((r: ParentResult) => { counts[getGrade(r.score)]++; });
    return Object.entries(counts).filter(([, c]) => c > 0);
  }, [currentTermResults]);

  const subjectBars = useMemo(
    () => [...currentTermResults]
      .sort((a, b) => a.subject.localeCompare(b.subject))
      .map((r: ParentResult) => ({ subject: r.subject, score: r.score })),
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
    tooltip: { trigger: 'item', formatter: '{b}: {c} subject(s) ({d}%)' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    color: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'],
    series: [{
      name: 'Grades',
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '44%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 11, formatter: '{b}: {d}%', avoidLabelOverlap: true },
      labelLine: { length: 10, length2: 6, smooth: true },
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
    if (growthError || !growth?.trajectory || growth.trajectory.length === 0) return [];
    return growth.trajectory.map((t: any) => ({ label: t.termName, value: t.average }));
  }, [growth, growthError]);

  const overallTrend = growth?.overallTrend;

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
      markLine: overallTrend ? {
        data: [{ type: 'average', name: 'Average' }],
        lineStyle: { color: '#6366f1', type: 'dashed' },
      } : undefined,
    }],
  } : null;

  const recList = (recommendations?.recommendations || []).slice(0, 6) as any[];

  const ds = aiStats?.descriptiveStats || {};
  const cs = aiStats?.comparativeStats || {};
  const dsMean = typeof ds.mean === 'number' ? ds.mean : overallAverage;
  const band = bandOf(dsMean || overallAverage);
  const avgUsed = currentTermResults.length > 0
    ? currentTermResults.reduce((s, r) => s + r.score, 0) / currentTermResults.length
    : dsMean;

  const sortedCurrent = useMemo(() => [...currentTermResults].sort((a, b) => b.score - a.score), [currentTermResults]);
  const topSubjects = sortedCurrent.slice(0, 3);
  const supportSubjects = useMemo(() => currentTermResults.filter(r => r.score < 60).sort((a, b) => a.score - b.score), [currentTermResults]);

  const hasAi = !!aiStats || !!competencyDiag || !!weaknessProfile || (recommendations?.recommendations?.length || 0) > 0 || (growth?.trajectory?.length || 0) > 0;
  const hasCurrentData = currentTermResults.length > 0;
  const childFirstName = activeChild?.firstName || 'Your child';

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

      {childrenComparison.length === 0 && !hasCurrentData && !hasAi ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">📊</span>
          <p className="text-gray-500 mt-4">No analytics data available yet</p>
          <p className="text-xs text-gray-400 mt-2">Analytics will appear once results are published.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className={`text-3xl font-bold ${avgUsed >= 75 ? 'text-emerald-600' : avgUsed >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {avgUsed ? avgUsed.toFixed(1) : '0.0'}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Current Term Average{currentTermName ? ` · ${currentTermName}` : ''}</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className="text-3xl font-bold text-indigo-600">{hasCurrentData ? currentTermResults.length : allResults.length}</p>
              <p className="text-xs text-gray-500 mt-1">Subjects Tracked{!hasCurrentData && allResults.length > 0 ? ' (all terms)' : ''}</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{allResults.length}</p>
              <p className="text-xs text-gray-500 mt-1">Published Results</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5 text-center">
              <p className="text-3xl font-bold text-emerald-600">{activeChild?.attendancePercentage != null ? `${activeChild.attendancePercentage}%` : '—'}</p>
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
                <p className="text-sm text-gray-500">{hasCurrentData ? `${activeChild?.firstName} ${activeChild?.lastName} · ${currentTermName || 'This term'}` : 'No published results for the current term yet'}</p>
              </div>
              <div className="p-5">
                {hasCurrentData ? (
                  <ReactECharts option={subjectOption} style={{ height: 260 }} notMerge lazyUpdate />
                ) : (
                  <div className="text-center py-12">
                    <span className="block text-3xl mb-2">📭</span>
                    <p className="text-gray-400 text-sm">No published results for {currentTermName || 'the current term'}</p>
                    {allResults.length > 0 && (
                      <p className="text-xs text-gray-400 mt-2">This term's results haven't been published yet — results from past terms are shown below.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Grade Distribution</h2>
                <p className="text-sm text-gray-500">{hasCurrentData ? `Grades for ${currentTermName || 'this term'}` : 'No grades published yet'}</p>
              </div>
              <div className="p-5">
                {hasCurrentData ? (
                  <ReactECharts option={pieOption} style={{ height: 280 }} notMerge lazyUpdate />
                ) : (
                  <div className="text-center py-12">
                    <span className="block text-3xl mb-2">🎯</span>
                    <p className="text-gray-400 text-sm">Grades appear once results are published</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Performance Summary</h2>
                <p className="text-sm text-gray-500">AI-backed snapshot for {hasCurrentData ? `${activeChild?.firstName} ${activeChild?.lastName}` : 'your child'}</p>
              </div>
              <div className="p-5 space-y-4">
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${band.tone}`}>
                  <span className="text-2xl">{band.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">Overall: {band.label} {avgUsed ? `(${avgUsed.toFixed(1)}%)` : ''}</p>
                    <p className="text-xs opacity-80 mt-0.5">{band.blurb}</p>
                  </div>
                </div>

                {cs.percentile != null && (
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Class Standing</p>
                    <p className="text-sm text-gray-700 mt-1">{childFirstName} {percentilePhrase(cs.percentile)}.</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-emerald-700 mb-2">🏅 Top Subjects</h3>
                  {topSubjects.length === 0 ? (
                    <p className="text-xs text-gray-400">Publish results for this term to see the top subjects.</p>
                  ) : (
                    topSubjects.map((r: ParentResult, i: number) => (
                      <div key={r.id || i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{['🥇', '🥈', '🥉'][i]} {r.subject}</span>
                        <span className="text-sm font-semibold text-emerald-600">{r.score.toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">🎯 Areas That Need Support (&lt;60%)</h3>
                  {supportSubjects.length === 0 ? (
                    <p className="text-xs text-emerald-600">All current subjects are at or above 60% — great job!</p>
                  ) : (
                    supportSubjects.map((r: ParentResult, i: number) => (
                      <div key={r.id || i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{r.subject}</span>
                        <span className="text-sm font-semibold text-red-600">{r.score.toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {hasAi && (
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-purple-50 to-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-indigo-100 flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">🤖 AI Performance Analysis</h2>
                  <p className="text-sm text-gray-500">Everything the AI understands about {childFirstName}'s learning, in plain language</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${band.tone}`}>
                  {band.icon} {band.label}
                </span>
              </div>

              <div className="p-5 space-y-5">
                {(dsMean || cs.percentile != null || growthPoints.length > 0) && (
                  <div className="p-4 rounded-xl bg-white border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">What this means</p>
                    <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                      {childFirstName} is averaging <strong>{avgUsed ? avgUsed.toFixed(1) + '%' : '—'}</strong> this term, which is an{' '}
                      <strong className="text-indigo-700">{band.label.toLowerCase()}</strong> overall result.{' '}
                      {cs.percentile != null && <>Compared with the rest of the class, {childFirstName} {percentilePhrase(cs.percentile)}.</>}{' '}
                      {typeof cs.zScore === 'number' && <>Their performance {zScorePhrase(cs.zScore)}.</>}{' '}
                      {overallTrend?.direction && trendPhrase(overallTrend.direction, overallTrend.slope)}.{' '}
                      {typeof ds.stdDev === 'number' && <>Their results are {consistencyPhrase(ds.stdDev)} — this tells us how reliable their scores are.</>}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {typeof cs.percentile === 'number' && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className="text-2xl font-bold text-indigo-600">#{Math.round(cs.percentile)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Percentile — better than {Math.round(cs.percentile)}% of the class</p>
                    </div>
                  )}
                  {typeof cs.zScore === 'number' && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className={`text-2xl font-bold ${cs.zScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{cs.zScore >= 0 ? '+' : ''}{cs.zScore.toFixed(2)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Z-score — standing vs the school average</p>
                    </div>
                  )}
                  {typeof cs.studentMean === 'number' && cs.schoolMean != null && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className="text-2xl font-bold text-gray-800">{cs.studentMean.toFixed(1)}%</p>
                      <p className="text-[11px] text-gray-500 mt-1">Their average vs school {cs.schoolMean.toFixed(1)}%</p>
                    </div>
                  )}
                  {typeof ds.stdDev === 'number' && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className="text-2xl font-bold text-gray-800">{ds.stdDev.toFixed(1)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Consistency score (lower = steadier)</p>
                    </div>
                  )}
                  {typeof ds.median === 'number' && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className="text-2xl font-bold text-gray-800">{ds.median.toFixed(1)}%</p>
                      <p className="text-[11px] text-gray-500 mt-1">Median subject score</p>
                    </div>
                  )}
                  {typeof ds.min === 'number' && typeof ds.max === 'number' && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className="text-2xl font-bold text-gray-800">{ds.min.toFixed(0)}–{ds.max.toFixed(0)}%</p>
                      <p className="text-[11px] text-gray-500 mt-1">Lowest to highest subject score</p>
                    </div>
                  )}
                  {typeof ds.count === 'number' && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className="text-2xl font-bold text-gray-800">{ds.count}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Results analysed</p>
                    </div>
                  )}
                  {growthPoints.length > 0 && overallTrend?.direction && (
                    <div className="p-3 rounded-xl bg-white border border-gray-100">
                      <p className="text-2xl font-bold text-gray-800">{overallTrend.direction === 'improving' ? '📈' : overallTrend.direction === 'declining' ? '📉' : '➖'}</p>
                      <p className="text-[11px] text-gray-500 mt-1">Trend: {overallTrend.direction}</p>
                    </div>
                  )}
                </div>

                {hasCurrentData && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">📚 Subject-by-subject detail</h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full bg-white">
                        <thead>
                          <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2 font-semibold">Subject</th>
                            <th className="px-3 py-2 text-center font-semibold">Score</th>
                            <th className="px-3 py-2 text-center font-semibold">Grade</th>
                            <th className="px-3 py-2 text-center font-semibold">Standing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedCurrent.map((r: ParentResult, i: number) => {
                            const st = subjectStatus(r.score);
                            return (
                              <tr key={r.id || i} className="border-t border-gray-50">
                                <td className="px-3 py-2 text-sm font-medium text-gray-800">{r.subject}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${scoreColor(r.score)}18`, color: scoreColor(r.score) }}>
                                    {r.score.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center text-sm text-gray-700">{r.grade || '-'}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {aiStrengths.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-700 mb-2">💪 Where {childFirstName} shines</h3>
                    <div className="flex flex-wrap gap-2">
                      {aiStrengths.map((s: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-sm font-medium text-emerald-700">
                          {s.subject && <span className="text-xs text-emerald-500">{s.subject}</span>}
                          {s.area || s.learningArea}
                          {s.score != null && <span className="text-xs text-emerald-500">{s.score}%</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {aiWeaknesses.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 mb-2">🎯 Where help is needed</h3>
                    <div className="space-y-2">
                      {aiWeaknesses.map((w: any, i: number) => {
                        const tb = trendBadge(w.trend);
                        const wc = weaknessColor(w.currentScore ?? 0);
                        return (
                          <div key={i} className={`p-4 rounded-xl border ${wc}`}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold">{w.subject || 'Subject'}</span>
                                {w.learningArea && <span className="text-xs px-2 py-0.5 rounded-full bg-white/70">{w.learningArea}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">{w.currentScore != null ? `${w.currentScore}%` : '—'}</span>
                                {w.trend && <span className={`text-xs px-2 py-0.5 rounded-full ${tb.className}`}>{tb.label}</span>}
                              </div>
                            </div>
                            {(w.recommendation || w.diagnosis) && (
                              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                                <span className="font-semibold">How to help: </span>{w.recommendation || w.diagnosis}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {competencyDiag?.summary && (
                  <div className="p-4 rounded-xl bg-white border border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">🧩 Competency breakdown</h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Strong areas', value: competencyDiag.summary.strong, cls: 'bg-emerald-100 text-emerald-700' },
                        { label: 'Acceptable', value: competencyDiag.summary.acceptable, cls: 'bg-blue-100 text-blue-700' },
                        { label: 'Need reinforcement', value: competencyDiag.summary.needsReinforcement, cls: 'bg-amber-100 text-amber-700' },
                        { label: 'Critical gaps', value: competencyDiag.summary.criticalWeaknesses, cls: 'bg-red-100 text-red-700' },
                      ].map((s, i) => (
                        <span key={i} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${s.cls}`}>
                          {s.label}: <strong>{s.value}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {competencyDiag?.diagnosis && (
                  <p className="text-sm text-gray-600 italic border-l-4 border-indigo-200 pl-3">{competencyDiag.diagnosis}</p>
                )}
              </div>
            </div>
          )}

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
                {overallTrend?.interpretation && (
                  <p className="text-xs text-gray-500 mt-3">{overallTrend.interpretation}</p>
                )}
              </div>
            </div>
          )}

          {!recError && recList.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">✅ Recommended Next Steps</h2>
                <p className="text-sm text-gray-500">Actionable advice to help {childFirstName} improve</p>
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