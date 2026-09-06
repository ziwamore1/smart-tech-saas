'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { termApi, resultApi, reportEngineApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ReportCardViewer } from '@/components/report-card-viewer';

export default function StudentReportCards() {
  const { user } = useAuth();
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: termRes } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const currentTerm = termRes?.data;
  const defaultTermId = selectedTermId || currentTerm?.id || '';

  const { data: termsData } = useQuery({
    queryKey: ['terms-report'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const termsList = Array.isArray(termsData) ? termsData : [];
  const selectedTerm = termsList.find((t: any) => t.id === defaultTermId) || currentTerm;

  const { data: resultsData } = useQuery({
    queryKey: ['my-results-report', defaultTermId],
    queryFn: () => resultApi.getByStudent('me', defaultTermId).then(r => r.data),
    enabled: !!defaultTermId,
  });

  const results = resultsData?.data || resultsData || [];
  const avg = Array.isArray(results) && results.length > 0
    ? (results.reduce((s: number, r: any) => s + (r.score || 0), 0) / results.length).toFixed(1)
    : '0.0';

  const handleDownloadPDF = async () => {
    if (!defaultTermId) return;
    try {
      const res = await reportEngineApi.generatePdf({
        type: 'REPORT_CARD',
        studentId: 'me',
        termId: defaultTermId,
        examType: 'END_TERM',
      });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `Report_Card_${(selectedTerm?.name || 'Current_Term').replace(/\s+/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to generate report card.');
    }
  };

  const buildShareMessage = () => {
    let msg = `SmartTech School - Report Card\n`;
    msg += `Student: ${user?.firstName || ''} ${user?.lastName || ''}`.trim() + '\n';
    msg += `Term: ${selectedTerm?.name || 'Current Term'}\n`;
    msg += `Average: ${avg}%\n\n`;
    msg += `${'='.repeat(32)}\nSUBJECT RESULTS\n`;
    (Array.isArray(results) ? results : []).forEach((r: any) => {
      msg += `\n${r.subject?.name || r.subject || 'Subject'}: ${(r.score || 0).toFixed(1)}% (${r.grade || '-'})${r.remark ? ' - ' + r.remark : ''}`;
    });
    msg += `\n\nGenerated ${new Date().toLocaleString()}\nSmartTech School Management System`;
    return msg;
  };

  const handleShare = async () => {
    if (!Array.isArray(results) || results.length === 0) return;
    const message = buildShareMessage();
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title: 'Report Card', text: message });
        return;
      } catch {
        // fall through to clipboard
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
          <p className="text-gray-500">{selectedTerm?.name || 'Current Term'}</p>
        </div>
        {defaultTermId && Array.isArray(results) && results.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => setViewerOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">👁 View Report Card</button>
            <button onClick={handleDownloadPDF}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">⬇ Download PDF</button>
            <button onClick={handleShare}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm font-medium">📤 Share</button>
          </div>
        )}
      </div>

      {termsList.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {termsList.map((t: any) => (
            <button key={t.id} onClick={() => setSelectedTermId(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${defaultTermId === t.id ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
              {t.name} {t.resultsLocked ? '✓' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900">{user?.firstName} {user?.lastName}</h2>
          <p className="text-gray-500">{selectedTerm?.name} • {new Date().toLocaleDateString()}</p>
        </div>

        {!Array.isArray(results) || results.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-5xl">📄</span>
            <p className="text-gray-500 mt-4">No report card data available</p>
            <p className="text-sm text-gray-400">Results will appear here when published.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-blue-600">{avg}%</span>
              <p className="text-sm text-gray-500">Overall Average</p>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 text-sm font-semibold text-gray-700">Subject</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-700">Score</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-700">Grade</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-700">Remark</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any, i: number) => (
                  <tr key={r.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 text-sm font-medium text-gray-900">{r.subject?.name || r.subject || 'Subject'}</td>
                    <td className="p-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${(r.score || 0) >= 75 ? 'bg-green-100 text-green-800' : (r.score || 0) >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {r.score?.toFixed(1) || 0}%
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm text-gray-700">{r.grade || '-'}</td>
                    <td className="p-3 text-center text-sm text-gray-500">{r.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-center mt-6">
              <button onClick={() => setViewerOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                👁 View Full Report Card
              </button>
            </div>
          </>
        )}
      </div>

      {viewerOpen && defaultTermId && (
        <ReportCardViewer
          studentId="me"
          termId={defaultTermId}
          termName={selectedTerm?.name}
          studentName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'My Report Card'}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
