'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportEngineApi, reportTemplateApi, classApi, termApi, studentApi } from '@/lib/api';
import { toast } from 'sonner';

const REPORT_TYPES = [
  { type: 'REPORT_CARD', label: 'Report Card', icon: 'fa-file-text', color: '#3b82f6', desc: 'Individual student report card with charts and analysis', bulk: false },
  { type: 'CLASS_REPORT', label: 'Class Report Cards', icon: 'fa-clipboard-list', color: '#0d9488', desc: 'All report cards for a class as a single combined PDF', bulk: true },
  { type: 'TRANSCRIPT', label: 'Academic Transcript', icon: 'fa-scroll', color: '#8b5cf6', desc: 'Full academic transcript for a student', bulk: true },
  { type: 'CERTIFICATE', label: 'Certificate', icon: 'fa-award', color: '#f59e0b', desc: 'Achievement, merit, or graduation certificate', bulk: true },
  { type: 'ATTENDANCE_REPORT', label: 'Attendance Report', icon: 'fa-calendar-check', color: '#10b981', desc: 'Attendance summary for a student or class', bulk: true },
  { type: 'ANALYTICS_SUMMARY', label: 'Analytics Summary', icon: 'fa-chart-pie', color: '#4f46e5', desc: 'Class or school performance analytics', bulk: true },
  { type: 'MARK_SCHEDULE', label: 'Mark Schedule', icon: 'fa-table', color: '#ea580c', desc: 'Subject-wise mark schedule for a class', bulk: true },
  { type: 'PERFORMANCE_REPORT', label: 'Performance Report', icon: 'fa-chart-line', color: '#ec4899', desc: 'Detailed student performance profile', bulk: false },
  { type: 'RANKING_REPORT', label: 'Class Ranking Report', icon: 'fa-trophy', color: '#d97706', desc: 'Ranked student performance and class distribution', bulk: true },
  { type: 'RESULTS_ANALYSIS', label: 'Results Analysis Report', icon: 'fa-chart-bar', color: '#0891b2', desc: 'Advanced class-based Quality and Quantity results analysis', bulk: false },
];

const BULK_TYPES = ['CLASS_REPORT', 'ATTENDANCE_REPORT', 'ANALYTICS_SUMMARY', 'MARK_SCHEDULE', 'TRANSCRIPT', 'CERTIFICATE', 'RANKING_REPORT'];

function unwrap(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.data) return unwrap(data.data);
  if (data?.reports) return data.reports;
  if (data?.classes) return data.classes;
  if (data?.terms) return data.terms;
  if (data?.students) return data.students;
  if (data?.result) return unwrap(data.result);
  return [];
}

export default function ReportHubPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFileName, setResultFileName] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => unwrap(r.data)),
    staleTime: 60000,
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => unwrap(r.data)),
    staleTime: 60000,
  });

  const { data: students } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: () => studentApi.getAll({ classId: selectedClass }).then(r => unwrap(r.data)),
    enabled: !!selectedClass,
  });

  const { data: templates } = useQuery({
    queryKey: ['report-templates'],
    queryFn: () => reportTemplateApi.getAll().then(r => unwrap(r.data)),
    staleTime: 60000,
  });

  const { data: typesRes } = useQuery({
    queryKey: ['report-engine-types'],
    queryFn: () => reportEngineApi.getTypes().then(r => unwrap(r.data)),
    staleTime: 60000,
  });

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await reportEngineApi.listReports({ limit: 20 });
      const data = res.data?.data || res.data;
      setHistory(Array.isArray(data?.reports) ? data.reports : Array.isArray(data) ? data : []);
    } catch (e) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const availableTypes = Array.isArray(typesRes) && typesRes.length > 0
    ? REPORT_TYPES.map(rt => {
        const live = typesRes.find((t: any) => t.type === rt.type);
        return live ? { ...rt, label: live.label || rt.label, desc: live.description || rt.desc, supportsBulk: live.supportsBulk } : rt;
      })
    : REPORT_TYPES;

  const config = REPORT_TYPES.find(t => t.type === selectedType);
  const needsStudent = selectedType && ['REPORT_CARD', 'TRANSCRIPT', 'CERTIFICATE', 'PERFORMANCE_REPORT'].includes(selectedType);
  const needsClass = selectedType && ['CLASS_REPORT', 'MARK_SCHEDULE', 'ATTENDANCE_REPORT', 'ANALYTICS_SUMMARY', 'RANKING_REPORT', 'RESULTS_ANALYSIS'].includes(selectedType);
  const needsTerm = selectedType && !['TRANSCRIPT'].includes(selectedType);
  const needsTemplate = selectedType === 'CERTIFICATE';

  const canGenerate = selectedType && (!needsStudent || selectedStudent) && (!needsClass || selectedClass) && (!needsTerm || selectedTerm) && (!needsTemplate || selectedTemplate || ((templates || []).length === 0));

  const handleGenerate = async () => {
    if (!selectedType) return;
    setGenerating(true);
    setResultUrl(null);
    try {
      const isBulk = BULK_TYPES.includes(selectedType);
      const payload: any = { type: selectedType };
      if (selectedStudent) payload.studentId = selectedStudent;
      if (selectedClass) payload.classId = selectedClass;
      if (selectedTerm) payload.termId = selectedTerm;
      if (needsTemplate && (selectedTemplate || (templates && templates.length === 1))) {
        payload.templateId = selectedTemplate || (templates as any)[0].id;
      }

      if (isBulk) {
        toast.info('Generating bulk report — this may take a few minutes for large classes.');
        const res = await reportEngineApi.generateBulk(payload);
        const data = res.data?.data || res.data;
        const count = Array.isArray(data?.reports) ? data.reports.length : Array.isArray(data) ? data.length : 0;
        toast.success(count > 0 ? `Bulk generation complete: ${count} report(s) ready` : 'Bulk report generation started');
        setResultUrl(null);
        refreshHistory();
      } else {
        const res = await reportEngineApi.generatePdf(payload);
        const blob = res.data;
        const url = URL.createObjectURL(blob);
        const fileName = `${selectedType.toLowerCase()}-${Date.now()}.pdf`;
        setResultUrl(url);
        setResultFileName(fileName);
        toast.success('Report generated successfully');
        refreshHistory();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = resultFileName;
    a.click();
  };

  const handleDownloadHistory = async (id: string) => {
    try {
      const res = await reportEngineApi.downloadReport(id);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Failed to download report');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <i className="fas fa-print text-blue-500" />
          Report Generation Hub
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Generate any report type through the centralized report engine</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {availableTypes.map(rt => (
          <div
            key={rt.type}
            onClick={() => { setSelectedType(rt.type); setResultUrl(null); }}
            className={`p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
              selectedType === rt.type ? 'border-current shadow-md' : 'border-gray-200 hover:border-gray-300'
            }`}
            style={selectedType === rt.type ? { borderColor: rt.color, backgroundColor: `${rt.color}08` } : {}}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${rt.color}15` }}>
                <i className={`fas ${rt.icon}`} style={{ color: rt.color, fontSize: '18px' }} />
              </div>
              <div>
                <div className="font-semibold text-sm text-gray-900">{rt.label}</div>
                {rt.bulk && <span className="text-[10px] font-bold" style={{ color: rt.color }}>BULK</span>}
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{rt.desc}</p>
          </div>
        ))}
      </div>

      {selectedType && (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Configure: {config?.label}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {(needsClass || needsStudent) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={selectedClass}
                  onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                >
                  <option value="">Select class...</option>
                  {(Array.isArray(classes) ? classes : []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {needsTerm && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                >
                  <option value="">Select term...</option>
                  {(Array.isArray(terms) ? terms : []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {needsStudent && selectedClass && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
                <select
                  value={selectedStudent}
                  onChange={e => setSelectedStudent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                >
                  <option value="">Select student...</option>
                  {(Array.isArray(students) ? students : []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
                  ))}
                </select>
              </div>
            )}

            {needsTemplate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Template</label>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                >
                  <option value="">Default certificate template...</option>
                  {(Array.isArray(templates) ? templates : []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className={`px-5 py-2.5 rounded-lg text-white font-semibold text-sm flex items-center gap-2 ${
                canGenerate && !generating ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ backgroundColor: canGenerate && !generating ? config?.color || '#3b82f6' : '#94a3b8' }}
            >
              {generating ? (
                <><i className="fas fa-spinner fa-spin" /> Generating...</>
              ) : (
                <><i className="fas fa-file-pdf" /> Generate PDF</>
              )}
            </button>

            {resultUrl && (
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-download" /> Download
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-history text-gray-400" /> Recently Generated Reports
            </h3>
            <p className="text-sm text-gray-500">Download previously generated report cards, transcripts and certificates</p>
          </div>
          <button
            onClick={refreshHistory}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <i className="fas fa-sync mr-1" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Report Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Generated By</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Loading...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">No reports generated yet</td></tr>
              ) : history.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">{r.reportType}</span>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{r.title || r.fileName || r.id.slice(0, 8)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : r.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {r.status || 'COMPLETED'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{r.generatedByName || 'System'}</td>
                  <td className="py-3 px-4 text-gray-600">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-center">
                    {r.status === 'COMPLETED' && (
                      <button
                        onClick={() => handleDownloadHistory(r.id)}
                        className="px-3 py-1.5 rounded-lg text-blue-600 text-xs font-semibold hover:bg-blue-50"
                      >
                        <i className="fas fa-download mr-1" /> Download
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
