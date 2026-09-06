'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/lib/api';

export default function ParentAssessments() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [filter, setFilter] = useState<string>('');

  const { data: children } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList = (Array.isArray(children) ? children : []) as any[];

  useEffect(() => {
    if (!selectedChildId && childrenList.length > 0) {
      setSelectedChildId(childrenList[0].id);
    }
  }, [childrenList, selectedChildId]);

  const { data: results } = useQuery({
    queryKey: ['parent-child-results-assessments', selectedChildId],
    queryFn: () => selectedChildId
      ? parentApi.getResults(selectedChildId).then(r => r.data?.data || r.data || [])
      : Promise.resolve([]),
    enabled: !!selectedChildId,
  });

  const resultsList = (Array.isArray(results) ? results : []) as any[];

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'bg-emerald-100 text-emerald-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 50) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const subjects = [...new Set(resultsList.map((r: any) => r.subject))];
  const filtered = filter ? resultsList.filter((r: any) => r.subject === filter) : resultsList;

  return (
    <div className="px-4 py-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
        <p className="text-gray-500">Assessment scores, grades and remarks for your children</p>
      </div>

      {childrenList.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-600 mb-3">Select a child</p>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
            {childrenList.map((c: any) => (
              <button
                key={c.id}
                onClick={() => { setSelectedChildId(c.id); setFilter(''); }}
                className={`flex-1 min-w-[140px] px-4 py-3 rounded-xl text-left transition-all border-2 ${
                  selectedChildId === c.id
                    ? 'bg-purple-50 border-purple-500'
                    : 'bg-gray-50 border-transparent hover:border-gray-300 hover:bg-gray-100'
                }`}
              >
                <p className={`font-semibold text-sm ${selectedChildId === c.id ? 'text-purple-700' : 'text-gray-800'}`}>
                  {c.firstName} {c.lastName || ''}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{c.class || 'Not assigned'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!selectedChildId ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">👆</span>
          <p className="text-gray-500 mt-4">No children linked yet</p>
        </div>
      ) : resultsList.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">📊</span>
          <p className="text-gray-500 mt-4">No assessment data available yet</p>
          <p className="text-xs text-gray-400 mt-2">Published results will appear here.</p>
        </div>
      ) : (
        <>
          {subjects.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!filter ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                All
              </button>
              {subjects.map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === s ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((r: any, i: number) => {
              const score = r.score || r.finalPercentage || 0;
              return (
                <div key={r.id || i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{r.subject || 'Subject'}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{r.term}{r.academicYear ? ` · ${r.academicYear}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(score)}`}>{score.toFixed(1)}%</span>
                      {r.grade && <p className="text-xs text-gray-400 mt-1">Grade: {r.grade}</p>}
                    </div>
                  </div>
                  {r.remark && <p className="text-sm text-gray-500 mt-3 italic border-t border-gray-50 pt-3">{r.remark}</p>}
                  {(r.classRank != null || r.subjectRank != null) && (
                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                      {r.classRank != null && <span>🏫 Class rank: #{r.classRank}</span>}
                      {r.subjectRank != null && <span>📖 Subject rank: #{r.subjectRank}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}