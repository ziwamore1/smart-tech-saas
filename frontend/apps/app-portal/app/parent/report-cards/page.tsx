'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi, termApi, resultApi, reportEngineApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ReportCardViewer } from '@/components/report-card-viewer';

export default function ParentReportCards() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: children } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList = Array.isArray(children) ? children : [];

  const { data: terms } = useQuery({
    queryKey: ['terms-report'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const termsList = Array.isArray(terms) ? terms : [];

  const { data: results } = useQuery({
    queryKey: ['parent-child-results-report', selectedChildId, selectedTermId],
    queryFn: () => selectedChildId && selectedTermId
      ? resultApi.getByStudent(selectedChildId, selectedTermId).then(r => r.data?.data || r.data || [])
      : Promise.resolve([]),
    enabled: !!selectedChildId && !!selectedTermId,
  });

  const resultsList = Array.isArray(results) ? results : [];
  const avg = resultsList.length > 0 ? (resultsList.reduce((s: number, r: any) => s + (r.score || r.finalPercentage || 0), 0) / resultsList.length).toFixed(1) : '0.0';

  const selectedChild = childrenList.find((c: any) => c.id === selectedChildId);
  const childName = selectedChild ? (selectedChild.name || `${selectedChild.firstName || ''} ${selectedChild.lastName || ''}`.trim()) : 'Child';
  const selectedTerm = termsList.find((t: any) => t.id === selectedTermId);

  const handleDownloadPDF = async () => {
    if (!selectedChildId || !selectedTermId) return;
    setActionLoading(true);
    try {
      const res = await reportEngineApi.generatePdf({
        type: 'REPORT_CARD',
        studentId: selectedChildId,
        termId: selectedTermId,
      });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `Report_Card_${childName.replace(/\s+/g, '_')}_${(selectedTerm?.name || 'Term').replace(/\s+/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to generate report card.');
    } finally {
      setActionLoading(false);
    }
  };

  const buildShareMessage = () => {
    let msg = `SmartTech School - Report Card\n`;
    msg += `Student: ${childName}\n`;
    msg += `Term: ${selectedTerm?.name || 'Current Term'}\n`;
    msg += `Average: ${avg}%\n\n`;
    msg += `${'='.repeat(32)}\nSUBJECT RESULTS\n`;
    resultsList.forEach((r: any) => {
      const score = r.score || r.finalPercentage || 0;
      msg += `\n${r.subject?.name || r.subject || 'Subject'}: ${score.toFixed(1)}% (${r.grade || '-'})${r.remark ? ' - ' + r.remark : ''}`;
    });
    msg += `\n\nGenerated ${new Date().toLocaleString()}\nSmartTech School Management System`;
    return msg;
  };

  const handleShare = async () => {
    if (resultsList.length === 0) return;
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
          <p className="text-gray-500">View, print and download the professional report card for your children</p>
        </div>
        {selectedChildId && selectedTermId && resultsList.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setViewerOpen(true)} disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              👁 View Report Card
            </button>
            <button onClick={handleDownloadPDF} disabled={actionLoading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50">
              {actionLoading ? 'Generating...' : '⬇ Download PDF'}
            </button>
            <button onClick={handleShare} disabled={actionLoading}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:opacity-50">
              📤 Share
            </button>
          </div>
        )}
      </div>

      {childrenList.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {childrenList.map((c: any) => (
            <button key={c.id} onClick={() => { setSelectedChildId(c.id); setSelectedTermId(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedChildId === c.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
              {c.firstName || c.name || 'Child'}
            </button>
          ))}
        </div>
      )}

      {selectedChildId && termsList.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {termsList.map((t: any) => (
            <button key={t.id} onClick={() => setSelectedTermId(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedTermId === t.id ? 'bg-green-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
              {t.name} {t.resultsLocked ? '✓' : ''}
            </button>
          ))}
        </div>
      )}

      {!selectedChildId && childrenList.length > 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">👆</span>
          <p className="text-gray-500 mt-4">Select a child to view their report card</p>
        </div>
      ) : !selectedTermId ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">📅</span>
          <p className="text-gray-500 mt-4">Select a term to view the report card</p>
        </div>
      ) : resultsList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">📄</span>
          <p className="text-gray-500 mt-4">No report card data available for {selectedTerm?.name}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 shadow-sm">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900">{childName}</h2>
            <p className="text-sm text-gray-500">{selectedTerm?.name}</p>
          </div>
          <div className="text-center mb-6">
            <span className={`text-4xl font-bold ${+avg >= 75 ? 'text-green-600' : +avg >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{avg}%</span>
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
              {resultsList.map((r: any, i: number) => {
                const score = r.score || r.finalPercentage || 0;
                return (
                  <tr key={r.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 text-sm font-medium text-gray-900">{r.subject?.name || r.subject || 'Subject'}</td>
                    <td className="p-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{score.toFixed(1)}%</span>
                    </td>
                    <td className="p-3 text-center text-sm text-gray-700">{r.grade || '-'}</td>
                    <td className="p-3 text-center text-sm text-gray-500">{r.remark || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-center mt-6">
            <button onClick={() => setViewerOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              👁 View Full Report Card
            </button>
          </div>
        </div>
      )}

      {viewerOpen && selectedChildId && selectedTermId && (
        <ReportCardViewer
          studentId={selectedChildId}
          termId={selectedTermId}
          termName={selectedTerm?.name}
          studentName={childName}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
