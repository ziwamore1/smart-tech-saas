'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumApi, classApi, termApi } from '@/lib/api';

export default function Grade7Page() {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'compute' | 'results' | 'rankings'>('compute');
  const queryClient = useQueryClient();

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => { const res = await classApi.getAll(); return res.data?.data || res.data || []; },
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => { const res = await termApi.getAll(); return res.data?.data || res.data || []; },
  });

  const { data: currentTerm } = useQuery({
    queryKey: ['current-term'],
    queryFn: async () => { const res = await termApi.getCurrent(); return res.data?.data || res.data; },
  });

  const { data: grade7Results, refetch: refetchResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['grade7-results', selectedTermId],
    queryFn: async () => {
      if (!selectedTermId) return [];
      const res = await curriculumApi.getGrade7Results({ termId: selectedTermId });
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedTermId,
  });

  const { data: rankingsData } = useQuery({
    queryKey: ['grade7-rankings', selectedTermId],
    queryFn: async () => {
      if (!selectedTermId) return [];
      const res = await curriculumApi.getGrade7Results({ termId: selectedTermId });
      const raw = res.data?.data || res.data || [];
      return (raw as any[]).sort((a: any, b: any) => (b.totalStandardized || 0) - (a.totalStandardized || 0));
    },
    enabled: !!selectedTermId && activeTab === 'rankings',
  });

  const batchComputeMutation = useMutation({
    mutationFn: ({ classId, termId }: { classId: string; termId: string }) =>
      curriculumApi.batchComputeGrade7(classId, termId),
    onSuccess: (res: any) => {
      const data = res.data?.data || res.data;
      if (data?.results) {
        setMessage({ type: 'success', text: `Computed ${data.results.length} Grade 7 results` });
      } else {
        setMessage({ type: 'success', text: 'Batch computation completed' });
      }
      refetchResults();
    },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Computation failed' }),
  });

  const rankMutation = useMutation({
    mutationFn: ({ schoolId, termId }: { schoolId: string; termId: string }) =>
      curriculumApi.rankGrade7(schoolId, termId),
    onSuccess: () => { setMessage({ type: 'success', text: 'Rankings updated' }); refetchResults(); },
    onError: (err: any) => setMessage({ type: 'error', text: err?.response?.data?.message || 'Ranking failed' }),
  });

  const handleBatchCompute = () => {
    if (!selectedClassId || !selectedTermId) {
      setMessage({ type: 'error', text: 'Select both a class and term' });
      return;
    }
    batchComputeMutation.mutate({ classId: selectedClassId, termId: selectedTermId });
  };

  const currentTermId = currentTerm?.id || '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Grade 7 ECZ Management</h1>
        <p className="text-gray-500 mt-1">Compute standardized scores, manage results, and rank Grade 7 students for ECZ examination.</p>
      </div>

      {message && <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>{message.text}</div>}

      {/* Selectors */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade 7 Class</label>
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
              <option value="">Select Class</option>
              {(classes as any[])?.filter((c: any) => c.name?.includes('7') || c.levelType?.name?.includes('7')).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} {c.levelType?.name ? `(${c.levelType.name})` : ''}</option>
              ))}
              {(classes as any[])?.filter((c: any) => !c.name?.includes('7') && !c.levelType?.name?.includes('7')).length > 0 && (
                <optgroup label="All Classes">
                  {(classes as any[])?.filter((c: any) => !c.name?.includes('7') && !c.levelType?.name?.includes('7')).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
              <option value="">Select Term</option>
              {(terms as any[])?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}{t.id === currentTermId ? ' (Current)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={handleBatchCompute} disabled={!selectedClassId || !selectedTermId || batchComputeMutation.isPending} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {batchComputeMutation.isPending ? 'Computing...' : 'Compute Batch'}
            </button>
            <button onClick={() => {
              if (!selectedTermId) { setMessage({ type: 'error', text: 'Select a term first' }); return; }
              rankMutation.mutate({ schoolId: '', termId: selectedTermId });
            }} disabled={!selectedTermId || rankMutation.isPending} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {rankMutation.isPending ? 'Ranking...' : 'Rank Results'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['compute', 'results', 'rankings'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab === 'compute' ? 'Computation' : tab === 'results' ? 'Results' : 'Rankings'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'compute' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Batch Computation</h2>
          <p className="text-gray-500 mb-4">Select a Grade 7 class and term above, then click "Compute Batch" to calculate standardized ECZ scores using configured conversion rules.</p>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
            <p className="font-medium mb-1">Conversion Formula</p>
            <p className="font-mono text-xs">standardizedScore = (rawScore / actualMaxScore) × 100 + 50</p>
            <p className="mt-2 text-purple-600">The formula is configured per-subject in Conversion Rules. SP1 and SP2 are excluded from best-four selection.</p>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          {resultsLoading ? <div className="p-12 text-center text-gray-500">Loading results...</div> : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Student</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Std Score</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Composite</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Best 4</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Rank</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Division</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(grade7Results as any[])?.length > 0 ? (
                  (grade7Results as any[]).sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999)).map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{r.student?.firstName} {r.student?.lastName}</td>
                      <td className="px-6 py-4 text-center font-mono text-sm">{r.totalStandardized ?? '-'}</td>
                      <td className="px-6 py-4 text-center font-mono text-sm">{r.compositeScore ?? '-'}</td>
                      <td className="px-6 py-4 text-center font-mono text-sm">{r.bestFourScore ?? '-'}</td>
                      <td className="px-6 py-4 text-center font-mono text-sm">{r.rank ?? '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          r.division === 'DIV_1' ? 'bg-green-100 text-green-800' :
                          r.division === 'DIV_2' ? 'bg-blue-100 text-blue-800' :
                          r.division === 'DIV_3' ? 'bg-yellow-100 text-yellow-800' :
                          r.division === 'DIV_4' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>{r.division || '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${r.isEligible ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {r.isEligible ? 'ELIGIBLE' : '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {selectedTermId ? 'No results computed yet. Select a class and term, then run batch computation.' : 'Select a term to view results.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'rankings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Score Distribution</h2>
            <p className="text-sm text-gray-500">Total standardized scores across all computed Grade 7 students.</p>
            {rankingsData && (rankingsData as any[]).length > 0 && (
              <div className="mt-4 space-y-2">
                {(() => {
                  const scores = (rankingsData as any[]).map(r => r.totalStandardized || 0);
                  const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
                  const max = Math.max(...scores);
                  const min = Math.min(...scores);
                  return (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Average</span><span className="font-mono font-medium">{avg.toFixed(1)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Highest</span><span className="font-mono font-medium">{max}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Lowest</span><span className="font-mono font-medium">{min}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Total Students</span><span className="font-mono font-medium">{scores.length}</span></div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Division Breakdown</h2>
            {rankingsData && (rankingsData as any[]).length > 0 && (
              <div className="mt-4 space-y-2">
                {['DIV_1', 'DIV_2', 'DIV_3', 'DIV_4'].map((div) => {
                  const count = (rankingsData as any[]).filter(r => r.division === div).length;
                  const pct = ((count / (rankingsData as any[]).length) * 100).toFixed(1);
                  return (
                    <div key={div} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold w-14 text-center ${
                        div === 'DIV_1' ? 'bg-green-100 text-green-800' :
                        div === 'DIV_2' ? 'bg-blue-100 text-blue-800' :
                        div === 'DIV_3' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>{div.replace('_', ' ')}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3">
                        <div className={`h-3 rounded-full ${
                          div === 'DIV_1' ? 'bg-green-500' :
                          div === 'DIV_2' ? 'bg-blue-500' :
                          div === 'DIV_3' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm text-gray-500 w-16 text-right font-mono">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Rank</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Student</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Std Score</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Composite</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Best 4</th>
                  <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Division</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(rankingsData as any[])?.slice(0, 50).map((r: any, i: number) => (
                  <tr key={r.id || i} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-sm text-gray-500">{i + 1}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{r.student?.firstName} {r.student?.lastName}</td>
                    <td className="px-6 py-3 text-center font-mono">{r.totalStandardized ?? '-'}</td>
                    <td className="px-6 py-3 text-center font-mono">{r.compositeScore ?? '-'}</td>
                    <td className="px-6 py-3 text-center font-mono">{r.bestFourScore ?? '-'}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        r.division === 'DIV_1' ? 'bg-green-100 text-green-800' :
                        r.division === 'DIV_2' ? 'bg-blue-100 text-blue-800' :
                        r.division === 'DIV_3' ? 'bg-yellow-100 text-yellow-800' :
                        r.division === 'DIV_4' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>{r.division || '—'}</span>
                    </td>
                  </tr>
                ))}
                {(!rankingsData || (rankingsData as any[]).length === 0) && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No ranking data available. Compute results first.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
