'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { reportEngineApi } from '@/lib/api';

interface ReportCardViewerProps {
  studentId: string;
  termId: string;
  termName?: string;
  studentName?: string;
  onClose: () => void;
}

export function ReportCardViewer({
  studentId,
  termId,
  termName,
  studentName,
  onClose,
}: ReportCardViewerProps) {
  const [html, setHtml] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportEngineApi.previewReportCard({ studentId, termId });
      setHtml(res.data?.html || '');
      setData(res.data?.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load report card.');
    } finally {
      setLoading(false);
    }
  }, [studentId, termId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await reportEngineApi.generatePdf({
        type: 'REPORT_CARD',
        studentId,
        termId,
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (studentName || 'Report_Card').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      const safeTerm = (termName || 'Current_Term').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      a.download = `${safeName}_${safeTerm}_Report_Card.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to generate PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const buildShareMessage = () => {
    const subjects: any[] = data?.subjectBreakdown || [];
    const summary = data?.termSummary || {};
    const term = data?.term?.name || termName || 'Current Term';
    const school = data?.schoolName || 'SmartTech School';
    const student = data?.student || {};

    let msg = `${school} - Report Card\n`;
    msg += `Student: ${student.firstName || ''} ${student.lastName || ''}`.trim() + '\n';
    msg += `Class: ${data?.class?.name || ''}\n`;
    msg += `Term: ${term}\n`;
    msg += `Average: ${summary.overallPercentage != null ? Number(summary.overallPercentage).toFixed(1) + '%' : '—'}`;
    if (summary.gpa != null) msg += ` | GPA: ${summary.gpa}`;
    if (summary.totalPoints != null) msg += ` | Points: ${summary.totalPoints}`;
    if (summary.classRank != null) msg += ` | Position: #${summary.classRank} of ${summary.classSize || '—'}`;
    msg += `\n\n${'='.repeat(32)}\nSUBJECT RESULTS\n`;
    subjects.forEach((s: any) => {
      const score = s.finalPercentage != null ? Number(s.finalPercentage).toFixed(1) + '%' : '—';
      msg += `\n${s.subjectName || 'Subject'}: ${score} (${s.finalGrade || '-'})${s.finalRemark ? ' - ' + s.finalRemark : ''}`;
    });
    msg += `\n\nGenerated ${new Date().toLocaleString()}\nSmartTech School Management System`;
    return msg;
  };

  const handleShare = async () => {
    const message = buildShareMessage();
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title: 'Report Card', text: message });
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await nav?.clipboard?.writeText(message);
      alert('Report card summary copied to clipboard.');
    } catch {
      alert('Sharing is not supported on this browser.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      <div className="flex items-center justify-between gap-2 bg-white px-4 py-3 shadow-md">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 truncate">
            {studentName || 'Report Card'}
          </h2>
          <p className="text-xs text-gray-500 truncate">
            {termName || 'Term'} • School Template Report
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleShare}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold"
          >
            Share
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold disabled:opacity-50"
          >
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            disabled={!html}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-gray-300">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="text-sm text-gray-600">Generating your report card...</p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center px-6">
              <span className="text-5xl block mb-3">⚠️</span>
              <p className="text-gray-800 font-medium mb-2">Report card is not available</p>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <button
                onClick={load}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {html && !error && (
          <iframe
            ref={iframeRef}
            title="Report Card"
            srcDoc={html}
            className="absolute inset-0 w-full h-full bg-white"
          />
        )}
      </div>
    </div>
  );
}
