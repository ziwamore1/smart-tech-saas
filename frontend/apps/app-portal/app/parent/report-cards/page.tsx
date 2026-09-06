'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi, termApi, resultApi, reportEngineApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ReportCardViewer } from '@/components/report-card-viewer';

export default function ParentReportCards() {
  const { user } = useAuth();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [action, setAction] = useState<'view' | 'download' | 'print' | ''>('');
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: childrenData } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList = (Array.isArray(childrenData) ? childrenData : []) as any[];

  const { data: termsData } = useQuery({
    queryKey: ['terms-report'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const termsList = (Array.isArray(termsData) ? termsData : []) as any[];

  useEffect(() => {
    if (!selectedChildId && childrenList.length > 0) {
      setSelectedChildId(childrenList[0].id);
    }
  }, [childrenList, selectedChildId]);

  const { data: resultsData } = useQuery({
    queryKey: ['parent-child-results-report', selectedChildId, selectedTermId],
    queryFn: () => selectedChildId && selectedTermId
      ? resultApi.getByStudent(selectedChildId, selectedTermId).then(r => r.data?.data || r.data || [])
      : Promise.resolve([]),
    enabled: !!selectedChildId && !!selectedTermId,
  });

  const resultsList = (Array.isArray(resultsData) ? resultsData : []) as any[];
  const avg = useMemo(
    () => resultsList.length > 0
      ? (resultsList.reduce((s: number, r: any) => s + (r.score || r.finalPercentage || 0), 0) / resultsList.length).toFixed(1)
      : '0.0',
    [resultsList],
  );

  const selectedChild = childrenList.find((c: any) => c.id === selectedChildId);
  const childName = selectedChild
    ? (selectedChild.name || `${selectedChild.firstName || ''} ${selectedChild.lastName || ''}`.trim())
    : 'Child';
  const selectedTerm = termsList.find((t: any) => t.id === selectedTermId);

  const generateBlob = async () => {
    const res = await reportEngineApi.generatePdf({
      type: 'REPORT_CARD',
      studentId: selectedChildId,
      termId: selectedTermId,
    });
    return res.data instanceof Blob ? res.data : new Blob([res.data]);
  };

  const handleDownloadPDF = async () => {
    if (!selectedChildId || !selectedTermId) return;
    setActionLoading(true);
    setAction('download');
    try {
      const blob = await generateBlob();
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
      setAction('');
    }
  };

  const handlePrint = async () => {
    if (!selectedChildId || !selectedTermId) return;
    setActionLoading(true);
    setAction('print');
    try {
      const blob = await generateBlob();
      const url = window.URL.createObjectURL(blob);
      const win: any = window.open(url, '_blank');
      if (win) {
        win.onload = () => {
          try { win.focus(); win.print(); } catch { /* non-blocking */ }
        };
      }
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to prepare report card for printing.');
    } finally {
      setActionLoading(false);
      setAction('');
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
    <div className="px-4 py-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
          <p className="text-gray-500">View, print and download the professional report card for your children</p>
        </div>
        {selectedChildId && selectedTermId && resultsList.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setViewerOpen(true)}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              👁 View
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              {actionLoading && action === 'download' ? 'Generating...' : '⬇ Download PDF'}
            </button>
            <button
              onClick={handlePrint}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-gray-700 text-white rounded-xl hover:bg-gray-800 text-sm font-medium disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              {actionLoading && action === 'print' ? 'Preparing...' : '🖨 Print'}
            </button>
            <button
              onClick={handleShare}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              📤 Share
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">👦 Select Child</h2>
          {childrenList.length === 0 ? (
            <p className="text-sm text-gray-400">No children linked yet.</p>
          ) : (
            <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
              {childrenList.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedChildId(c.id); setSelectedTermId(''); }}
                  className={`flex-1 min-w-[150px] px-4 py-3 rounded-xl text-left transition-all border-2 ${
                    selectedChildId === c.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-gray-50 border-transparent hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <p className={`font-semibold text-sm ${selectedChildId === c.id ? 'text-blue-700' : 'text-gray-800'}`}>
                    {c.firstName} {c.lastName || ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.class || 'Not assigned'}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">📅 Select Term</h2>
          {!selectedChildId ? (
            <p className="text-sm text-gray-400">Select a child first to see available terms.</p>
          ) : (
            <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
              {termsList.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTermId(t.id)}
                  className={`flex-1 min-w-[130px] px-4 py-3 rounded-xl text-left transition-all border-2 ${
                    selectedTermId === t.id
                      ? 'bg-emerald-50 border-emerald-500'
                      : 'bg-gray-50 border-transparent hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <p className={`font-semibold text-sm ${selectedTermId === t.id ? 'text-emerald-700' : 'text-gray-800'}`}>
                    {t.name}
                  </p>
                  <p className={`text-xs mt-0.5 ${t.resultsLocked ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {t.resultsLocked ? '✓ Results Published' : 'Results Pending'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedChildId ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">👆</span>
          <p className="text-gray-500 mt-4">Select a child to view their report card</p>
        </div>
      ) : !selectedTermId ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">📅</span>
          <p className="text-gray-500 mt-4">Select a term to view the report card</p>
        </div>
      ) : resultsList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">📄</span>
          <p className="text-gray-500 mt-4">No report card data available for {selectedTerm?.name}</p>
          <p className="text-xs text-gray-400 mt-2">Results may not be published for this term yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900">{childName}</h2>
            <p className="text-sm text-gray-500">{selectedTerm?.name}</p>
            {selectedChild?.class && <p className="text-sm text-gray-500 mt-0.5">{selectedChild.class}</p>}
          </div>
          <div className="text-center mb-6">
            <span className={`text-4xl font-bold ${+avg >= 75 ? 'text-emerald-600' : +avg >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{avg}%</span>
            <p className="text-sm text-gray-500 mt-1">Overall Average</p>
          </div>
          <div className="overflow-x-auto">
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
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${score >= 75 ? 'bg-emerald-100 text-emerald-800' : score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>{score.toFixed(1)}%</span>
                      </td>
                      <td className="p-3 text-center text-sm text-gray-700">{r.grade || '-'}</td>
                      <td className="p-3 text-center text-sm text-gray-500">{r.remark || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => setViewerOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium active:scale-[0.97] transition-all"
            >
              👁 View Full Report Card
            </button>
            <p className="text-xs text-gray-400 mt-3">Signed in as {user?.firstName} {user?.lastName}</p>
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