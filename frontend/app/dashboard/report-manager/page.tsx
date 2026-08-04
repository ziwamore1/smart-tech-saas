'use client';

import { useState, useEffect } from 'react';
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

  const { data, isLoading, refetch } = useQuery({
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
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a365d', margin: 0 }}>
            <i className="fas fa-folder-open" style={{ marginRight: '10px', color: '#6366f1' }} />
            Report Manager
          </h1>
          <p style={{ color: '#64748b', marginTop: '6px', fontSize: '14px' }}>
            Browse, download, and manage previously generated reports
          </p>
        </div>
        <a
          href="/dashboard/report-hub"
          style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none',
            background: '#3b82f6', color: 'white', fontWeight: '600', fontSize: '14px',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}
        >
          <i className="fas fa-plus" /> Generate New Report
        </a>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['ALL', ...Object.keys(REPORT_TYPE_LABELS)].map(key => (
          <button
            key={key}
            onClick={() => { setFilterType(key); setPage(1); }}
            style={{
              padding: '6px 14px', borderRadius: '20px', border: '1px solid',
              borderColor: filterType === key ? '#3b82f6' : '#e2e8f0',
              background: filterType === key ? '#3b82f6' : 'white',
              color: filterType === key ? 'white' : '#64748b',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            }}
          >
            {key === 'ALL' ? 'All' : REPORT_TYPE_LABELS[key]?.label || key}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px' }} />
          <p>Loading reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px', background: 'white', borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <i className="fas fa-folder-open" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '16px' }} />
          <h3 style={{ color: '#475569', marginBottom: '8px' }}>No reports found</h3>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Generate your first report to see it here</p>
          <a
            href="/dashboard/report-hub"
            style={{
              padding: '10px 20px', borderRadius: '8px', background: '#3b82f6',
              color: 'white', textDecoration: 'none', fontWeight: '600',
            }}
          >
            Go to Report Hub
          </a>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>Report</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Generated</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report: any) => {
                const typeInfo = REPORT_TYPE_LABELS[report.reportType] || { label: report.reportType, color: '#64748b', icon: 'fa-file' };
                return (
                  <tr key={report.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: `${typeInfo.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <i className={`fas ${typeInfo.icon}`} style={{ color: typeInfo.color, fontSize: '14px' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '13px', color: '#1e293b' }}>{report.title}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{report.fileName}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        background: `${typeInfo.color}12`, color: typeInfo.color,
                      }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        background: report.status === 'COMPLETED' ? '#dcfce7' : report.status === 'FAILED' ? '#fef2f2' : '#fef3c7',
                        color: report.status === 'COMPLETED' ? '#166534' : report.status === 'FAILED' ? '#991b1b' : '#92400e',
                      }}>
                        {report.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setViewingReport(report)}
                          title="View"
                          style={{ ...actionBtnStyle, color: '#10b981' }}
                        >
                          <i className="fas fa-eye" />
                        </button>
                        <button
                          onClick={() => handleDownload(report)}
                          title="Download"
                          style={{ ...actionBtnStyle, color: '#3b82f6' }}
                        >
                          <i className="fas fa-download" />
                        </button>
                        {report.fileUrl && (
                          <a
                            href={report.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in new tab"
                            style={{ ...actionBtnStyle, color: '#8b5cf6', textDecoration: 'none' }}
                          >
                            <i className="fas fa-external-link-alt" />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            if (confirm('Delete this report?')) deleteMutation.mutate(report.id);
                          }}
                          title="Delete"
                          style={{ ...actionBtnStyle, color: '#ef4444' }}
                        >
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
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '16px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ padding: '6px 12px', fontSize: '13px', color: '#64748b' }}>
                Page {page} of {pagination.totalPages} ({pagination.total} reports)
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer', opacity: page >= pagination.totalPages ? 0.5 : 1 }}
              >
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

const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600',
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: '13px',
};

const actionBtnStyle: React.CSSProperties = {
  width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #e2e8f0',
  background: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: '13px',
};
