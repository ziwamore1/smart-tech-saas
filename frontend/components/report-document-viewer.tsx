'use client';

import { useCallback, useEffect, useState } from 'react';
import { reportEngineApi } from '@/lib/api';
import { toast } from 'sonner';

interface ReportDocumentViewerProps {
  report: any;
  onClose: () => void;
}

export function ReportDocumentViewer({ report, onClose }: ReportDocumentViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useCallback((node: HTMLIFrameElement | null) => {
    (window as any).__reportManagerIframe = node;
  }, []);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await reportEngineApi.downloadReport(report.id);
        if (cancelled) return;
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.message || e?.message || 'Failed to load report preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      (window as any).__reportManagerIframe = null;
    };
  }, [report.id]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = pdfUrl || '';
    a.download = report.fileName || 'report.pdf';
    a.click();
  };

  const handlePrint = () => {
    const iframe = (window as any).__reportManagerIframe as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      toast.error('Report is still loading');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column',
      background: '#111827',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: '#111827', borderBottom: '1px solid #374151',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i className="fas fa-file-pdf" style={{ color: '#818cf8' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'white', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {report.title}
            </div>
            <div style={{ color: '#9ca3af', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {report.fileName}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrint}
            disabled={!pdfUrl}
            style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: '#374151', color: 'white', fontSize: '13px', fontWeight: '500',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              opacity: pdfUrl ? 1 : 0.5,
            }}
          >
            <i className="fas fa-print" /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={!pdfUrl}
            style={{
              padding: '6px 12px', borderRadius: '8px', border: 'none',
              background: '#3b82f6', color: 'white', fontSize: '13px', fontWeight: '500',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              opacity: pdfUrl ? 1 : 0.5,
            }}
          >
            <i className="fas fa-download" /> Download
          </button>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: '32px', height: '32px', borderRadius: '8px', border: 'none',
              background: '#374151', color: 'white', cursor: 'pointer',
            }}
          >
            <i className="fas fa-times" />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', background: '#1f2937' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1d5db' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px' }} />
            <p>Loading report...</p>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1d5db' }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '24px', color: '#f59e0b', marginBottom: '12px' }} />
            <p>{error}</p>
          </div>
        )}
        {pdfUrl && (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={report.title}
          />
        )}
      </div>
    </div>
  );
}
