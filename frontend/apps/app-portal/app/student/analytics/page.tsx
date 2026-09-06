'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { studentApi, termApi, resultApi, intelligenceApi, attendanceApi } from '@/lib/api';

interface ResultRow {
  id: string;
  score: number;
  grade?: string;
  points?: number;
  subject?: { name: string } | string;
  term?: { name: string };
}

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

function scoreColor(score: number): string {
  if (score >= 75) return '#10b981';
  if (score >= 60) return '#6366f1';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function subjectName(r: any): string {
  return r.subject?.name || r.subject || 'Subject';
}

export default function StudentAnalytics() {
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  const { data: studentRes } = useQuery({
    queryKey: ['my-profile-analytics'],
    queryFn: () => studentApi.getById('me').then(r => r.data),
    retry: false,
  });
  const student = studentRes?.data || studentRes;
  const studentId = student?.id || '';

  const { data: termsData } = useQuery({
    queryKey: ['terms-analytics'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data || []),
    retry: false,
  });
  const terms = (Array.isArray(termsData) ? termsData : []) as any[];
  const activeTermId = selectedTermId || terms.find((t: any) => t.isCurrent)?.id || terms[0]?.id || '';

  const { data: currentRes = [] } = useQuery<ResultRow[]>({
    queryKey: ['analytics-results', activeTermId],
    queryFn: () => activeTermId
      ? resultApi.getByStudent(studentId || 'me', activeTermId).then(r => r.data?.data || r.data || [])
      : Promise.resolve([]),
    enabled: !!activeTermId,
    retry: false,
  });
  const activeResults = Array.isArray(currentRes) ? currentRes : [];

  const { data: growth } = useQuery({
    queryKey: ['student-growth', studentId],
    queryFn: () => studentId
      ? intelligenceApi.getStudentGrowthTrajectory(studentId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!studentId,
    retry: false,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['student-recommendations', studentId, activeTermId],
    queryFn: () => (studentId && activeTermId)
      ? intelligenceApi.getStudentRecommendations(studentId, activeTermId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!studentId && !!activeTermId,
    retry: false,
  });

  const { data: attendanceTrend } = useQuery({
    queryKey: ['student-attendance-longitudinal', studentId],
    queryFn: () => studentId
      ? attendanceApi.getStudentLongitudinalAnalysis(studentId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!studentId,
    retry: false,
  });

  const activeGradeCounts = useMemo(() => {
    const counts: Record<string, number> = { A: 0, 'B+': 0, B: 0, 'B-': 0, 'C+': 0, C: 0, D: 0, E: 0, F: 0 };
    activeResults.forEach((r: any) => { const g = r.grade || getGrade(r.score); if (counts[g] != null) counts[g]++; });
    return Object.entries(counts).filter(([, c]) => c > 0);
  }, [activeResults]);

  const overallAverage = useMemo(
    () => activeResults.length > 0 ? activeResults.reduce((s: number, r: any) => s + r.score, 0) / activeResults.length : 0,
    [activeResults],
  );

  const subjectBars = useMemo(
    () => [...activeResults]
      .sort((a: any, b: any) => subjectName(a).localeCompare(subjectName(b)))
      .map((r: any) => ({ subject: subjectName(r), score: r.score, grade: r.grade || getGrade(r.score) })),
    [activeResults],
  );

  const subjectOption = useMemo(() => ({
    grid: { left: '8%', right: '8%', bottom: '20%', top: '10%' },
    xAxis: { type: 'category', data: subjectBars.map(s => s.subject), axisLabel: { fontSize: 10, interval: 0, rotate: subjectBars.length > 5 ? 35 : 0 } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      name: 'Score',
      type: 'bar',
      data: subjectBars.map(s => +s.score.toFixed(1)),
      barWidth: 44,
      itemStyle: { color: (p: any) => scoreColor(p.value), borderRadius: [8, 8, 0, 0] },
      label: { show: true, position: 'top', fontSize: 10, formatter: (p: any) => `${p.value.toFixed(0)} · ${subjectBars[p.dataIndex].grade}` },
    }],
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
  }), [subjectBars]);

  const gradeOption = useMemo(() => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [{
      name: 'Grades',
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 12, formatter: '{b} ({c})' },
      data: activeGradeCounts.map(([g, count]) => ({ name: g, value: count })),
    }],
  }), [activeGradeCounts]);

  const growthOption = useMemo(() => {
    const seriesData = growth?.series || growth?.trend || growth?.data || [];
    const labels = seriesData.map((p: any) => p.label || p.term || p.period || '');
    const values = seriesData.map((p: any) => p.value ?? p.score ?? p.avg ?? 0);
    return {
      grid: { left: '8%', right: '8%', bottom: '15%', top: '12%' },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11, interval: 0 } },
      yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [{
        name: 'Score',
        type: 'line',
        data: values.map((v: any) => +v.toFixed(1)),
        smooth: true,
        symbolSize: 8,
        lineStyle: { color: '#6366f1', width: 3 },
        itemStyle: { color: '#6366f1' },
        areaStyle: { color: 'rgba(99,102,241,0.12)' },
      }],
      tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
    };
  }, [growth]);

  const attendanceSeriesLabel = (attendanceTrend && (attendanceTrend.terms || attendanceTrend.series || attendanceTrend.data)) ? 'Attendance' : '';

  const attendanceOption = useMemo(() => {
    const data = attendanceTrend?.terms || attendanceTrend?.series || attendanceTrend?.data || [];
    const labels = data.map((p: any) => p.label || p.term || p.period || '');
    const values = data.map((p: any) => p.rate ?? p.percentage ?? p.value ?? 0);
    return {
      grid: { left: '8%', right: '8%', bottom: '15%', top: '12%' },
      xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11, interval: 0 } },
      yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#f3f4f6' } } },
      series: [{
        name: 'Attendance',
        type: 'line',
        data: values.map((v: any) => +v.toFixed(1)),
        smooth: true,
        symbolSize: 8,
        lineStyle: { color: '#10b981', width: 3 },
        itemStyle: { color: '#10b981' },
        areaStyle: { color: 'rgba(16,185,129,0.12)' },
      }],
      tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
    };
  }, [attendanceTrend]);

  const recList = recommendations?.recommendations || recommendations?.suggestions || recommendations?.items || [];

  return (
    <div className="px-4 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Analytics</h1>
        <p className="text-gray-500 mt-1">Track your performance, attendance and growth</p>
      </div>

      {terms.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {terms.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedTermId(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTermId === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.name}{t.isCurrent ? ' · Current' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-sm">
          <p className="text-sm text-white/80">Overall Average</p>
          <p className="text-3xl font-bold mt-1">{overallAverage ? `${overallAverage.toFixed(1)}%` : '0%'}</p>
          <p className="text-xs text-white/70 mt-1">{terms.find((t: any) => t.id === activeTermId)?.name || 'Selected term'}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Subjects Assessed</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{subjectBars.length}</p>
          <p className="text-xs text-gray-400 mt-1">With published results</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Highest Grade</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {subjectBars.length > 0 ? subjectBars.reduce((best, s) => (best === '' ? s.grade : best), '') : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Best grade this term</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Subject Performance {terms.find((t: any) => t.id === activeTermId)?.name ? `· ${terms.find((t: any) => t.id === activeTermId).name}` : ''}</h2>
          {subjectBars.length > 0 ? <ReactECharts option={subjectOption} style={{ height: 300 }} notMerge lazyUpdate /> : <p className="text-center py-16 text-gray-400">No published results for this term</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Grade Distribution</h2>
          {activeGradeCounts.length > 0 ? <ReactECharts option={gradeOption} style={{ height: 300 }} notMerge lazyUpdate /> : <p className="text-center py-16 text-gray-400">No grades yet</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Growth Trajectory</h2>
          <p className="text-sm text-gray-500 mb-4">AI-generated performance trend</p>
          {growth && (growth.series || growth.trend || growth.data) ? <ReactECharts option={growthOption} style={{ height: 280 }} notMerge lazyUpdate /> : <p className="text-center py-14 text-gray-400">No growth data available yet</p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Attendance Trend</h2>
          <p className="text-sm text-gray-500 mb-4">{attendanceSeriesLabel || 'Longitudinal attendance analysis'}</p>
          {attendanceOption.series[0].data.length > 0 ? <ReactECharts option={attendanceOption} style={{ height: 280 }} notMerge lazyUpdate /> : <p className="text-center py-14 text-gray-400">No attendance trend data yet</p>}
        </div>
      </div>

      {(!growth && attendanceOption.series[0].data.length === 0) && (
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Performance Trend</h2>
            <p className="text-center py-10 text-gray-400">Select terms with data to build a multi-term trend. Term trend is available once multiple terms have published results.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">AI Recommendations</h2>
        <p className="text-sm text-gray-500 mb-4">Personalized insights for this term</p>
        {recList.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recList.map((r: any, i: number) => (
              <div key={i} className="p-4 rounded-xl bg-gray-50/70 border border-gray-100">
                <p className="text-sm font-medium text-gray-800">{r.title || `Recommendation ${i + 1}`}</p>
                <p className="text-sm text-gray-600 mt-1">{r.description || r.recommendation || r.message || r.text}</p>
                {r.priority && <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{r.priority}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-10 text-gray-400">No recommendations available for this term yet</p>
        )}
      </div>
    </div>
  );
}
