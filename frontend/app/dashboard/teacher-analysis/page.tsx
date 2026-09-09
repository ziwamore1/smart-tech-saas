'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { reportEngineApi, teacherAnalyticsApi, termApi } from '@/lib/api';

const pct = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value * 10) / 10}%`;

export default function TeacherAnalysisPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [terms, setTerms] = useState<any[]>([]);
  const [termId, setTermId] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    termApi.getAll().then((response: any) => {
      const data = response?.data?.data || response?.data || response || [];
      const list = Array.isArray(data) ? data : [];
      setTerms(list);
      setTermId(list.find((term: any) => term.isCurrent)?.id || '');
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await teacherAnalyticsApi.getOverview(termId ? { termId } : undefined);
      setOverview(response?.data?.data || response?.data || response);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Unable to load teaching analysis');
    } finally {
      setLoading(false);
    }
  }, [termId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard/teacher-analysis');
    } else if (isAuthenticated && !authLoading) {
      load();
    }
  }, [authLoading, isAuthenticated, load, router]);

  const downloadReport = async () => {
    if (!overview?.summary?.term) return;
    setGenerating(true);
    try {
      const response = await reportEngineApi.generatePdf({
        type: 'TEACHER_ANALYSIS',
        termId: overview.summary.term.id,
        examType: overview.summary.examType || undefined,
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `teacher-analysis-${new Date().toISOString().slice(0, 10)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to generate the PDF report');
    } finally {
      setGenerating(false);
    }
  };

  if (authLoading || !isAuthenticated) return null;

  const summary = overview?.summary;
  const assignments = overview?.assignments || [];
  const atRisk = overview?.atRisk || [];
  const insights = overview?.insights;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Teaching Analysis</h1>
          <p className="text-gray-500 mt-1">Evidence-based analysis of your assigned classes and subjects</p>
        </div>
        <div className="flex gap-3">
          <select value={termId} onChange={(event) => setTermId(event.target.value)} className="px-3 py-2 border rounded-lg bg-white text-sm">
            <option value="">Select term</option>
            {terms.map((term) => <option key={term.id} value={term.id}>{term.name}{term.isCurrent ? ' (Current)' : ''}</option>)}
          </select>
          <button onClick={load} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Refresh</button>
          <button onClick={downloadReport} disabled={generating || !summary?.term} className="px-4 py-2 rounded-lg text-sm bg-pink-600 text-white disabled:opacity-50">
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {error && <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}
      {loading ? <div className="p-12 text-center text-gray-500">Loading teaching analysis…</div> : !summary ? (
        <div className="p-12 text-center bg-white border rounded-xl text-gray-500">No active teaching term or computed results are available.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[
              ['Average', pct(summary.overallAverage)], ['Pass rate', pct(summary.overallPassRate)],
              ['Classes', summary.classesCount], ['Subjects', summary.subjectsCount],
              ['Learners', summary.totalStudentsTaught], ['Assessments', summary.assessmentsAnalysed],
              ['At risk', summary.studentsAtRisk], ['Interventions', summary.studentsRequiringIntervention],
            ].map(([label, value]) => <div key={String(label)} className="p-4 rounded-xl border bg-white"><p className="text-xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500 mt-1">{label}</p></div>)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border rounded-xl overflow-hidden">
              <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Assignments</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="text-left p-3">Class</th><th className="text-left p-3">Subject</th><th className="text-center p-3">Average</th><th className="text-center p-3">Pass</th></tr></thead>
                  <tbody>{assignments.map((assignment: any) => <tr key={assignment.assignmentId} className="border-t"><td className="p-3">{assignment.className}</td><td className="p-3">{assignment.subjectName}</td><td className="p-3 text-center">{pct(assignment.stats?.average)}</td><td className="p-3 text-center">{pct(assignment.stats?.passRate)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="bg-white border rounded-xl overflow-hidden">
              <div className="p-4 border-b"><h2 className="font-semibold text-gray-900">Learners requiring intervention</h2></div>
              {atRisk.length === 0 ? <p className="p-6 text-sm text-gray-500">No at-risk learners identified.</p> : <div className="divide-y">{atRisk.slice(0, 10).map((student: any) => <div key={student.studentId} className="p-3 flex items-center justify-between gap-3"><div><p className="font-medium text-gray-900">{student.studentName}</p><p className="text-xs text-gray-500">{student.className} · {student.recommendedIntervention}</p></div><span className="text-xs font-semibold text-red-700">{student.riskLevel}</span></div>)}</div>}
            </section>
          </div>

          {insights && <section className="mt-6 p-5 bg-white border rounded-xl"><h2 className="font-semibold text-gray-900 mb-2">Teaching intelligence</h2><p className="text-sm text-gray-700">{insights.whatIsHappening}</p><p className="text-sm text-gray-700 mt-2">{insights.whereIsTheProblem}</p>{insights.recommendedNextSteps?.length > 0 && <ul className="mt-3 list-disc list-inside text-sm text-gray-700">{insights.recommendedNextSteps.map((step: string, index: number) => <li key={index}>{step}</li>)}</ul>}</section>}
        </>
      )}
    </div>
  );
}
