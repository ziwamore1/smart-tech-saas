'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resultApi, termApi, studentApi, reportEngineApi } from '@/lib/api';
import Link from 'next/link';
import { checkEczEligibility, scoreToEczGrade } from '@/lib/ecz-eligibility';

export default function StudentResultsPage() {
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: studentData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => studentApi.getById('me').then(res => res.data),
    retry: false,
  });

  const { data: termsData } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(res => res.data),
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['my-results', selectedTermId],
    queryFn: () => resultApi.getByStudent('me', selectedTermId!).then(res => res.data),
    enabled: !!selectedTermId,
  });

  const student = studentData?.data || studentData;
  const terms = termsData?.data || termsData || [];
  const results = resultsData?.data || resultsData || [];

  const selectedTerm = terms.find((t: any) => t.id === selectedTermId);

  const getGradeColor = (score: number) => {
    if (score >= 75) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getGrade = (result: any) => {
    if (result?.grade) {
      return { letter: result.grade, remark: result.remark || '' };
    }
    const score = result?.score ?? 0;
    if (score >= 75) return { letter: 'A', remark: 'Distinction' };
    if (score >= 70) return { letter: 'B+', remark: 'Very Good' };
    if (score >= 65) return { letter: 'B', remark: 'Good' };
    if (score >= 60) return { letter: 'B-', remark: 'Above Average' };
    if (score >= 55) return { letter: 'C+', remark: 'Credit' };
    if (score >= 50) return { letter: 'C', remark: 'Satisfactory' };
    if (score >= 45) return { letter: 'D', remark: 'Pass' };
    if (score >= 40) return { letter: 'E', remark: 'Borderline' };
    return { letter: 'F', remark: 'Fail' };
  };

  const calculateAverage = () => {
    if (results.length === 0) return 0;
    const total = results.reduce((sum: number, r: any) => sum + r.score, 0);
    return (total / results.length).toFixed(1);
  };

  const calculateTotalPoints = () => {
    if (results.length === 0) return 0;
    return results.reduce((sum: number, r: any) => {
      const points = getGrade(r).letter;
      const pointValues: Record<string, number> = { 'A': 4, 'B+': 3.5, 'B': 3, 'B-': 2.75, 'C+': 2.5, 'C': 2, 'D': 1, 'E': 0.5, 'F': 0 };
      return sum + (pointValues[points] || 0);
    }, 0);
  };

  const getGPA = () => {
    if (results.length === 0) return 0;
    return (calculateTotalPoints() / results.length).toFixed(2);
  };

  const getPosition = () => {
    return results[0]?.classRank || null;
  };

  const downloadReportCard = async () => {
    if (!selectedTermId) return;
    setDownloading(true);
    try {
      const res = await reportEngineApi.generatePdf({
        type: 'REPORT_CARD',
        studentId: 'me',
        termId: selectedTermId,
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_Card_${selectedTerm?.name?.replace(/\s+/g, '_') || 'Current_Term'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || 'Failed to generate report card.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/student" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>My Results</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">My Results</h1>
          <p className="text-gray-600 mt-1">
            View your academic results by term
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Select Term</h2>
              <div className="space-y-2">
                {terms.map((term: any) => (
                  <button
                    key={term.id}
                    onClick={() => setSelectedTermId(term.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedTermId === term.id
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{term.name}</span>
                      {term.resultsLocked ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Published</span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Draft</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t">
                <h3 className="font-medium mb-3">Student Info</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium">{student?.firstName} {student?.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Class</span>
                    <span className="font-medium">{student?.class?.name || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {!selectedTermId ? (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="text-center py-12">
                  <span className="text-6xl">📋</span>
                  <h3 className="text-xl font-semibold mt-4">Select a Term</h3>
                  <p className="text-gray-500 mt-2">
                    Click on a term on the left to view your results.
                  </p>
                </div>
              </div>
            ) : resultsLoading ? (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading results...</span>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="text-center py-12">
                  <span className="text-6xl">📭</span>
                  <h3 className="text-xl font-semibold mt-4">No Results Available</h3>
                  <p className="text-gray-500 mt-2">
                    Results for {selectedTerm?.name} are not yet available.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedTerm?.name}</h2>
                      <p className="text-gray-500">{student?.class?.name} - {new Date().getFullYear()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {selectedTerm?.resultsLocked ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          Published
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          Draft
                        </span>
                      )}
                      <button
                        onClick={downloadReportCard}
                        disabled={downloading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
                      >
                        {downloading ? 'Generating...' : '📄 Download Report Card (PDF)'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Average</p>
                      <p className="text-3xl font-bold text-blue-600">{calculateAverage()}%</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">GPA</p>
                      <p className="text-3xl font-bold text-green-600">{getGPA()}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Total Points</p>
                      <p className="text-3xl font-bold text-purple-600">{calculateTotalPoints().toFixed(1)}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-500">Class Position</p>
                      <p className="text-3xl font-bold text-orange-600">#{getPosition() || '-'}</p>
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
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Remark</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {results.map((result: any, index: number) => {
                          const gradeInfo = getGrade(result);
                          return (
                            <tr key={result.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-medium text-gray-900">{result.subject?.name || 'Subject'}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className="text-lg font-semibold">{result.score?.toFixed(1)}%</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`px-3 py-1 rounded-full font-bold ${getGradeColor(result.score)}`}>
                                  {gradeInfo.letter}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center text-gray-600">
                                {gradeInfo.remark}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                {result.gradePoints || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Grading Scale Reference</h3>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {[
                      { grade: 'A', range: '75-100', remark: 'Distinction' },
                      { grade: 'B+', range: '70-74', remark: 'Very Good' },
                      { grade: 'B', range: '65-69', remark: 'Good' },
                      { grade: 'B-', range: '60-64', remark: 'Above Average' },
                      { grade: 'C+', range: '55-59', remark: 'Credit' },
                      { grade: 'C', range: '50-54', remark: 'Satisfactory' },
                      { grade: 'D', range: '45-49', remark: 'Pass' },
                      { grade: 'E', range: '40-44', remark: 'Borderline' },
                      { grade: 'F', range: '0-39', remark: 'Fail' },
                    ].map((g) => (
                      <div key={g.grade} className="text-center p-2 bg-gray-50 rounded">
                        <span className="font-bold text-lg">{g.grade}</span>
                        <p className="text-xs text-gray-500">{g.range}</p>
                        <p className="text-xs text-gray-600">{g.remark}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
