'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resultAnalyticsApi, rankingApi, classApi, termApi, resultApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { checkEczEligibility } from '@/lib/ecz-eligibility';

export default function ResultAnalyticsPage() {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'at-risk' | 'rankings' | 'trends' | 'ecz'>('overview');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: classAnalytics } = useQuery({
    queryKey: ['class-analytics', selectedClass, selectedTerm],
    queryFn: () =>
      resultAnalyticsApi.class(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!(selectedClass && selectedTerm),
  });

  const { data: atRisk } = useQuery({
    queryKey: ['at-risk', selectedClass, selectedTerm],
    queryFn: () =>
      resultAnalyticsApi.atRisk(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!(selectedClass && selectedTerm),
  });

  const { data: topPerformers } = useQuery({
    queryKey: ['top-performers', selectedClass, selectedTerm],
    queryFn: () =>
      rankingApi.topPerformers(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!(selectedClass && selectedTerm),
  });

  const { data: schoolOverview } = useQuery({
    queryKey: ['school-overview', selectedTerm],
    queryFn: () =>
      resultAnalyticsApi.school(selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedTerm,
  });

  const { data: classResults } = useQuery({
    queryKey: ['class-results-ecy', selectedClass, selectedTerm],
    queryFn: () =>
      resultApi.getByClass(selectedClass, selectedTerm).then(r => r.data?.data || r.data || []),
    enabled: !!(selectedClass && selectedTerm),
  });

  const eczEligibilityData = useMemo(() => {
    if (!classResults || !Array.isArray(classResults) || classResults.length === 0) return null;
    const grouped: Record<string, { studentId: string; studentName: string; admissionNumber?: string; subjects: any[] }> = {};
    for (const r of classResults) {
      const sid = r.studentId || r.student?.id;
      if (!sid) continue;
      if (!grouped[sid]) {
        grouped[sid] = {
          studentId: sid,
          studentName: r.studentName || r.student?.firstName + ' ' + r.student?.lastName || r.student?.name || sid,
          admissionNumber: r.admissionNumber || r.student?.admissionNumber,
          subjects: [],
        };
      }
      grouped[sid].subjects.push({
        name: r.subject?.name || r.subjectName || 'Unknown',
        score: r.score ?? r.finalPercentage ?? 0,
        grade: r.grade ?? r.finalGrade ?? '-',
        points: r.points ?? 0,
        remark: r.remark ?? r.finalRemark ?? '-',
      });
    }
    const entries = Object.values(grouped).map((s) => ({
      ...s,
      eligibility: checkEczEligibility(s.subjects),
    }));
    entries.sort((a, b) => Number(b.eligibility.eligible) - Number(a.eligibility.eligible));
    return { total: entries.length, eligible: entries.filter((e) => e.eligibility.eligible).length, entries };
  }, [classResults]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: 'fa-chart-bar' },
    { id: 'at-risk' as const, label: 'At Risk', icon: 'fa-exclamation-triangle' },
    { id: 'rankings' as const, label: 'Rankings', icon: 'fa-trophy' },
    { id: 'trends' as const, label: 'School Trends', icon: 'fa-line-chart' },
    { id: 'ecz' as const, label: 'ECZ Eligibility', icon: 'fa-graduation-cap' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Results Analytics</h1>
        <p className="text-gray-500 mt-1">Performance insights, at-risk detection, and ranking analytics.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
            >
              <option value="">Select Term</option>
              {terms?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={`fa ${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {classAnalytics && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600">Class Average</p>
                      <p className="text-3xl font-bold text-blue-900">{classAnalytics.classAverage}%</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600">Students</p>
                      <p className="text-3xl font-bold text-green-900">{classAnalytics.totalStudents}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600">Subjects</p>
                      <p className="text-3xl font-bold text-purple-900">{classAnalytics.subjectStats?.length || 0}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-sm text-orange-600">Grade Distribution</p>
                      <p className="text-3xl font-bold text-orange-900">
                        {Object.keys(classAnalytics.gradeDistribution || {}).length}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Subject Performance</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Median</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pass Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distinction</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Std Dev</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {classAnalytics.subjectStats?.map((subject: any, i: number) => (
                            <tr key={subject.subjectId} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{subject.subjectName}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{subject.average}%</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{subject.median}%</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  subject.passRate >= 70 ? 'bg-green-100 text-green-800' :
                                  subject.passRate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {subject.passRate}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{subject.distinctionRate}%</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{subject.stdDev}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {!classAnalytics && (
                <div className="text-center py-12 text-gray-400">
                  <i className="fa fa-chart-bar text-4xl mb-4"></i>
                  <p>Select a class and term to view analytics</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'at-risk' && (
            <div className="space-y-4">
              {atRisk && atRisk.length > 0 ? (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      <i className="fa fa-exclamation-triangle mr-2"></i>
                      {atRisk.length} students identified as at-risk
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg %</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failing</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subjects</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {atRisk.map((student: any, i: number) => (
                          <tr key={student.studentId} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {student.studentName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{student.avgPercentage}%</td>
                            <td className="px-4 py-3 text-sm text-red-600 font-medium">{student.failingCount}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{student.failingSubjects?.join(', ')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                student.riskLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {student.riskLevel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-green-600">
                  <i className="fa fa-check-circle text-4xl mb-4"></i>
                  <p>No at-risk students identified</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'rankings' && (
            <div className="space-y-4">
              {topPerformers && topPerformers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adm No</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subjects</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {topPerformers.map((student: any, i: number) => (
                        <tr key={student.studentId} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                          <td className="px-4 py-3">
                            {i === 0 ? (
                              <span className="text-yellow-600 font-bold text-lg">🥇 {student.rank}</span>
                            ) : i === 1 ? (
                              <span className="text-gray-400 font-bold text-lg">🥈 {student.rank}</span>
                            ) : i === 2 ? (
                              <span className="text-orange-600 font-bold text-lg">🥉 {student.rank}</span>
                            ) : (
                              <span className="text-gray-600 font-medium">{student.rank}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.studentName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{student.admissionNumber}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{student.averagePercentage}%</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{student.subjectCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <i className="fa fa-trophy text-4xl mb-4"></i>
                  <p>Select a class and term to view rankings</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-6">
              {schoolOverview && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-600">School Average</p>
                      <p className="text-3xl font-bold text-blue-900">{schoolOverview.overallAverage}%</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-600">Total Results</p>
                      <p className="text-3xl font-bold text-green-900">{schoolOverview.totalResults}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-purple-600">Classes</p>
                      <p className="text-3xl font-bold text-purple-900">{schoolOverview.classStats?.length || 0}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Performance Comparison</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Students</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Average %</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pass Rate</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {schoolOverview.classStats?.map((cls: any, i: number) => (
                            <tr key={cls.classId} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{cls.className}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{cls.studentCount}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{cls.averagePercentage}%</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  cls.passRate >= 70 ? 'bg-green-100 text-green-800' :
                                  cls.passRate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {cls.passRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {!schoolOverview && (
                <div className="text-center py-12 text-gray-400">
                  <i className="fa fa-line-chart text-4xl mb-4"></i>
                  <p>Select a term to view school-wide trends</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ecz' && (
            <div className="space-y-6">
              {eczEligibilityData ? (
                <>
                  <div className={`rounded-lg p-4 ${eczEligibilityData.eligible === eczEligibilityData.total ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{eczEligibilityData.eligible === eczEligibilityData.total ? '🎓' : '📋'}</span>
                      <div>
                        <p className="font-semibold text-gray-900">
                          ECZ Certificate Eligibility Summary
                        </p>
                        <p className="text-sm text-gray-600">
                          {eczEligibilityData.eligible} of {eczEligibilityData.total} students eligible
                          {eczEligibilityData.eligible < eczEligibilityData.total && (
                            <span className="text-amber-600"> &mdash; {eczEligibilityData.total - eczEligibilityData.eligible} students need attention</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${eczEligibilityData.eligible / eczEligibilityData.total >= 0.8 ? 'bg-green-500' : eczEligibilityData.eligible / eczEligibilityData.total >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${(eczEligibilityData.eligible / eczEligibilityData.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Subjects</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Best 6 Pts</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">English</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Math</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {eczEligibilityData.entries.map((entry: any, i: number) => {
                          const e = entry.eligibility;
                          return (
                            <tr key={entry.studentId} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {entry.studentName}
                                {entry.admissionNumber && (
                                  <span className="text-xs text-gray-400 ml-1">({entry.admissionNumber})</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-600">{e.totalSubjects}</td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${e.bestSixTotal <= 36 ? 'text-green-600' : 'text-red-600'}`}>
                                {e.bestSixTotal}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={e.englishPassed ? 'text-green-600' : 'text-red-600'}>
                                  {entry.studentId ? (e.englishPassed ? '✓' : '✗') : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={e.mathPassed ? 'text-green-600' : 'text-red-600'}>
                                  {entry.studentId ? (e.mathPassed ? '✓' : '✗') : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                  e.eligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {e.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <i className="fa fa-graduation-cap text-4xl mb-4"></i>
                  <p>Select a class and term to view ECZ certificate eligibility</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
