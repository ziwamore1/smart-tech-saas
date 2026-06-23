'use client';

import { useQuery } from '@tanstack/react-query';
import { reportCardApi, termApi, resultApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function StudentReportCards() {
  const { user } = useAuth();

  const { data: termRes } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const currentTerm = termRes?.data;
  const termId = currentTerm?.id;

  const { data: resultsData } = useQuery({
    queryKey: ['my-results-report', termId],
    queryFn: () => resultApi.getByStudent('me', termId).then(r => r.data),
    enabled: !!termId,
  });

  const results = resultsData?.data || resultsData || [];
  const avg = Array.isArray(results) && results.length > 0
    ? (results.reduce((s: number, r: any) => s + (r.score || 0), 0) / results.length).toFixed(1)
    : '0.0';

  const handleDownloadPDF = async () => {
    if (!user?.id || !termId) return;
    try {
      const blob = await reportCardApi.downloadReportCardPdf(String(user.id), termId);
      const url = window.URL.createObjectURL(blob as Blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `Report_Card_${termId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      window.open(`/report-card/${user.id}/${termId}/pdf`, '_blank');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
          <p className="text-gray-500">{currentTerm?.name || 'Current Term'}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">⬇ Download PDF</button>
          <button onClick={handlePrint} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">🖨 Print</button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-gray-900">{user?.firstName} {user?.lastName}</h2>
          <p className="text-gray-500">{currentTerm?.name} • {new Date().toLocaleDateString()}</p>
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
          </>
        )}
      </div>
    </div>
  );
}
