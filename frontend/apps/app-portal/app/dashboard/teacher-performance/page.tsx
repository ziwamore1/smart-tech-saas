'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { analyticsApi, termApi, teachingAssignmentApi } from '@/lib/api';

const SUPERVISOR_ROLES = ['Director', 'Deputy Director', 'HOD', 'Head Teacher', 'Deputy', 'SuperAdmin', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'];

function exportToCSV(rows: Array<Record<string, any>>, filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h]?.toString() || '';
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const RATING_COLOR: Record<string, string> = {
  EXCELLENT: 'bg-green-50 text-green-700',
  HIGH: 'bg-emerald-50 text-emerald-700',
  AVERAGE: 'bg-blue-50 text-blue-700',
  BELOW_AVERAGE: 'bg-amber-50 text-amber-700',
  NEEDS_IMPROVEMENT: 'bg-red-50 text-red-700',
  NO_DATA: 'bg-gray-100 text-gray-500',
};

function effectiveRatingLabel(r: string) {
  return r === 'EXCELLENT' ? 'Excellent' : r === 'HIGH' ? 'High' : r === 'AVERAGE' ? 'Average' : r === 'BELOW_AVERAGE' ? 'Below Average' : r === 'NEEDS_IMPROVEMENT' ? 'Needs Improvement' : 'No Data';
}

export default function TeacherPerformancePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'individual' | 'effectiveness' | 'ai'>('overview');
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [pendingByTeacher, setPendingByTeacher] = useState<Record<string, any[]>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<any>(null);

  const userRoles = user?.roles || [];
  const isSupervisor = userRoles.some((r: string) => SUPERVISOR_ROLES.includes(r));

  useEffect(() => {
    termApi.getAll().then((res: any) => {
      const data = res?.data?.data || res?.data || res || [];
      const list = Array.isArray(data) ? data : [];
      setTerms(list);
      const current = list.find((t: any) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async (termId?: string) => {
    setLoading(true); setError(null);
    try {
      const [perfRes, assignmentsRes] = await Promise.allSettled([
        termId ? analyticsApi.getTeacherPerformance(termId) : Promise.resolve(null),
        teachingAssignmentApi.getAll(),
      ]);

      const perfData = perfRes.status === 'fulfilled'
        ? (perfRes.value?.data?.data || perfRes.value?.data || perfRes.value || null)
        : null;
      const raw = perfData?.teachers || [];
      setTeachers(Array.isArray(raw) ? raw : []);
      setSummary(perfData?.summary || null);

      // Assessment completion lookups (teacherId = user id on TeachingAssignment)
      const assignmentsData = assignmentsRes.status === 'fulfilled'
        ? (assignmentsRes.value?.data?.data || assignmentsRes.value?.data || assignmentsRes.value || [])
        : [];
      const pendingMap: Record<string, any[]> = {};
      if (Array.isArray(assignmentsData)) {
        for (const a of assignmentsData) {
          if (a.teacherId && a.classId && a.subjectId) {
            if (!pendingMap[a.teacherId]) pendingMap[a.teacherId] = [];
            pendingMap[a.teacherId].push({
              className: a.class?.name || 'Class',
              subjectName: a.subject?.name || 'Subject',
            });
          }
        }
      }
      setPendingByTeacher(pendingMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard/teacher-performance');
      return;
    }
    if (isAuthenticated && !authLoading && selectedTermId) fetchData(selectedTermId);
  }, [isAuthenticated, authLoading, selectedTermId, fetchData, router]);

  const fetchAiInsight = async (teacherId?: string) => {
    if (!selectedTermId) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const res = await analyticsApi.getAiInsights({
        termId: selectedTermId,
        ...(teacherId ? { teacherId } : {}),
      });
      setAiInsight(res?.data?.data || res?.data || res);
    } catch (e: any) {
      setError(e.message || 'Failed to generate AI insights');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportCSV = () => {
    const rows = teachers.map(t => ({
      Teacher: t.teacherName,
      Department: t.department,
      Classes: t.classCount,
      Subjects: t.subjectCount,
      Students: t.studentCount,
      'Avg Score (%)': t.average ?? '—',
      'Pass Rate (%)': t.passRate ?? '—',
      'Total Points': t.totalPoints ?? '—',
      'Effectiveness': t.effectiveness?.score ?? '—',
      Rating: t.effectiveness?.rating ? effectiveRatingLabel(t.effectiveness.rating) : '—',
    }));
    exportToCSV(rows, `teacher-performance-${new Date().toISOString().split('T')[0]}`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Subject-level rollup across all teachers/classes
  const subjectData = (() => {
    const map = new Map<string, { subject: string; scores: number[]; counts: number[]; students: number }>();
    for (const t of teachers) {
      for (const row of t.perClass || []) {
        if (row.average == null) continue;
        if (!map.has(row.subjectName)) map.set(row.subjectName, { subject: row.subjectName, scores: [], counts: [], students: 0 });
        const entry = map.get(row.subjectName)!;
        entry.scores.push(row.average);
        entry.counts.push(row.studentCount || 0);
        entry.students += row.studentCount || 0;
      }
    }
    return Array.from(map.values()).map((e) => {
      const avg = e.scores.reduce((s, x) => s + x, 0) / e.scores.length;
      return {
        subject: e.subject,
        average: avg,
        highest: Math.max(...e.scores),
        lowest: Math.min(...e.scores),
        studentCount: e.students,
      };
    }).sort((a, b) => b.average - a.average);
  })();

  const avgCompletion = teachers.length > 0
    ? Math.round(teachers.reduce((s, t) => s + (t.average ?? 0), 0) / teachers.filter(t => t.average != null).length || 0)
    : 0;

  const withScores = teachers.filter(t => t.average != null);
  const withEffectiveness = teachers.filter(t => t.effectiveness?.score != null);
  const avgScore = withScores.length ? Math.round(withScores.reduce((s, t) => s + (t.average as number), 0) / withScores.length) : null;
  const avgPass = withScores.length ? Math.round(withScores.reduce((s, t) => s + (t.passRate ?? 0), 0) / withScores.length) : null;
  const avgEff = withEffectiveness.length ? (withEffectiveness.reduce((s, t) => s + (t.effectiveness!.score as number), 0) / withEffectiveness.length).toFixed(1) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Performance</h1>
          <p className="text-gray-500 mt-1">Per-teacher performance across classes and subjects via Teaching Assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Term</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name} {t.isCurrent ? '(Current)' : ''}</option>
            ))}
          </select>
          <button onClick={handleExportCSV} disabled={teachers.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50">
            ⬇ CSV
          </button>
          <button onClick={() => fetchData(selectedTermId)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
            ↻ Refresh
          </button>
        </div>
      </div>

      {!isSupervisor && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">Supervisory role required to view full staff performance. You can still view overall statistics.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'subjects', label: 'By Subject' },
          { key: 'effectiveness', label: 'Effectiveness' },
          { key: 'individual', label: 'Individual' },
          { key: 'ai', label: 'AI Insights' },
        ].map((tab) => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => { setError(null); fetchData(selectedTermId); }} className="text-sm text-red-600 hover:text-red-800 font-medium underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-48" />
                  <div className="h-3 bg-gray-200 rounded w-32" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3">
                {[1,2,3,4].map(j => <div key={j} className="h-12 bg-gray-100 rounded-lg" />)}
              </div>
            </div>
          ))}
        </div>
      ) : !selectedTermId ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📊</p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Term</h3>
          <p className="text-gray-500">Choose an academic term above to view teacher performance data.</p>
        </div>
      ) : teachers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">👥</p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Teaching Assignments Found</h3>
          <p className="text-gray-500">Assign teachers to classes and subjects under Staff Register &gt; Teaching Assignments to see performance here.</p>
        </div>
      ) : activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Teachers', value: summary?.teacherCount ?? teachers.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Classes', value: summary?.classCount ?? '—', color: 'bg-teal-50 text-teal-700 border-teal-200' },
              { label: 'Subjects', value: summary?.subjectCount ?? '—', color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: 'Students', value: summary?.studentCount ?? '—', color: 'bg-green-50 text-green-700 border-green-200' },
              { label: 'Avg Score', value: avgScore != null ? `${avgScore}%` : '—', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { label: 'Avg Pass Rate', value: avgPass != null ? `${avgPass}%` : '—', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.color} border rounded-xl p-4`}>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs mt-1 opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Teacher Performance Table</h2>
              <span className="text-xs text-gray-500">{teachers.length} teacher(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Teacher</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Dept</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Classes</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Subjects</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Students</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass Rate</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Effectiveness</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t, i) => (
                    <tr key={t.teacherId} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${RATING_COLOR[t.effectiveness?.rating] || 'bg-gray-100 text-gray-600'}`}>
                            {t.teacherName?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-gray-900">{t.teacherName || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{t.department}</td>
                      <td className="py-3 px-4 text-center font-medium">{t.classCount}</td>
                      <td className="py-3 px-4 text-center font-medium">{t.subjectCount}</td>
                      <td className="py-3 px-4 text-center font-medium">{t.studentCount}</td>
                      <td className="py-3 px-4 text-center font-medium">
                        {t.average != null ? (
                          <span className={t.average >= 60 ? 'text-green-600' : t.average >= 40 ? 'text-amber-600' : 'text-red-600'}>{t.average}%</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-medium">
                        {t.passRate != null ? (
                          <span className={t.passRate >= 70 ? 'text-green-600' : t.passRate >= 40 ? 'text-amber-600' : 'text-red-600'}>{t.passRate}%</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {t.effectiveness?.score != null ? (
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${RATING_COLOR[t.effectiveness.rating]}`}>
                            {t.effectiveness.score.toFixed(1)} · {effectiveRatingLabel(t.effectiveness.rating)}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => { setSelectedTeacher(t); setActiveTab('individual'); }}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'subjects' ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Subject Performance Analysis</h2>
            <p className="text-sm text-gray-500">Performance breakdown by subject across all classes and teachers</p>
          </div>
          {subjectData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Subject</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Highest</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Lowest</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Students</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectData.map((s: any, i: number) => {
                    const rating = s.average >= 70 ? 'Excellent' : s.average >= 50 ? 'Good' : s.average >= 40 ? 'Average' : 'Poor';
                    const ratingColor = s.average >= 70 ? 'bg-green-100 text-green-800' : s.average >= 50 ? 'bg-blue-100 text-blue-800' : s.average >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
                    return (
                      <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4 font-medium text-gray-900">{s.subject}</td>
                        <td className="py-3 px-4 text-center font-medium">
                          <span className={s.average >= 60 ? 'text-green-600' : s.average >= 40 ? 'text-amber-600' : 'text-red-600'}>
                            {s.average?.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-green-600">{s.highest?.toFixed(1)}%</td>
                        <td className="py-3 px-4 text-center text-red-600">{s.lowest?.toFixed(1)}%</td>
                        <td className="py-3 px-4 text-center">{s.studentCount || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${ratingColor}`}>
                            {rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">No subject performance data available</div>
          )}
        </div>
      ) : activeTab === 'effectiveness' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Teachers Rated', value: withEffectiveness.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Avg Effectiveness', value: avgEff ?? '—', color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: 'Students Impacted', value: teachers.reduce((s, t) => s + (t.studentCount || 0), 0), color: 'bg-green-50 text-green-700 border-green-200' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.color} border rounded-xl p-4`}>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs mt-1 opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Teacher</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Dept</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Effectiveness</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Rating</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Students</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...teachers].sort((a, b) => (b.effectiveness?.score ?? -1) - (a.effectiveness?.score ?? -1)).map((t, i) => {
                    const eff = t.effectiveness;
                    return (
                      <tr key={t.teacherId} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${RATING_COLOR[eff?.rating] || 'bg-gray-100 text-gray-600'}`}>
                              {t.teacherName?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-gray-900">{t.teacherName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{t.department}</td>
                        <td className="py-3 px-4 text-center">
                          {eff?.score != null ? (
                            <div className="flex items-center gap-2 justify-center">
                              <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(eff.score / 5) * 100}%` }} />
                              </div>
                              <span className="text-xs font-bold text-indigo-600">{eff.score.toFixed(1)}</span>
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {eff?.rating ? (
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${RATING_COLOR[eff.rating]}`}>
                              {effectiveRatingLabel(eff.rating)}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{t.studentCount ?? '—'}</td>
                        <td className="py-3 px-4 text-center font-medium">
                          {t.average != null ? (
                            <span className={t.average >= 60 ? 'text-green-600' : t.average >= 40 ? 'text-amber-600' : 'text-red-600'}>{t.average}%</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">
                          {t.passRate != null ? (
                            <span className={t.passRate >= 70 ? 'text-green-600' : t.passRate >= 40 ? 'text-amber-600' : 'text-red-600'}>{t.passRate}%</span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'individual' ? (
        <div className="space-y-6">
          {!selectedTeacher ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...teachers].sort((a, b) => (b.average || 0) - (a.average || 0)).map((t) => (
                <button
                  key={t.teacherId}
                  onClick={() => setSelectedTeacher(t)}
                  className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      {t.teacherName?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{t.teacherName || '—'}</p>
                      <p className="text-xs text-gray-500">{t.department}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="font-bold">{t.average != null ? `${t.average}%` : '—'}</p>
                      <p className="text-gray-500">Avg</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="font-bold">{t.passRate != null ? `${t.passRate}%` : '—'}</p>
                      <p className="text-gray-500">Pass</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="font-bold">{t.studentCount}</p>
                      <p className="text-gray-500">Students</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedTeacher(null)}
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                ← Back to teacher list
              </button>
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-2xl">
                    {selectedTeacher.teacherName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedTeacher.teacherName}</h2>
                    <p className="text-gray-500">{selectedTeacher.department}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedTeacher.studentCount ?? '—'}</p>
                    <p className="text-xs text-gray-600">Students</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{selectedTeacher.average != null ? `${selectedTeacher.average}%` : '—'}</p>
                    <p className="text-xs text-gray-600">Avg Score</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{selectedTeacher.passRate != null ? `${selectedTeacher.passRate}%` : '—'}</p>
                    <p className="text-xs text-gray-600">Pass Rate</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{selectedTeacher.effectiveness?.score != null ? selectedTeacher.effectiveness.score.toFixed(1) : '—'}</p>
                    <p className="text-xs text-gray-600">Effectiveness</p>
                  </div>
                </div>

                <h3 className="font-semibold text-gray-900 mb-2">Classes & Subjects Taught</h3>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Class</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Subject</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Students</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Avg</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Pass Rate</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTeacher.perClass || []).map((row: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="py-2 px-3 font-medium">{row.className}</td>
                          <td className="py-2 px-3">{row.subjectName}</td>
                          <td className="py-2 px-3 text-center">{row.studentCount}</td>
                          <td className="py-2 px-3 text-center font-medium">{row.average != null ? `${row.average}%` : '—'}</td>
                          <td className="py-2 px-3 text-center">{row.passRate != null ? `${row.passRate}%` : '—'}</td>
                          <td className="py-2 px-3 text-center">{row.totalPoints ?? '—'}</td>
                        </tr>
                      ))}
                      {(selectedTeacher.perClass || []).length === 0 && (
                        <tr><td colSpan={6} className="py-4 text-center text-gray-500">No class-level results computed yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {pendingByTeacher[selectedTeacher.teacherId]?.length > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h3 className="font-semibold text-amber-800 mb-2">Teaching Load ({pendingByTeacher[selectedTeacher.teacherId].length})</h3>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {pendingByTeacher[selectedTeacher.teacherId].slice(0, 8).map((item: any, idx: number) => (
                        <li key={idx}>• {item.subjectName} — {item.className}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* AI Insights Tab */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm">✦</span>
                AI-Powered Teacher Performance Insights
              </h2>
              <p className="text-sm text-gray-500 mt-1">Automated narrative analysis of computed results with strengths, weaknesses and recommendations</p>
            </div>
            <div className="flex gap-2">
              <select
                value={selectedTeacher?.teacherId || ''}
                onChange={(e) => setSelectedTeacher(e.target.value ? teachers.find(t => t.teacherId === e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Teachers (School-wide)</option>
                {teachers.map((t) => (
                  <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
                ))}
              </select>
              <button
                onClick={() => fetchAiInsight(selectedTeacher?.teacherId)}
                disabled={aiLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
              >
                {aiLoading ? <><i className="fas fa-spinner fa-spin mr-1" /> Analyzing...</> : 'Generate AI Insights'}
              </button>
            </div>
          </div>

          {aiLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3" />
              <p className="text-gray-500 text-sm">Generating AI analysis from computed results...</p>
            </div>
          ) : !aiInsight ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-4xl mb-4">🤖</p>
              <p>Select a teacher (or all teachers) and click "Generate AI Insights" to see the analysis.</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {aiInsight.aiUsed && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700">
                  <span>✦</span> AI Generated · {aiInsight.model || 'gpt-4o-mini'}
                </div>
              )}
              {!aiInsight.aiUsed && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                  <span>⚙</span> Rule-based analysis (OpenAI key not configured)
                </div>
              )}

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h3 className="font-semibold text-indigo-900 mb-1">Summary</h3>
                <p className="text-sm text-indigo-900">{aiInsight.insight?.summary || aiInsight.fallback?.summary || 'No summary available.'}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <h3 className="font-semibold text-green-900 mb-2">💪 Strengths</h3>
                  <ul className="text-sm text-green-800 space-y-1.5">
                    {(aiInsight.insight?.strengths || aiInsight.fallback?.strengths || []).map((s: string, i: number) => (
                      <li key={i}>• {s}</li>
                    ))}
                    {(aiInsight.insight?.strengths || []).length === 0 && (aiInsight.fallback?.strengths || []).length === 0 && <li className="text-green-700/60">None identified yet.</li>}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <h3 className="font-semibold text-red-900 mb-2">⚠ Areas of Concern</h3>
                  <ul className="text-sm text-red-800 space-y-1.5">
                    {(aiInsight.insight?.weaknesses || aiInsight.fallback?.weaknesses || []).map((s: string, i: number) => (
                      <li key={i}>• {s}</li>
                    ))}
                    {(aiInsight.insight?.weaknesses || []).length === 0 && (aiInsight.fallback?.weaknesses || []).length === 0 && <li className="text-red-700/60">None identified yet.</li>}
                  </ul>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">🎯 Recommendations</h3>
                  <ul className="text-sm text-blue-800 space-y-1.5">
                    {(aiInsight.insight?.recommendations || aiInsight.fallback?.recommendations || []).map((s: string, i: number) => (
                      <li key={i}>• {s}</li>
                    ))}
                    {(aiInsight.insight?.recommendations || []).length === 0 && (aiInsight.fallback?.recommendations || []).length === 0 && <li className="text-blue-700/60">No recommendations yet.</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {!loading && teachers.length > 0 && activeTab !== 'ai' && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span>Avg score 60%+ (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Avg score 40-59% (Needs attention)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span>Avg score below 40% (Critical)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-100 border border-green-300" />
              <span>Effectiveness Excellent/High</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">No computed results yet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
