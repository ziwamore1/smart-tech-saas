'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/lib/api';

export default function ParentAssessments() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const { data: children } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList = Array.isArray(children) ? children : [];

  const { data: results } = useQuery({
    queryKey: ['parent-child-results-assessments', selectedChildId],
    queryFn: () => parentApi.getResults(selectedChildId).then(r => r.data?.data || r.data || []),
    enabled: !!selectedChildId,
  });

  const resultsList = Array.isArray(results) ? results : [];

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
        <p className="text-gray-500">View assessment scores for your children</p>
      </div>

      {childrenList.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {childrenList.map((c: any) => (
            <button key={c.id} onClick={() => setSelectedChildId(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${selectedChildId === c.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
              {c.firstName || c.name || 'Child'}
            </button>
          ))}
        </div>
      )}

      {!selectedChildId && childrenList.length > 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">👆</span>
          <p className="text-gray-500 mt-4">Select a child to view assessments</p>
        </div>
      ) : resultsList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">📊</span>
          <p className="text-gray-500 mt-4">No assessment data available</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {resultsList.map((r: any, i: number) => {
            const score = r.score || r.finalPercentage || 0;
            return (
              <div key={r.id || i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{r.subject?.name || r.subject || 'Subject'}</h3>
                    {r.assessmentName && <p className="text-sm text-gray-500">{r.assessmentName}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(score)}`}>{score.toFixed(1)}%</span>
                    {r.grade && <p className="text-xs text-gray-400 mt-1">Grade: {r.grade}</p>}
                  </div>
                </div>
                {r.remark && <p className="text-sm text-gray-500 mt-2 italic">{r.remark}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
