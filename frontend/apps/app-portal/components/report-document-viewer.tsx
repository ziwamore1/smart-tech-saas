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
    // keep a reference for print without causing re-renders
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-file-pdf text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm truncate">{report.title}</div>
            <div className="text-gray-400 text-xs truncate">{report.fileName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!pdfUrl}
            className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fas fa-print" /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={!pdfUrl}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fas fa-download" /> Download
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center"
            title="Close"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-gray-800">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
            <i className="fas fa-spinner fa-spin text-3xl mb-3" />
            <p>Loading report...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
            <i className="fas fa-exclamation-triangle text-3xl mb-3 text-yellow-500" />
            <p>{error}</p>
          </div>
        )}
        {pdfUrl && (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full"
            title={report.title}
          />
        )}
      </div>
    </div>
  );
}
