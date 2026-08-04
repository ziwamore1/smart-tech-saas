'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportEngineApi } from '@/lib/api';
import { ReportDocumentViewer } from '@/components/report-document-viewer';
import { toast } from 'sonner';

const REPORT_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  REPORT_CARD: { label: 'Report Card', color: '#3b82f6', icon: 'fa-file-text' },
  CLASS_REPORT: { label: 'Class Report', color: '#0d9488', icon: 'fa-clipboard-list' },
  TRANSCRIPT: { label: 'Transcript', color: '#8b5cf6', icon: 'fa-scroll' },
  CERTIFICATE: { label: 'Certificate', color: '#f59e0b', icon: 'fa-award' },
  ATTENDANCE_REPORT: { label: 'Attendance', color: '#10b981', icon: 'fa-calendar-check' },
  ANALYTICS_SUMMARY: { label: 'Analytics', color: '#4f46e5', icon: 'fa-chart-pie' },
  MARK_SCHEDULE: { label: 'Mark Schedule', color: '#ea580c', icon: 'fa-table' },
  PERFORMANCE_REPORT: { label: 'Performance', color: '#ec4899', icon: 'fa-chart-line' },
};

export default function ReportManagerPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [viewingReport, setViewingReport] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['generated-reports', filterType, page],
    queryFn: () => reportEngineApi.listReports({
      ...(filterType !== 'ALL' ? { reportType: filterType } : {}),
      page,
      limit: 20,
    }).then(r => r.data?.data || r.data),
  });

  const reports = data?.reports || [];
  const pagination = data?.pagination;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportEngineApi.deleteReport(id),
    onSuccess: () => {
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['generated-reports'] });
    },
    onError: () => toast.error('Failed to delete report'),
  });

  const handleDownload = async (report: any) => {
    try {
      const res = await reportEngineApi.downloadReport(report.id);
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      if (report.fileUrl) {
        window.open(report.fileUrl, '_blank');
      } else {
        toast.error('Download not available');
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <i className="fas fa-folder-open text-indigo-500" />
            Report Manager
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Browse, download, and manage previously generated reports</p>
        </div>
        <a
          href="/dashboard/report-hub"
          className="px-5 py-2.5 rounded-lg bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 flex items-center gap-2"
        >
          <i className="fas fa-plus" /> Generate New Report
        </a>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {['ALL', ...Object.keys(REPORT_TYPE_LABELS)].map(key => (
          <button
            key={key}
            onClick={() => { setFilterType(key); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterType === key
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {key === 'ALL' ? 'All' : REPORT_TYPE_LABELS[key]?.label || key}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-500">
          <i className="fas fa-spinner fa-spin text-2xl mb-3" />
          <p>Loading reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <i className="fas fa-folder-open text-5xl text-gray-300 mb-4" />
          <h3 className="text-gray-600 mb-2">No reports found</h3>
          <p className="text-gray-400 mb-5 text-sm">Generate your first report to see it here</p>
          <a href="/dashboard/report-hub" className="px-5 py-2.5 rounded-lg bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600">
            Go to Report Hub
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Report</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Generated</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report: any) => {
                const typeInfo = REPORT_TYPE_LABELS[report.reportType] || { label: report.reportType, color: '#64748b', icon: 'fa-file' };
                return (
                  <tr key={report.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${typeInfo.color}15` }}>
                          <i className={`fas ${typeInfo.icon}`} style={{ color: typeInfo.color, fontSize: '14px' }} />
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-900">{report.title}</div>
                          <div className="text-xs text-gray-400">{report.fileName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${typeInfo.color}12`, color: typeInfo.color }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        report.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        report.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => setViewingReport(report)} title="View" className="w-8 h-8 rounded-md border border-gray-200 bg-white flex items-center justify-center text-green-600 hover:bg-green-50 text-xs">
                          <i className="fas fa-eye" />
                        </button>
                        <button onClick={() => handleDownload(report)} title="Download" className="w-8 h-8 rounded-md border border-gray-200 bg-white flex items-center justify-center text-blue-500 hover:bg-blue-50 text-xs">
                          <i className="fas fa-download" />
                        </button>
                        {report.fileUrl && (
                          <a href={report.fileUrl} target="_blank" rel="noopener noreferrer" title="Open" className="w-8 h-8 rounded-md border border-gray-200 bg-white flex items-center justify-center text-purple-500 hover:bg-purple-50 text-xs">
                            <i className="fas fa-external-link-alt" />
                          </a>
                        )}
                        <button onClick={() => { if (confirm('Delete this report?')) deleteMutation.mutate(report.id); }} title="Delete" className="w-8 h-8 rounded-md border border-gray-200 bg-white flex items-center justify-center text-red-500 hover:bg-red-50 text-xs">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 py-4 border-t border-gray-100">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm disabled:opacity-50">
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.totalPages} ({pagination.total} reports)</span>
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm disabled:opacity-50">
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {viewingReport && (
        <ReportDocumentViewer report={viewingReport} onClose={() => setViewingReport(null)} />
      )}
    </div>
  );
}
