'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  staffPositionApi,
  assessmentEngineApi,
  analyticsApi,
  intelligenceApi,
  termApi,
} from '@/lib/api';

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

export default function TeacherPerformancePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacherPerformance, setTeacherPerformance] = useState<any[]>([]);
  const [teacherEffectiveness, setTeacherEffectiveness] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'individual' | 'effectiveness'>('overview');
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);

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
    const tid = user?.teacherId || user?.id || '';
    try {
      const [chainRes, pendingRes, perfRes, effectRes] = await Promise.allSettled([
        staffPositionApi.getMonitoringChain(tid),
        assessmentEngineApi.teacher.pending(),
        termId ? analyticsApi.getTeacherPerformance(termId) : Promise.resolve(null),
        termId ? intelligenceApi.getTeacherEffectiveness(termId) : Promise.resolve(null),
      ]);

      const chain = chainRes.status === 'fulfilled' ? chainRes.value?.data || chainRes.value : null;
      const pending = pendingRes.status === 'fulfilled'
        ? (pendingRes.value?.data || pendingRes.value?.pending || pendingRes.value || [])
        : [];
      const pendingList = Array.isArray(pending) ? pending : [];

      const perfData = perfRes.status === 'fulfilled'
        ? (perfRes.value?.data?.data || perfRes.value?.data || perfRes.value || [])
        : [];
      setTeacherPerformance(Array.isArray(perfData) ? perfData : []);

      const effectData = effectRes.status === 'fulfilled'
        ? (effectRes.value?.data?.data || effectRes.value?.data || effectRes.value || [])
        : [];
      setTeacherEffectiveness(Array.isArray(effectData) ? effectData : []);

      const supervisees = chain?.supervises || [];
      const teacherList = supervisees.map((s: any) => {
        const teacherId = s.teacher?.id;
        const teacherName = `${s.teacher?.user?.firstName || ''} ${s.teacher?.user?.lastName || ''}`.trim();
        const teacherPending = pendingList.filter(
          (p: any) => p.teacherId === teacherId || p.teacherName === teacherName
        );
        const total = teacherPending.length;
        const completed = teacherPending.filter((p: any) => (p.completionRate || 0) >= 100).length;
        const avgRate = total > 0
          ? Math.round(teacherPending.reduce((sum: number, p: any) => sum + (p.completionRate || 0), 0) / total)
          : 100;

        const perfMatch = (Array.isArray(perfData) ? perfData : []).find(
          (p: any) => p.teacherId === teacherId
        );
        const effectMatch = (Array.isArray(effectData) ? effectData : []).find(
          (e: any) => e.teacherId === teacherId
        );

        return {
          id: teacherId,
          name: teacherName,
          role: s.positionType?.replace(/_/g, ' ') || 'Teacher',
          department: s.department?.name || '—',
          totalAssessments: total,
          completedAssessments: completed,
          pendingCount: teacherPending.filter((p: any) => p.missingCount > 0).length,
          completionRate: avgRate,
          avgScore: perfMatch?.avgScore ?? null,
          passRate: perfMatch?.passRate ?? null,
          effectivenessScore: effectMatch?.effectivenessScore ?? null,
          studentCount: perfMatch?.studentCount ?? null,
          pendingItems: teacherPending.filter((p: any) => p.missingCount > 0),
        };
      });
      setTeachers(teacherList);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard/teacher-performance');
      return;
    }
    if (isAuthenticated && !authLoading && selectedTermId) fetchData(selectedTermId);
  }, [isAuthenticated, authLoading, selectedTermId, fetchData, router]);

  const handleExportCSV = () => {
    const rows = teachers.map(t => ({
      Teacher: t.name,
      Department: t.department,
      'Total Assessments': t.totalAssessments,
      Completed: t.completedAssessments,
      Pending: t.pendingCount,
      'Completion Rate (%)': t.completionRate,
      'Avg Score (%)': t.avgScore ?? '—',
      'Pass Rate (%)': t.passRate ?? '—',
      'Effectiveness': t.effectivenessScore ?? '—',
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

  const avgCompletion = teachers.length > 0
    ? Math.round(teachers.reduce((s, t) => s + t.completionRate, 0) / teachers.length)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Performance</h1>
          <p className="text-gray-500 mt-1">Assessment completion, scores, and effectiveness tracking</p>
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
          <p className="text-yellow-800 text-sm">Supervisory role required to access this page.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'subjects', label: 'By Subject' },
          { key: 'effectiveness', label: 'Effectiveness' },
          { key: 'individual', label: 'Individual' },
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
          <button onClick={() => fetchData(selectedTermId)} className="text-sm text-red-600 hover:text-red-800 font-medium underline">Retry</button>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Teachers Found</h3>
          <p className="text-gray-500">No supervised teachers found for this term.</p>
        </div>
      ) : activeTab === 'overview' ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Teachers', value: teachers.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Avg Completion', value: `${avgCompletion}%`, color: avgCompletion >= 80 ? 'bg-green-50 text-green-700 border-green-200' : avgCompletion >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200' },
              { label: 'Total Pending', value: teachers.reduce((s, t) => s + t.pendingCount, 0), color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Avg Score', value: (() => { const withScores = teachers.filter(t => t.avgScore != null); return withScores.length > 0 ? `${Math.round(withScores.reduce((s, t) => s + t.avgScore, 0) / withScores.length)}%` : '—'; })(), color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: 'Avg Pass Rate', value: (() => { const withPass = teachers.filter(t => t.passRate != null); return withPass.length > 0 ? `${Math.round(withPass.reduce((s, t) => s + t.passRate, 0) / withPass.length)}%` : '—'; })(), color: 'bg-teal-50 text-teal-700 border-teal-200' },
            ].map((stat) => (
              <div key={stat.label} className={`${stat.color} border rounded-xl p-4`}>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs mt-1 opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Teacher Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Teacher</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Dept</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Assessments</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Completed</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Pending</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Completion</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass Rate</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                    </tr>
                </thead>
                <tbody>
                  {teachers.map((t, i) => {
                    const rateColor = t.completionRate >= 80 ? 'text-green-600' : t.completionRate >= 50 ? 'text-amber-600' : 'text-red-600';
                    const barColor = t.completionRate >= 80 ? 'bg-green-500' : t.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500';
                    return (
                      <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${t.completionRate >= 80 ? 'bg-green-50 text-green-600' : t.completionRate >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                              {t.name?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-gray-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{t.department}</td>
                        <td className="py-3 px-4 text-center font-medium">{t.totalAssessments}</td>
                        <td className="py-3 px-4 text-center text-green-600 font-medium">{t.completedAssessments}</td>
                        <td className="py-3 px-4 text-center">
                          {t.pendingCount > 0 ? (
                            <span className="text-amber-600 font-medium">{t.pendingCount}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[80px]">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(t.completionRate, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${rateColor}`}>{t.completionRate}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">
                          {t.avgScore != null ? (
                            <span className={t.avgScore >= 60 ? 'text-green-600' : t.avgScore >= 40 ? 'text-amber-600' : 'text-red-600'}>
                              {t.avgScore}%
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">
                          {t.passRate != null ? (
                            <span className={t.passRate >= 70 ? 'text-green-600' : t.passRate >= 40 ? 'text-amber-600' : 'text-red-600'}>
                              {t.passRate}%
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Subjects Tab */}
          {activeTab === 'subjects' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Subject Performance Analysis</h2>
                <p className="text-sm text-gray-500">Performance breakdown by subject across all classes</p>
              </div>
              {subjectData && subjectData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Subject</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Highest</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Lowest</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass Rate</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Students</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectData.sort((a: any, b: any) => b.average - a.average).map((s: any, i: number) => {
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
                            <td className="py-3 px-4 text-center font-medium">{s.passRate?.toFixed(1)}%</td>
                            <td className="py-3 px-4 text-center">{s.studentCount || s.count || '—'}</td>
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
          )}

          {/* Individual Teacher Tab */}
          {activeTab === 'individual' && (
            <div className="space-y-6">
              {!selectedTeacher ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teachers.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0)).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacher(t)}
                      className="text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          {t.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-500">{t.department}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-gray-50 rounded p-2">
                          <p className="font-bold">{t.avgScore != null ? `${t.avgScore}%` : '—'}</p>
                          <p className="text-gray-500">Avg</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <p className="font-bold">{t.passRate != null ? `${t.passRate}%` : '—'}</p>
                          <p className="text-gray-500">Pass</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <p className="font-bold">{t.completionRate}%</p>
                          <p className="text-gray-500">Done</p>
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
                        {selectedTeacher.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedTeacher.name}</h2>
                        <p className="text-gray-500">{selectedTeacher.role} • {selectedTeacher.department}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{selectedTeacher.studentCount ?? '—'}</p>
                        <p className="text-xs text-gray-600">Students</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{selectedTeacher.avgScore != null ? `${selectedTeacher.avgScore}%` : '—'}</p>
                        <p className="text-xs text-gray-600">Avg Score</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{selectedTeacher.passRate != null ? `${selectedTeacher.passRate}%` : '—'}</p>
                        <p className="text-xs text-gray-600">Pass Rate</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">{selectedTeacher.completionRate}%</p>
                        <p className="text-xs text-gray-600">Completion</p>
                      </div>
                    </div>
                    {selectedTeacher.effectivenessScore != null && (
                      <div className="p-4 bg-indigo-50 rounded-lg">
                        <p className="text-sm text-gray-600">Effectiveness Score</p>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div className="h-3 rounded-full bg-indigo-600" style={{ width: `${Math.min((selectedTeacher.effectivenessScore / 5) * 100, 100)}%` }} />
                          </div>
                          <span className="text-2xl font-bold text-indigo-600">{selectedTeacher.effectivenessScore.toFixed(1)}/5.0</span>
                        </div>
                      </div>
                    )}
                    {selectedTeacher.pendingItems && selectedTeacher.pendingItems.length > 0 && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <h3 className="font-semibold text-amber-800 mb-2">Pending Assessments ({selectedTeacher.pendingItems.length})</h3>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {selectedTeacher.pendingItems.slice(0, 5).map((item: any, idx: number) => (
                            <li key={idx}>• {item.subjectName || item.assessmentName || `Assessment ${idx + 1}`} — {item.missingCount || '?'} missing</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </>
      ) : (
        /* Effectiveness Tab */
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Teachers Rated', value: teachers.filter(t => t.effectivenessScore != null).length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Avg Effectiveness', value: (() => { const withEff = teachers.filter(t => t.effectivenessScore != null); return withEff.length > 0 ? (withEff.reduce((s, t) => s + t.effectivenessScore, 0) / withEff.length).toFixed(1) : '—'; })(), color: 'bg-purple-50 text-purple-700 border-purple-200' },
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
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Students</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass Rate</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t, i) => {
                    const eff = t.effectivenessScore;
                    const effColor = eff != null ? (eff >= 4 ? 'text-green-600' : eff >= 3 ? 'text-amber-600' : 'text-red-600') : 'text-gray-400';
                    const effBg = eff != null ? (eff >= 4 ? 'bg-green-50' : eff >= 3 ? 'bg-amber-50' : 'bg-red-50') : 'bg-gray-50';
                    return (
                      <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${effBg} ${effColor}`}>
                              {t.name?.charAt(0) || '?'}
                            </div>
                            <span className="font-medium text-gray-900">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{t.department}</td>
                        <td className="py-3 px-4 text-center">
                          {eff != null ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${effBg} ${effColor}`}>
                              {eff >= 4 ? '★' : eff >= 3 ? '◆' : '▼'} {eff.toFixed(1)}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{t.studentCount ?? '—'}</td>
                        <td className="py-3 px-4 text-center font-medium">
                          {t.avgScore != null ? (
                            <span className={t.avgScore >= 60 ? 'text-green-600' : t.avgScore >= 40 ? 'text-amber-600' : 'text-red-600'}>
                              {t.avgScore}%
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center font-medium">
                          {t.passRate != null ? (
                            <span className={t.passRate >= 70 ? 'text-green-600' : t.passRate >= 40 ? 'text-amber-600' : 'text-red-600'}>
                              {t.passRate}%
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="bg-gray-100 rounded-full h-2 w-16">
                              <div className={`h-full rounded-full ${t.completionRate >= 80 ? 'bg-green-500' : t.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(t.completionRate, 100)}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-600">{t.completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Legend */}
      {!loading && teachers.length > 0 && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span>Completion 80%+ (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Completion 50-79% (Needs attention)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span>Completion below 50% (Critical)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold">★</span>
              <span>Effectiveness 4.0+ (High)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
