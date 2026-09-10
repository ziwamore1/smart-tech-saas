'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { teacherAnalyticsApi, reportEngineApi, termApi } from '@/lib/api';
import TrendChart from '@/components/charts-echarts/TrendChart';

const RISK_COLOR: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200',
  MODERATE: 'bg-amber-50 text-amber-700 border-amber-200',
  STABLE: 'bg-green-50 text-green-700 border-green-200',
};

const TREND_COLOR: Record<string, string> = {
  IMPROVING: 'bg-green-100 text-green-800',
  DECLINING: 'bg-red-100 text-red-800',
  STABLE: 'bg-blue-100 text-blue-800',
  INSUFFICIENT_DATA: 'bg-gray-100 text-gray-500',
};

const COMPETENCY_STATUS_COLOR: Record<string, string> = {
  MASTERED: 'bg-green-100 text-green-800',
  DEVELOPING: 'bg-blue-100 text-blue-800',
  WEAK: 'bg-amber-100 text-amber-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const GAP_CLASSIFICATION: Record<string, string> = {
  FEMALE_ADVANTAGE: 'Female learners score higher on average',
  MALE_ADVANTAGE: 'Male learners score higher on average',
  NEGLIGIBLE_GAP: 'Negligible gap between genders',
  SIGNIFICANT_GAP: 'Significant gap between genders',
  INSUFFICIENT_DATA: 'Insufficient data',
};

function trendLabel(t: string) {
  if (t === 'IMPROVING') return 'Improving';
  if (t === 'DECLINING') return 'Declining';
  if (t === 'STABLE') return 'Stable';
  return 'Insufficient data';
}

function pct(v: number | null | undefined, suffix = true) {
  if (v == null) return '—';
  return `${Math.round(v * 10) / 10}${suffix ? '%' : ''}`;
}

function SeverityBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-800',
    MODERATE: 'bg-amber-100 text-amber-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${colors[level] || 'bg-gray-100 text-gray-700'}`}>
      {level}
    </span>
  );
}

const GRADE_COLORS: Record<string, string> = {
  '1': '#059669', '2': '#10b981', '3': '#2563eb', '4': '#3b82f6',
  '5': '#d97706', '6': '#f59e0b', '7': '#dc2626', '8': '#b91c1c', '9': '#7f1d1d',
  'A+': '#059669', 'A': '#10b981', 'B+': '#2563eb', 'B': '#3b82f6',
  'C+': '#d97706', 'C': '#f59e0b', 'D': '#dc2626', 'E': '#b91c1c', 'F': '#7f1d1d',
};
function gradeColor(g: string) {
  return GRADE_COLORS[g] || '#9ca3af';
}

function GradeDistributionPanel({
  distribution,
  profile,
  totalAssessed,
}: {
  distribution: any[];
  profile?: any;
  totalAssessed?: number;
}) {
  const rows = distribution || [];
  const maxCount = Math.max(1, ...rows.map((d) => d.count ?? 0));
  const total = totalAssessed ?? rows.reduce((s, d) => s + (d.count ?? 0), 0);
  if (rows.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Grade Distribution {profile?.systemName ? `— ${profile.systemName}` : ''}
          </h3>
          {profile?.qualityBands && (
            <p className="text-xs text-gray-400 mt-0.5">
              Quality (pass): {profile.qualityBands.description} · Quantity (pass): {profile.quantityBands?.description}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-500">{total} graded learners</span>
      </div>
      <div className="space-y-2">
        {rows.map((d) => (
          <div key={d.grade} className="flex items-center gap-3">
            <span className="w-7 text-center font-bold text-sm" style={{ color: gradeColor(d.grade) }}>{d.grade}</span>
            <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${Math.max(((d.count ?? 0) / maxCount) * 100, d.count ? 6 : 0)}%`, background: gradeColor(d.grade) }} />
            </div>
            <span className="w-28 text-right text-sm font-medium whitespace-nowrap">
              {d.count ?? 0} <span className="text-gray-400 text-xs">({pct(d.percentage)})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradeLegend({ distribution }: { distribution: any[] }) {
  if (!distribution || distribution.length === 0) return null;
  const items = distribution.filter((d) => (d.count ?? 0) > 0);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((d) => (
        <span key={d.grade} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 text-xs font-medium text-gray-700">
          <span className="w-3 h-3 rounded-full" style={{ background: gradeColor(d.grade) }} />
          Grade {d.grade}: {d.count}
        </span>
      ))}
    </div>
  );
}

export default function TeacherAnalysisPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [teachersLoaded, setTeachersLoaded] = useState(false);
  const [termsLoaded, setTermsLoaded] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'subjects' | 'at-risk' | 'trends' | 'competency' | 'ai'>('overview');
  const [generating, setGenerating] = useState(false);
  const [viewReport, setViewReport] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState(false);

  const userRoles = ((user as any)?.allRoles || user?.roles || []).map((role: string) => String(role).toUpperCase());
  const canSelectTeacher = userRoles.some((role: string) => ['DIRECTOR', 'HEAD TEACHER', 'HEADTEACHER', 'DEPUTY HEAD', 'DEPUTY HEAD TEACHER', 'DEPUTYHEADTEACHER', 'DEPUTY'].includes(role));

  useEffect(() => {
    termApi.getAll().then((res: any) => {
      const raw = res?.data?.data || res?.data || res || [];
      const list = Array.isArray(raw) ? raw : [];
      setTerms(list);
      const current = list.find((t: any) => t.isCurrent);
      if (current) setSelectedTermId(current.id);
    }).catch(() => {}).finally(() => setTermsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !canSelectTeacher || !termsLoaded) return;
    setTeachersLoaded(false);
    teacherAnalyticsApi.getAvailableTeachers(selectedTermId ? { termId: selectedTermId } : undefined)
      .then((res: any) => {
        const raw = res?.data?.data || res?.data || res || [];
        const list = Array.isArray(raw) ? raw : [];
        setTeachers(list);
        setSelectedTeacherId((current) => current && list.some((teacher: any) => teacher.id === current) ? current : (list[0]?.id || ''));
      })
      .catch(() => setTeachers([]))
      .finally(() => setTeachersLoaded(true));
  }, [isAuthenticated, canSelectTeacher, termsLoaded, selectedTermId]);

  const fetchData = useCallback(async (termId?: string, teacherId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = teacherId
        ? await teacherAnalyticsApi.getTeacherOverview(teacherId, termId ? { termId } : undefined)
        : await teacherAnalyticsApi.getOverview(termId ? { termId } : undefined);
      setData(res?.data?.data || res?.data || res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard/teacher-analysis');
      return;
    }
    if (!isAuthenticated || authLoading) return;
    if (canSelectTeacher && (!teachersLoaded || !selectedTeacherId)) return;
    fetchData(selectedTermId || undefined, selectedTeacherId || undefined);
  }, [isAuthenticated, authLoading, canSelectTeacher, teachersLoaded, selectedTermId, selectedTeacherId, fetchData, router]);

  const downloadReport = async () => {
    if (!data?.summary?.term) return;
    setGenerating(true);
    try {
        const res = await reportEngineApi.generatePdf({
          type: 'TEACHER_ANALYSIS',
          termId: data.summary.term.id,
          examType: data.summary.examType || undefined,
          teacherUserId: selectedTeacherId || undefined,
        });
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `teacher-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to generate PDF report');
    } finally {
      setGenerating(false);
    }
  };

  const openReport = async () => {
    if (!summary?.term) return;
    setViewingReport(true);
    setReportHtml(null);
    try {
      const res = await reportEngineApi.previewTeacherAnalysis({
        termId: summary.term.id,
        examType: summary.examType || undefined,
        teacherUserId: selectedTeacherId || undefined,
      });
      setReportHtml(res?.data?.html || res?.data?.data?.html || null);
      setViewReport(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load report preview');
    } finally {
      setViewingReport(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const context = data?.context || null;
  const summary = data?.summary || null;
  const assignments: any[] = data?.assignments || [];
  const classes: any[] = data?.classes || [];
  const subjects: any[] = data?.subjects || [];
  const atRisk: any[] = data?.atRisk || [];
  const trends: any[] = data?.trends || [];
  const attendance = data?.attendance || null;
  const load = data?.load || null;
  const competency = data?.competency || null;
  const insights = data?.insights || null;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'classes', label: 'By Class' },
    { key: 'subjects', label: 'By Subject' },
    { key: 'at-risk', label: 'At-Risk Students' },
    { key: 'trends', label: 'Trends' },
    { key: 'competency', label: 'Competencies' },
    { key: 'ai', label: 'AI Insights' },
  ] as const;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <i className="fas fa-user-graduate text-pink-500" />
             {selectedTeacherId ? `${context?.teacherName || 'Teacher'}'s Teaching Analysis` : 'My Teaching Analysis'}
          </h1>
          <p className="text-gray-500 mt-1">{selectedTeacherId ? 'Full teaching, learner-outcome, competency and AI analysis for the selected teacher' : 'Your classes, subjects, learner outcomes, competencies and AI-driven coaching'}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTermId}
            onChange={(e) => setSelectedTermId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-pink-500"
          >
            <option value="">Select Term</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name} {t.isCurrent ? '(Current)' : ''}</option>
            ))}
          </select>
          {canSelectTeacher && (
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-pink-500 min-w-[220px]"
            >
              <option value="">My analysis</option>
              {teachers.map((teacher: any) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.assignmentCount} assignments)
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => fetchData(selectedTermId || undefined, selectedTeacherId || undefined)}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            ↻ Refresh
          </button>
          <button
            onClick={openReport}
            disabled={viewingReport || !summary?.term}
            className="px-4 py-2 bg-white border border-pink-300 text-pink-600 rounded-lg hover:bg-pink-50 text-sm font-medium disabled:opacity-50"
          >
            {viewingReport ? 'Loading…' : '👁 View Report'}
          </button>
          <button
            onClick={downloadReport}
            disabled={generating || !summary?.term}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 text-sm font-medium disabled:opacity-50"
          >
            {generating ? 'Generating PDF…' : '⬇ PDF Report'}
          </button>
        </div>
      </div>

      {context && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex flex-wrap items-center gap-4">
          {context.teacherPhoto ? (
            <img src={context.teacherPhoto} alt={context.teacherName} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-xl">
              {context.teacherName?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex-1 min-w-[180px]">
            <p className="text-lg font-bold text-gray-900">{context.teacherName}</p>
            <p className="text-sm text-gray-500">{context.department || 'Staff'} · {context.roles.join(', ')}</p>
          </div>
          {summary?.dataPeriod && (
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Data period</p>
              <p className="text-sm font-semibold text-gray-800">{summary.dataPeriod}</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => { setError(null); fetchData(selectedTermId || undefined); }} className="text-sm text-red-600 hover:text-red-800 font-medium underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-48 mb-3" />
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((j) => <div key={j} className="h-12 bg-gray-100 rounded-lg" />)}
              </div>
            </div>
          ))}
        </div>
      ) : !summary ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📅</p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Teaching Period</h3>
          <p className="text-gray-500">Set a current academic year and term to view your teaching analysis.</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">🧑‍🏫</p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Teaching Assignments Found</h3>
          <p className="text-gray-500">You are not assigned to any class–subject for this term yet.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ======= OVERVIEW ======= */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-4 mb-6">
                {[
                  { label: 'Avg Score', value: pct(summary.overallAverage), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                  { label: 'Pass Rate', value: pct(summary.overallPassRate), color: 'bg-green-50 text-green-700 border-green-200' },
                  { label: 'Quality Pass', value: pct(summary.overallQualityPassRate), color: 'bg-purple-50 text-purple-700 border-purple-200', title: summary.gradingProfiles?.[0]?.qualityBands?.description },
                  { label: 'Quantity Pass', value: pct(summary.overallQuantityPassRate), color: 'bg-teal-50 text-teal-700 border-teal-200', title: summary.gradingProfiles?.[0]?.quantityBands?.description },
                  { label: 'Learners', value: summary.totalStudentsTaught ?? '—', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                  { label: 'Classes', value: summary.classesCount ?? '—', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                  { label: 'Subjects', value: summary.subjectsCount ?? '—', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                  { label: 'Assessments', value: summary.assessmentsAnalysed ?? '—', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
                  { label: 'At Risk', value: summary.studentsAtRisk ?? 0, color: 'bg-red-50 text-red-700 border-red-200' },
                  { label: 'Need Help', value: summary.studentsRequiringIntervention ?? 0, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                ].map((stat) => (
                  <div key={stat.label} className={`${stat.color} border rounded-xl p-4`}>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs mt-1 opacity-80">{stat.label}</p>
                    {stat.title && <p className="text-[10px] mt-0.5 opacity-60 truncate">{stat.title}</p>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Highest Class</p>
                  {summary.highestClassAverage ? (
                    <>
                      <p className="text-lg font-bold text-gray-900">{summary.highestClassAverage.subjectName} — {summary.highestClassAverage.className}</p>
                      <p className="text-sm text-green-600 font-semibold">{pct(summary.highestClassAverage.average)}</p>
                    </>
                  ) : <p className="text-sm text-gray-400">No data yet</p>}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Lowest Class</p>
                  {summary.lowestClassAverage ? (
                    <>
                      <p className="text-lg font-bold text-gray-900">{summary.lowestClassAverage.subjectName} — {summary.lowestClassAverage.className}</p>
                      <p className="text-sm text-red-600 font-semibold">{pct(summary.lowestClassAverage.average)}</p>
                    </>
                  ) : <p className="text-sm text-gray-400">No data yet</p>}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Gender Gap</p>
                  <p className="text-lg font-bold text-gray-900">
                    {summary.genderGap != null ? `${Math.abs(summary.genderGap)} pts` : '—'}
                  </p>
                  {summary.genderGapClassification && (
                    <p className="text-sm text-gray-600">{GAP_CLASSIFICATION[summary.genderGapClassification] || summary.genderGapClassification}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Class Performance</h2>
                    <p className="text-sm text-gray-500">Roll-up of your classes</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Class</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Avg</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Pass</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Quality</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Quantity</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Learners</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.slice(0, 6).map((c: any) => (
                          <tr key={c.classId} className="border-b border-gray-100">
                            <td className="py-2 px-4 font-medium text-gray-900">{c.className}</td>
                            <td className="py-2 px-4 text-center font-medium">{pct(c.average)}</td>
                            <td className="py-2 px-4 text-center font-medium">{pct(c.passRate)}</td>
                            <td className="py-2 px-4 text-center font-medium text-purple-600">{pct(c.qualityPassRate)}</td>
                            <td className="py-2 px-4 text-center font-medium text-teal-600">{pct(c.quantityPassRate)}</td>
                            <td className="py-2 px-4 text-center">{c.studentCount}</td>
                          </tr>
                        ))}
                        {classes.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-500">No class data</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Subject Performance</h2>
                    <p className="text-sm text-gray-500">Roll-up across your subjects</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Subject</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Avg</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Pass</th>
                          <th className="text-center py-2 px-4 font-semibold text-gray-700">Classes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.slice(0, 6).map((s: any) => (
                          <tr key={s.subjectId} className="border-b border-gray-100">
                            <td className="py-2 px-4 font-medium text-gray-900">{s.subjectName}</td>
                            <td className="py-2 px-4 text-center font-medium">{pct(s.overallAverage)}</td>
                            <td className="py-2 px-4 text-center font-medium">{pct(s.overallPassRate)}</td>
                            <td className="py-2 px-4 text-center">{s.classesCount}</td>
                          </tr>
                        ))}
                        {subjects.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-500">No subject data</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {summary?.gradeDistribution?.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Grade Distribution</h2>
                  <GradeDistributionPanel
                    distribution={summary.gradeDistribution}
                    profile={summary.gradingProfiles?.[0]}
                    totalAssessed={summary.assessedForGrading}
                  />
                  <div className="mt-3"><GradeLegend distribution={summary.gradeDistribution} /></div>
                </div>
              )}

              {attendance && (
                <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Attendance ↔ Performance</h2>
                  {attendance.available ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Correlation (r)</p>
                        <p className="text-xl font-bold text-gray-900">{attendance.correlation}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Sample</p>
                        <p className="text-xl font-bold text-gray-900">{attendance.sampleSize}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">High-attendance avg</p>
                        <p className="text-xl font-bold text-green-600">{pct(attendance.highAttendanceAverage)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Low-attendance avg</p>
                        <p className="text-xl font-bold text-red-600">{pct(attendance.lowAttendanceAverage)}</p>
                      </div>
                      <p className="text-sm text-gray-600 md:col-span-4">{attendance.interpretation}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{attendance.dataRequired}</p>
                  )}
                </div>
              )}

              {load && (
                <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Teaching Load</h2>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div><span className="text-gray-500">Subjects:</span> <span className="font-semibold">{load.subjectsTaught?.length ?? 0}</span></div>
                    <div><span className="text-gray-500">Classes:</span> <span className="font-semibold">{load.classesTaught?.length ?? 0}</span></div>
                    <div><span className="text-gray-500">Learners:</span> <span className="font-semibold">{load.totalStudents ?? 0}</span></div>
                    <div><span className="text-gray-500">Assessments:</span> <span className="font-semibold">{load.totalAssessments ?? 0}</span></div>
                    <div><span className="text-gray-500">Result completion:</span> <span className="font-semibold">{pct(load.resultCompletion)}</span></div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ======= BY CLASS ======= */}
          {activeTab === 'classes' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Class Breakdown</h2>
                <p className="text-sm text-gray-500">Performance per class you teach</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Class</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Subjects</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Learners</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Quality</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Quantity</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Trend</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Gender Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c: any, i: number) => (
                      <tr key={c.classId} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4 font-medium text-gray-900">{c.className}</td>
                        <td className="py-3 px-4 text-gray-600">{c.subjects?.join(', ')}</td>
                        <td className="py-3 px-4 text-center">{c.studentCount}</td>
                        <td className="py-3 px-4 text-center font-medium">{pct(c.average)}</td>
                        <td className="py-3 px-4 text-center font-medium">{pct(c.passRate)}</td>
                        <td className="py-3 px-4 text-center font-medium text-purple-600">{pct(c.qualityPassRate)}</td>
                        <td className="py-3 px-4 text-center font-medium text-teal-600">{pct(c.quantityPassRate)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${TREND_COLOR[c.trend] || 'bg-gray-100 text-gray-500'}`}>
                            {trendLabel(c.trend)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-medium">{c.genderGap != null ? `${c.genderGap} pts` : '—'}</td>
                      </tr>
                    ))}
                    {classes.length === 0 && (
                      <tr><td colSpan={9} className="py-8 text-center text-gray-500">No class-level data for this term.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {classes.filter((c: any) => c.gradeDistribution?.length).length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-t border-gray-200">
                  {classes.filter((c: any) => c.gradeDistribution?.length).map((c: any) => (
                    <GradeDistributionPanel key={c.classId} distribution={c.gradeDistribution} profile={c.gradingProfile} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======= BY SUBJECT ======= */}
          {activeTab === 'subjects' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Subject Breakdown</h2>
                <p className="text-sm text-gray-500">Performance per subject across your classes</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Subject</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Classes</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Learners</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Highest Class</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Lowest Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s: any, i: number) => (
                      <tr key={s.subjectId} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="py-3 px-4 font-medium text-gray-900">{s.subjectName}</td>
                        <td className="py-3 px-4 text-center">{s.classesCount}</td>
                        <td className="py-3 px-4 text-center">{s.totalLearners}</td>
                        <td className="py-3 px-4 text-center font-medium">{pct(s.overallAverage)}</td>
                        <td className="py-3 px-4 text-center font-medium">{pct(s.overallPassRate)}</td>
                        <td className="py-3 px-4 text-center">
                          {s.highestPerformingClass?.average != null
                            ? `${s.highestPerformingClass.className} (${pct(s.highestPerformingClass.average)})`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {s.lowestPerformingClass?.average != null
                            ? `${s.lowestPerformingClass.className} (${pct(s.lowestPerformingClass.average)})`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {subjects.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">No subject-level data for this term.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======= AT-RISK ======= */}
          {activeTab === 'at-risk' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-2xl font-bold text-red-700">{atRisk.filter((s: any) => s.riskLevel === 'HIGH').length}</p>
                  <p className="text-xs text-red-700/80">High risk</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-2xl font-bold text-amber-700">{atRisk.filter((s: any) => s.riskLevel === 'MODERATE').length}</p>
                  <p className="text-xs text-amber-700/80">Moderate risk</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-2xl font-bold text-green-700">{atRisk.filter((s: any) => s.riskLevel === 'STABLE').length}</p>
                  <p className="text-xs text-green-700/80">On track</p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Learners Requiring Support</h2>
                  <p className="text-sm text-gray-500">Ranked by risk; subject-specific interventions per learner</p>
                </div>
                {atRisk.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Learner</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Class</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Subject</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Grade</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Points</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-700">Risk</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Flags</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Intervention</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atRisk.map((s: any, i: number) => (
                          <tr key={s.studentId} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} align-top`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {s.photoUrl ? (
                                  <img src={s.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs">
                                    {s.studentName?.charAt(0) || '?'}
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">{s.studentName}</p>
                                  <p className="text-xs text-gray-400">{s.admissionNumber || ''}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-gray-600">{s.className}</td>
                            <td className="py-3 px-4 text-gray-700">{s.subjectName || '—'}</td>
                            <td className="py-3 px-4 text-center">
                              {s.grade != null && (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full" style={{ background: gradeColor(s.grade) }} />
                                  <span className="font-bold" style={{ color: gradeColor(s.grade) }}>{s.grade}</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-medium">{s.points ?? '—'}</td>
                            <td className="py-3 px-4 text-center font-medium">{pct(s.currentAverage)}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                s.passFailStatus === 'PASS' ? 'bg-green-100 text-green-800' : s.passFailStatus === 'FAIL' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {s.passFailStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${RISK_COLOR[s.riskLevel] || 'bg-gray-100 text-gray-500'}`}>
                                {s.riskLevel}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {s.flags?.map((f: string, fi: number) => (
                                  <span key={fi} className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">{f}</span>
                                ))}
                                {(s.qualityPassed === false || s.quantityPassed === false) && (
                                  <>
                                    {s.qualityPassed === false && <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">Below quality band</span>}
                                    {s.quantityPassed === false && <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">Below quantity band</span>}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-gray-800">{s.recommendedIntervention || '—'}</p>
                              {s.interventionRationale && <p className="text-xs text-gray-400 mt-1">Why: {s.interventionRationale}</p>}
                              {s.interventionAiUsed && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-50 text-pink-600 border border-pink-200">
                                  AI-personalised
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">No at-risk learners identified from computed results for this term.</div>
                )}
              </div>
            </>
          )}

          {/* ======= TRENDS ======= */}
          {activeTab === 'trends' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Term-by-Term Trend</h2>
              <p className="text-sm text-gray-500 mb-4">Average score and pass rate across terms in the current academic year</p>
              {trends.length > 0 ? (
                <TrendChart
                  lines={[
                    { name: 'Average', data: trends.map((t: any) => ({ label: t.termName, value: t.average ?? 0 })), color: '#6366f1' },
                    { name: 'Pass Rate', data: trends.map((t: any) => ({ label: t.termName, value: t.passRate ?? 0 })), color: '#059669' },
                  ]}
                  yAxisLabel="Percent"
                />
              ) : (
                <p className="text-sm text-gray-500">No historical data available yet — data appears once results are computed in a previous term.</p>
              )}
              {trends.length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Term</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Avg</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Pass</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Result Count</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trends.map((t: any) => (
                        <tr key={t.termId} className="border-b border-gray-100">
                          <td className="py-2 px-3 font-medium text-gray-900">{t.termName}</td>
                          <td className="py-2 px-3 text-center font-medium">{pct(t.average)}</td>
                          <td className="py-2 px-3 text-center font-medium">{pct(t.passRate)}</td>
                          <td className="py-2 px-3 text-center">{t.count}</td>
                          <td className="py-2 px-3 text-center">
                            {t.isCurrent ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">Current</span> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======= COMPETENCY ======= */}
          {activeTab === 'competency' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Competency & Learning-Area Mastery</h2>
                <p className="text-sm text-gray-500">Mastery per competency across your classes (from term summaries)</p>
              </div>
              {competency?.available ? (
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <p className="text-xs text-green-700/80 uppercase tracking-wide">Strongest Competency</p>
                      <p className="text-lg font-bold text-green-900">{competency.strongestCompetency?.name || '—'}</p>
                      <p className="text-sm text-green-700">{pct(competency.strongestCompetency?.averageMastery)} · {competency.strongestCompetency?.className}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                      <p className="text-xs text-red-700/80 uppercase tracking-wide">Weakest Competency</p>
                      <p className="text-lg font-bold text-red-900">{competency.weakestCompetency?.name || '—'}</p>
                      <p className="text-sm text-red-700">{pct(competency.weakestCompetency?.averageMastery)} · {competency.weakestCompetency?.className}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Class</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Subject</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Competency</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Avg Mastery</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Affected</th>
                          <th className="text-center py-2 px-3 font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(competency.classCompetency || []).map((row: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2 px-3 font-medium text-gray-900">{row.className}</td>
                            <td className="py-2 px-3">{row.subjectName}</td>
                            <td className="py-2 px-3">{row.competencyName}</td>
                            <td className="py-2 px-3 text-center font-medium">{pct(row.averageMastery)}</td>
                            <td className="py-2 px-3 text-center">{row.affectedStudents}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${COMPETENCY_STATUS_COLOR[row.status] || 'bg-gray-100 text-gray-500'}`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-4xl mb-4">🎯</p>
                  <p className="max-w-md mx-auto">{competency?.dataRequired || 'Competency data is not yet available.'}</p>
                </div>
              )}
            </div>
          )}

          {/* ======= AI INSIGHTS ======= */}
          {activeTab === 'ai' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center text-sm">✦</span>
                    AI Insights & Action Plan
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Evidence-based analysis of your teaching data with recommended next steps</p>
                </div>
                {insights && (
                  insights.aiUsed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-pink-50 to-purple-50 text-pink-700">
                      ✦ AI Generated · {insights.model || 'gpt-4o-mini'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      ⚙ Rule-based analysis (OpenAI key not configured)
                    </span>
                  )
                )}
              </div>

              {!insights ? (
                <div className="p-12 text-center text-gray-500">
                  <p className="text-4xl mb-4">🤖</p>
                  <p>No insights generated yet — an active term with results is required.</p>
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                      <h3 className="font-semibold text-indigo-900 mb-1">What is happening</h3>
                      <p className="text-sm text-indigo-900">{insights.whatIsHappening}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <h3 className="font-semibold text-amber-900 mb-1">Where is the problem</h3>
                      <p className="text-sm text-amber-900">{insights.whereIsTheProblem}</p>
                    </div>
                  </div>

                  {insights.howSerious && (
                    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4">
                      <SeverityBadge level={insights.howSerious.level} />
                      <p className="text-sm text-gray-700">{insights.howSerious.text}</p>
                    </div>
                  )}

                  {insights.whichLearnersAreAffected?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Which learners are affected</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {insights.whichLearnersAreAffected.map((g: any, i: number) => (
                          <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <p className="font-medium text-gray-900">{g.learnerGroup} · <span className="text-pink-600">{g.count}</span></p>
                            <p className="text-sm text-gray-600">{g.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {insights.whatMayBeContributing?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Possible contributing factors</h3>
                      <ul className="text-sm text-gray-700 space-y-1.5">
                        {insights.whatMayBeContributing.map((f: string, i: number) => (
                          <li key={i} className="flex gap-2"><span className="text-pink-500">•</span>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insights.supportingEvidence?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Supporting evidence</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Observation</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Based on</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insights.supportingEvidence.map((e: any, i: number) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="py-2 px-3">{e.observation}</td>
                                <td className="py-2 px-3 text-gray-500">{e.metric}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {insights.recommendedNextSteps?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Recommended next steps</h3>
                      <ol className="text-sm text-gray-700 space-y-1.5 list-decimal list-inside">
                        {insights.recommendedNextSteps.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {insights.howToMeasureProgress?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">How to measure progress</h3>
                      <ul className="text-sm text-gray-700 space-y-1.5">
                        {insights.howToMeasureProgress.map((s: string, i: number) => (
                          <li key={i} className="flex gap-2"><span className="text-green-500">✓</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insights.strengths?.length > 0 && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <h3 className="font-semibold text-green-900 mb-2">💪 Strengths</h3>
                      <ul className="text-sm text-green-800 space-y-1.5">
                        {insights.strengths.map((s: string, i: number) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {insights.actionPlan?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Action plan</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Problem</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Evidence</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Affected</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Intervention</th>
                              <th className="text-center py-2 px-3 font-semibold text-gray-700">Duration</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Success Indicator</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insights.actionPlan.map((p: any, i: number) => (
                              <tr key={i} className="border-b border-gray-100 align-top">
                                <td className="py-2 px-3 font-medium text-gray-900">{p.problem}</td>
                                <td className="py-2 px-3 text-gray-600">{p.evidence}</td>
                                <td className="py-2 px-3 text-gray-600">{p.affectedLearners}</td>
                                <td className="py-2 px-3">{p.intervention}</td>
                                <td className="py-2 px-3 text-center whitespace-nowrap">{p.duration}</td>
                                <td className="py-2 px-3 text-gray-600">{p.successIndicator}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {insights.factCheck?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Fact check</h3>
                      <div className="space-y-2">
                        {insights.factCheck.map((f: any, i: number) => (
                          <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold mr-2 ${
                              f.type === 'FACT' ? 'bg-green-100 text-green-800'
                              : f.type === 'OBSERVATION' ? 'bg-blue-100 text-blue-800'
                              : f.type === 'RECOMMENDED_ACTION' ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                            }`}>
                              {f.type}
                            </span>
                            <span className="text-gray-800">{f.text}</span>
                            {f.evidence && <p className="text-xs text-gray-400 mt-1">Evidence: {f.evidence}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewReport && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Teacher Analysis Report Preview</h2>
                <p className="text-sm text-gray-500">Consolidated HTML report — {context?.teacherName} · {summary?.dataPeriod}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadReport}
                  disabled={generating}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 text-sm font-medium disabled:opacity-50"
                >
                  {generating ? 'Generating…' : '⬇ Download PDF'}
                </button>
                <button
                  onClick={() => setViewReport(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              {reportHtml ? (
                <iframe title="Teacher Analysis Report Preview" srcDoc={reportHtml} className="w-full h-full min-h-[70vh] bg-white rounded-lg border border-gray-200" />
              ) : (
                <div className="flex items-center justify-center h-[70vh] text-gray-500">Loading report…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
