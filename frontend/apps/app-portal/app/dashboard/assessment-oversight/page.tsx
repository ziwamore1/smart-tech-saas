'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { staffPositionApi, assessmentEngineApi, termApi } from '@/lib/api';
import TeacherDetailDialog from './TeacherDetailDialog';

function generateHtmlReport(teachers: any[], date: string) {
  const totalAssessments = teachers.reduce((s, t) => s + t.totalAssessments, 0);
  const totalPending = teachers.reduce((s, t) => s + t.pendingCount, 0);
  const avgCompletion = teachers.length > 0
    ? Math.round(teachers.reduce((s, t) => s + t.completionRate, 0) / teachers.length)
    : 100;

  const rows = teachers.map(t => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb">${t.name}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${t.totalAssessments}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${t.completedAssessments}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${t.pendingCount}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:bold;color:${t.completionRate >= 80 ? '#059669' : t.completionRate >= 50 ? '#d97706' : '#dc2626'}">${t.completionRate}%</td>
    </tr>
  `).join('');

  return `
    <html><head><meta charset="utf-8"><title>Assessment Oversight Report</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 40px; color: #1f2937; }
      h1 { font-size: 24px; margin: 0; }
      .subtitle { color: #6b7280; margin-top: 4px; }
      .stats { display: flex; gap: 20px; margin: 24px 0; }
      .stat { background: #f3f4f6; padding: 12px 20px; border-radius: 8px; }
      .stat-value { font-size: 28px; font-weight: bold; margin: 0; }
      .stat-label { font-size: 12px; color: #6b7280; margin: 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th { background: #f9fafb; padding: 8px; text-align: center; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
      th:first-child { text-align: left; }
      .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
    </style></head><body>
      <h1>Assessment Oversight Report</h1>
      <p class="subtitle">Generated ${date} — ${teachers.length} teachers, ${totalAssessments} assessments</p>
      <div class="stats">
        <div class="stat"><p class="stat-value">${totalAssessments}</p><p class="stat-label">Total Assessments</p></div>
        <div class="stat"><p class="stat-value">${totalPending}</p><p class="stat-label">Pending</p></div>
        <div class="stat"><p class="stat-value">${avgCompletion}%</p><p class="stat-label">Avg Completion</p></div>
      </div>
      <table>
        <thead><tr><th style="text-align:left">Teacher</th><th>Total</th><th>Done</th><th>Pending</th><th>Rate</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Smart Tech SaaS — Assessment Oversight</div>
    </body></html>
  `;
}

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

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-3 bg-gray-200 rounded w-32" />
        </div>
        <div className="h-6 w-14 bg-gray-200 rounded-full" />
      </div>
      <div className="mt-3 h-2 bg-gray-200 rounded-full" />
      <div className="mt-3 flex gap-4">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="h-3 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export default function AssessmentOversightPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  const [monitoringChain, setMonitoringChain] = useState<any>(null);
  const [pendingAssessments, setPendingAssessments] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');

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
    const teacherId = user?.teacherId || user?.id || '';
    try {
      const [chainRes, pendingRes] = await Promise.allSettled([
        staffPositionApi.getMonitoringChain(teacherId),
        assessmentEngineApi.teacher.pending(),
      ]);

      const chain = chainRes.status === 'fulfilled' ? chainRes.value?.data || chainRes.value : null;
      setMonitoringChain(chain);

      const pending = pendingRes.status === 'fulfilled'
        ? (pendingRes.value?.data || pendingRes.value?.pending || pendingRes.value || [])
        : [];
      const pendingList = Array.isArray(pending) ? pending : [];
      setPendingAssessments(pendingList);

      const supervisees = chain?.supervises || [];
      const teacherList = supervisees.map((s: any) => {
        const tid = s.teacher?.id;
        const teacherName = `${s.teacher?.user?.firstName || ''} ${s.teacher?.user?.lastName || ''}`.trim();
        const teacherPending = pendingList.filter(
          (p: any) => p.teacherId === tid || p.teacherName === teacherName
        );
        const total = teacherPending.length;
        const completed = teacherPending.filter((p: any) => (p.completionRate || 0) >= 100).length;
        const avgRate = total > 0
          ? Math.round(teacherPending.reduce((sum: number, p: any) => sum + (p.completionRate || 0), 0) / total)
          : 100;
        return {
          id: tid,
          name: teacherName,
          role: s.positionType?.replace(/_/g, ' ') || 'Teacher',
          department: s.department?.name || '—',
          totalAssessments: total,
          completedAssessments: completed,
          pendingCount: teacherPending.filter((p: any) => p.missingCount > 0).length,
          completionRate: avgRate,
          pendingItems: teacherPending.filter((p: any) => p.missingCount > 0),
        };
      });
      setTeachers(teacherList);
    } catch (err: any) {
      setError(err.message || 'Failed to load oversight data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/dashboard/assessment-oversight');
      return;
    }
    if (isAuthenticated && !authLoading) fetchData();
  }, [isAuthenticated, authLoading, fetchData, router]);

  const handleExportCSV = () => {
    if (teachers.length === 0) return;
    setExporting(true);
    try {
      const rows = teachers.map(t => ({
        Teacher: t.name,
        Role: t.role,
        Department: t.department,
        'Total Assessments': t.totalAssessments,
        Completed: t.completedAssessments,
        Pending: t.pendingCount,
        'Completion Rate (%)': t.completionRate,
      }));
      exportToCSV(rows, `assessment-oversight-${new Date().toISOString().split('T')[0]}`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (teachers.length === 0) return;
    const html = generateHtmlReport(teachers, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  const handleTermChange = (termId: string) => {
    setSelectedTermId(termId);
    fetchData(termId);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const totalPending = teachers.reduce((s, t) => s + t.pendingCount, 0);
  const avgCompletion = teachers.length > 0
    ? Math.round(teachers.reduce((s, t) => s + t.completionRate, 0) / teachers.length)
    : 100;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Oversight</h1>
          <p className="text-gray-500 mt-1">Monitor assessment completion across your supervised teachers</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTermId}
            onChange={(e) => handleTermChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Terms</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isCurrent ? '(Current)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportCSV}
            disabled={exporting || teachers.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : '⬇ CSV'}
          </button>
          <button
            onClick={handlePrint}
            disabled={teachers.length === 0}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🖨 Print
          </button>
          <button
            onClick={() => fetchData(selectedTermId)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {!isSupervisor && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            You need a supervisory role (HOD, Director, Head Teacher, Deputy) to access assessment oversight.
          </p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Teachers Supervised', value: teachers.length, color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
          { label: 'Total Assessments', value: teachers.reduce((s, t) => s + t.totalAssessments, 0), color: 'bg-purple-50 text-purple-700', border: 'border-purple-200' },
          { label: 'Pending', value: totalPending, color: totalPending > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200', border: '' },
          { label: 'Avg Completion', value: `${avgCompletion}%`, color: avgCompletion >= 80 ? 'bg-green-50 text-green-700 border-green-200' : avgCompletion >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200', border: '' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} ${stat.border} border rounded-xl p-4`}>
            <p className="text-3xl font-bold">{stat.value}</p>
            <p className="text-sm mt-1 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => fetchData(selectedTermId)} className="text-sm text-red-600 hover:text-red-800 font-medium underline">
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Empty State */}
      {!loading && teachers.length === 0 && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📋</p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Supervised Teachers</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Teachers need to be assigned to your department before their assessment data appears here.
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <a href="/dashboard/staff-positions" className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">
              Manage Staff Positions →
            </a>
            <button onClick={() => fetchData(selectedTermId)} className="text-gray-500 hover:text-gray-700 font-medium text-sm">
              ↻ Refresh
            </button>
          </div>
        </div>
      )}

      {/* Teacher Cards */}
      {!loading && (
        <div className="space-y-4">
          {teachers.map((teacher) => {
            const rateColor = teacher.completionRate >= 80 ? 'text-green-600' : teacher.completionRate >= 50 ? 'text-amber-600' : 'text-red-600';
            const rateBg = teacher.completionRate >= 80 ? 'bg-green-50' : teacher.completionRate >= 50 ? 'bg-amber-50' : 'bg-red-50';
            const barColor = teacher.completionRate >= 80 ? 'bg-green-500' : teacher.completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500';

            return (
              <div key={teacher.id} onClick={() => setSelectedTeacher(teacher)} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${rateBg} ${rateColor}`}>
                        {teacher.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{teacher.name || 'Unknown Teacher'}</h3>
                        <p className="text-sm text-gray-500">{teacher.role} — {teacher.department}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${rateBg} ${rateColor}`}>
                      {teacher.completionRate}%
                    </div>
                  </div>

                  <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(teacher.completionRate, 100)}%` }} />
                  </div>

                  <div className="flex gap-4 mt-3 text-sm text-gray-500">
                    <span>{teacher.totalAssessments} assessments</span>
                    <span>{teacher.completedAssessments} completed</span>
                    {teacher.pendingCount > 0 && <span className="text-amber-600 font-medium">{teacher.pendingCount} pending</span>}
                  </div>

                  {teacher.pendingItems.length > 0 && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-2">Pending Assessments:</p>
                      {teacher.pendingItems.slice(0, 5).map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs text-amber-700 py-1">
                          <span>{item.assessmentName || item.assessmentDef?.name || 'Assessment'} — {item.subjectName || item.subject?.name}</span>
                          <span className="font-medium">{item.missingCount} of {item.totalStudents} missing</span>
                        </div>
                      ))}
                      {teacher.pendingItems.length > 5 && (
                        <p className="text-xs text-amber-600 mt-1">+{teacher.pendingItems.length - 5} more pending</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTeacher && (
        <TeacherDetailDialog
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
        />
      )}

      {/* Help Section */}
      {!loading && (
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-3">About Assessment Oversight</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="text-lg">🟢</span>
              <div><strong className="text-gray-900">80-100%</strong> — Good. Teachers are on track.</div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">🟡</span>
              <div><strong className="text-gray-900">50-79%</strong> — Needs attention. Follow up with the teacher.</div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">🔴</span>
              <div><strong className="text-gray-900">Below 50%</strong> — Critical. Immediate action required.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
