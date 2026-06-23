'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi, resultApi } from '@/lib/api';

export default function ParentAnalytics() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const { data: children } = useQuery({
    queryKey: ['parent-children'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const childrenList = Array.isArray(children) ? children : [];

  const { data: results } = useQuery({
    queryKey: ['parent-child-analytics', selectedChildId],
    queryFn: () => parentApi.getResults(selectedChildId).then(r => r.data?.data || r.data || []),
    enabled: !!selectedChildId,
  });

  const resultsList = Array.isArray(results) ? results : [];
  const avg = resultsList.length > 0 ? (resultsList.reduce((s: number, r: any) => s + (r.score || r.finalPercentage || 0), 0) / resultsList.length) : 0;
  const strongSubjects = resultsList.filter((r: any) => (r.score || r.finalPercentage || 0) >= 75);
  const weakSubjects = resultsList.filter((r: any) => (r.score || r.finalPercentage || 0) < 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Analytics</h1>
        <p className="text-gray-500">Track and analyze your children&apos;s performance</p>
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
          <p className="text-gray-500 mt-4">Select a child to view analytics</p>
        </div>
      ) : resultsList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <span className="text-5xl">📊</span>
          <p className="text-gray-500 mt-4">No analytics data available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <p className={`text-5xl font-bold ${avg >= 75 ? 'text-green-600' : avg >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{avg.toFixed(1)}%</p>
              <p className="text-gray-500 mt-1">Overall Average</p>
              <p className="text-sm text-gray-400 mt-1">{resultsList.length} subjects</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">💪 Strengths</h3>
              {strongSubjects.length === 0 ? (
                <p className="text-sm text-gray-400">No subjects above 75%</p>
              ) : (
                strongSubjects.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{r.subject?.name || r.subject || 'Subject'}</span>
                    <span className="text-sm font-semibold text-green-600">{Math.round(r.score || r.finalPercentage || 0)}%</span>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">🎯 Areas to Improve</h3>
              {weakSubjects.length === 0 ? (
                <p className="text-sm text-green-600">All subjects above 50%! Great job!</p>
              ) : (
                weakSubjects.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{r.subject?.name || r.subject || 'Subject'}</span>
                    <span className="text-sm font-semibold text-red-600">{Math.round(r.score || r.finalPercentage || 0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Subject Performance Breakdown</h3>
              <div className="space-y-4">
                {resultsList.map((r: any, i: number) => {
                  const score = r.score || r.finalPercentage || 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{r.subject?.name || r.subject || 'Subject'}</span>
                        <span className={`text-sm font-semibold ${score >= 75 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{score.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(score, 100)}%` }} />
                      </div>
                      {r.grade && <p className="text-xs text-gray-400 mt-1">Grade: {r.grade} {r.remark ? `- ${r.remark}` : ''}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Performance Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{strongSubjects.length}</p>
                  <p className="text-xs text-green-800">Strong Subjects (≥75%)</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{resultsList.length - strongSubjects.length - weakSubjects.length}</p>
                  <p className="text-xs text-yellow-800">Satisfactory (50-74%)</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{weakSubjects.length}</p>
                  <p className="text-xs text-red-800">Needs Support (&lt;50%)</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{resultsList.length}</p>
                  <p className="text-xs text-blue-800">Total Subjects</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
