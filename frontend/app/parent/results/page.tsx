'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { studentApi, termApi, resultApi } from '@/lib/api';
import { checkEczEligibility, scoreToEczGrade } from '@/lib/ecz-eligibility';

export default function ParentResultsPage() {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  const { data: childrenData } = useQuery({
    queryKey: ['my-children'],
    queryFn: () => studentApi.getByParent('me').then(res => res.data),
    retry: false,
  });

  const { data: termsData } = useQuery<any>({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(res => res.data),
  });

  const children: any[] = (childrenData as any)?.data || childrenData || [];
  const terms: any[] = termsData?.data || termsData || [];

  const { data: resultsData } = useQuery({
    queryKey: ['child-results', selectedChild, selectedTermId],
    queryFn: () => selectedChild && selectedTermId
      ? resultApi.getByStudent(selectedChild, selectedTermId).then(res => res.data)
      : Promise.resolve([]),
    enabled: !!selectedChild && !!selectedTermId,
  });

  const results = resultsData?.data || resultsData || [];
  const selectedChildData = children.find((c: any) => c.id === selectedChild);

  const getGradeColor = (score: number) => {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getGrade = (score: number) => {
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  };

  const calculateAverage = () => {
    if (results.length === 0) return 0;
    const total = results.reduce((sum: number, r: any) => sum + r.score, 0);
    return (total / results.length).toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/parent" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Results</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Children&apos;s Results</h1>
        <p className="text-gray-600 mt-1">
          View academic results for your children
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm sticky top-4">
            <h2 className="text-lg font-semibold mb-4">Select Child</h2>
            <div className="space-y-2 mb-6">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => {
                    setSelectedChild(child.id);
                    setSelectedTermId(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedChild === child.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{child.firstName} {child.lastName}</p>
                  <p className="text-sm text-gray-500">{child.class?.name || 'Not assigned'}</p>
                </button>
              ))}
            </div>

            {selectedChild && (
              <>
                <h3 className="text-lg font-semibold mb-4">Select Term</h3>
                <div className="space-y-2">
                  {terms.map((term) => (
                    <button
                      key={term.id}
                      onClick={() => setSelectedTermId(term.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedTermId === term.id
                          ? 'bg-green-50 border-2 border-green-500'
                          : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">{term.name}</p>
                      <p className="text-xs text-gray-500">
                        {term.resultsLocked ? '✓ Results Published' : 'Results Pending'}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          {!selectedChild ? (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="text-center py-12">
                <span className="text-6xl">👈</span>
                <h3 className="text-xl font-semibold mt-4">Select a Child</h3>
                <p className="text-gray-500 mt-2">
                  Choose a child from the left to view their results.
                </p>
              </div>
            </div>
          ) : !selectedTermId ? (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="text-center py-12">
                <span className="text-6xl">📅</span>
                <h3 className="text-xl font-semibold mt-4">Select a Term</h3>
                <p className="text-gray-500 mt-2">
                  Choose a term above to view results.
                </p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="text-center py-12">
                <span className="text-6xl">📭</span>
                <h3 className="text-xl font-semibold mt-4">No Results Available</h3>
                <p className="text-gray-500 mt-2">
                  Results for this term are not yet published.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedChildData?.firstName} {selectedChildData?.lastName}
                    </h2>
                    <p className="text-gray-500">
                      {selectedChildData?.class?.name} - {terms.find((t: any) => t.id === selectedTermId)?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Average Score</p>
                    <p className="text-3xl font-bold text-blue-600">{calculateAverage()}%</p>
                  </div>
                </div>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Highest</p>
                      <p className="text-xl font-bold text-green-600">
                        {Math.max(...results.map((r: any) => r.score)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Lowest</p>
                      <p className="text-xl font-bold text-red-600">
                        {Math.min(...results.map((r: any) => r.score)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Subjects</p>
                      <p className="text-xl font-bold text-purple-600">{results.length}</p>
                    </div>
                  </div>

                  {(() => {
                    const eczSubjects = results.map((r: any) => {
                      const ecz = scoreToEczGrade(r.score);
                      return { name: r.subject?.name || 'Subject', score: r.score, ...ecz };
                    });
                    const ecz = checkEczEligibility(eczSubjects);
                    return (
                      <div className={`mt-4 p-4 rounded-lg border-2 ${ecz.eligible ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{ecz.eligible ? '🎓' : '📋'}</span>
                            <div>
                              <h4 className={`font-semibold text-sm ${ecz.eligible ? 'text-green-800' : 'text-amber-800'}`}>
                                ECZ Certificate Eligibility
                              </h4>
                              <p className={`text-xs ${ecz.eligible ? 'text-green-700' : 'text-amber-700'}`}>{ecz.details}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ecz.eligible ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                            {ecz.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ecz.bestSix.map((s) => (
                            <span key={s.name} className={`px-1.5 py-0.5 rounded text-xs border ${s.points < 7 ? 'border-green-200 text-green-700 bg-white' : 'border-red-200 text-red-700 bg-white'}`}>
                              {s.name}: Grade {s.grade} ({s.points} pts)
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h3 className="text-lg font-semibold">Subject Results</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">Subject</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Score</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Grade</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.map((result: any) => (
                        <tr key={result.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6 font-medium text-gray-900">
                            {result.subject?.name || 'Subject'}
                          </td>
                          <td className="py-4 px-4 text-center text-lg font-semibold">
                            {result.score?.toFixed(1)}%
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-3 py-1 rounded-full font-bold ${getGradeColor(result.score)}`}>
                              {getGrade(result.score)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`text-sm ${
                              result.score >= 50 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {result.score >= 50 ? 'Passed' : 'Needs Improvement'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">Contact School</h3>
                <p className="text-sm text-blue-700">
                  For concerns about your child&apos;s results, please contact the school directly or reach out to the class teacher.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
