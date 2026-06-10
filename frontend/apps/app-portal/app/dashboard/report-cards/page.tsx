'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportCardEngineApi, classApi, termApi, studentApi } from '@/lib/api';
import { toast } from 'sonner';
import { checkEczEligibility } from '@/lib/ecz-eligibility';

export default function ReportCardsPage() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reportCard, setReportCard] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: students } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: () =>
      studentApi.getAll({ classId: selectedClass }).then(r => r.data?.data || r.data),
    enabled: !!selectedClass,
  });

  const { data: status } = useQuery({
    queryKey: ['report-card-status', selectedClass, selectedTerm],
    queryFn: () =>
      reportCardEngineApi.status(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!(selectedClass && selectedTerm),
  });

  const generateStudentMutation = useMutation({
    mutationFn: () =>
      reportCardEngineApi.student(selectedStudent, selectedTerm).then(r => r.data?.data || r.data),
    onSuccess: (data) => {
      setReportCard(data);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate report card');
    },
  });

  const generateBulkMutation = useMutation({
    mutationFn: () =>
      reportCardEngineApi.bulk(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    onSuccess: (data: any) => {
      toast.success(`${data?.length || 0} report cards generated`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate report cards');
    },
  });

  const handleGenerateStudent = () => {
    if (!selectedStudent || !selectedTerm) {
      toast.error('Please select student and term');
      return;
    }
    setLoading(true);
    generateStudentMutation.mutate(undefined, { onSettled: () => setLoading(false) });
  };

  const handleGenerateBulk = () => {
    if (!selectedClass || !selectedTerm) {
      toast.error('Please select class and term');
      return;
    }
    setLoading(true);
    generateBulkMutation.mutate(undefined, { onSettled: () => setLoading(false) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Report Cards</h1>
        <p className="text-gray-500 mt-1">Generate and preview student report cards.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedClass}
              onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); setReportCard(null); }}
            >
              <option value="">Select Class</option>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
            >
              <option value="">Select Student</option>
              {students?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleGenerateStudent}
              disabled={loading || !selectedStudent}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              <i className="fa fa-file-text mr-1"></i>Generate
            </button>
            <button
              onClick={handleGenerateBulk}
              disabled={loading || !selectedClass}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              <i className="fa fa-files-o mr-1"></i>Bulk
            </button>
          </div>
        </div>

        {status && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                <i className="fa fa-info-circle mr-1"></i>
                {status.studentsWithSummary}/{status.totalStudents} report cards ready
              </span>
              <span className={`font-medium ${status.readyForPublication ? 'text-green-600' : 'text-yellow-600'}`}>
                {status.completionRate.toFixed(1)}% complete
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${status.readyForPublication ? 'bg-green-600' : 'bg-yellow-600'}`}
                style={{ width: `${status.completionRate}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {reportCard && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Report Card Preview</h2>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              <i className="fa fa-print mr-1"></i>Print
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Student Report Card</h3>
              <p className="text-gray-500">{reportCard.academicYear?.name} - {reportCard.term?.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Student Name</p>
                <p className="font-medium">{reportCard.student?.firstName} {reportCard.student?.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Admission Number</p>
                <p className="font-medium">{reportCard.student?.admissionNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Class</p>
                <p className="font-medium">{reportCard.class?.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Attendance</p>
                <p className="font-medium">{reportCard.attendance?.attendanceRate?.toFixed(1) ?? 'N/A'}%</p>
              </div>
            </div>

            <table className="min-w-full divide-y divide-gray-200 mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">%</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Remark</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportCard.subjectBreakdown?.map((subject: any, i: number) => (
                  <tr key={subject.subjectId} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{subject.subjectName}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {subject.totalRawScore?.toFixed(1) ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {subject.finalPercentage?.toFixed(1) ?? '-'}%
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">
                      {subject.finalGrade ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {subject.points ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {subject.finalRemark ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {reportCard.division && (
              <div className="mb-4 p-3 rounded-lg text-center" style={{ backgroundColor: reportCard.division.color ? `${reportCard.division.color}15` : '#f3f4f6', borderColor: reportCard.division.color || '#d1d5db', borderWidth: 1 }}>
                <span className="text-sm text-gray-500">Overall Division</span>
                <p className="text-xl font-bold" style={{ color: reportCard.division.color || '#374151' }}>{reportCard.division.label || reportCard.division.division}</p>
              </div>
            )}

            {reportCard.bestSubjects && reportCard.bestSubjects.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">Best Subjects</h4>
                <div className="flex gap-4 flex-wrap">
                  {reportCard.bestSubjects.map((s: any) => (
                    <span key={s.subjectId} className={`px-3 py-1 bg-white rounded-full text-sm ${s.performanceCategory?.color ? '' : 'text-blue-800'}`} style={s.performanceCategory?.color ? { color: s.performanceCategory.color, borderColor: s.performanceCategory.color, borderWidth: 1 } : {}}>
                      {s.subjectName}: {s.points} pts
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm text-blue-800">
                  <strong>Total Points:</strong> {reportCard.totalPoints} | <strong>Average:</strong> {reportCard.bestSubjectsAverage?.toFixed(1)}%
                </p>
              </div>
            )}

            {reportCard.performanceCategory && (
              <div className="mb-4 p-3 rounded-lg text-center" style={{ backgroundColor: reportCard.performanceCategory.color ? `${reportCard.performanceCategory.color}15` : '#f3f4f6' }}>
                <span className="text-sm text-gray-500">Overall Performance</span>
                <p className="text-xl font-bold" style={{ color: reportCard.performanceCategory.color || '#374151' }}>{reportCard.performanceCategory.label}</p>
              </div>
            )}

            {reportCard.curriculum?.version && (
              <div className="text-xs text-gray-400 text-right mb-2">Curriculum: {reportCard.curriculum.version}{reportCard.curriculum.bestSubjectRule ? ` · Best ${reportCard.curriculum.bestSubjectRule.count} Rule: ${reportCard.curriculum.bestSubjectRule.name}` : ''}</div>
            )}

            {reportCard.termSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Overall %</p>
                  <p className="text-xl font-bold text-gray-900">{reportCard.termSummary.overallPercentage?.toFixed(1) ?? '-'}%</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Overall Grade</p>
                  <p className="text-xl font-bold text-gray-900">{reportCard.termSummary.overallGrade ?? '-'}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Class Rank</p>
                  <p className="text-xl font-bold text-gray-900">
                    {reportCard.termSummary.classRank ?? '-'} / {reportCard.termSummary.classSize ?? '-'}
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Total Points</p>
                  <p className="text-xl font-bold text-gray-900">{reportCard.termSummary.totalPoints ?? '-'}</p>
                </div>
              </div>
            )}

            {(() => {
              const className = reportCard.class?.name || reportCard.class?.levelType?.name || '';
              const isGrade7 = className.includes('7') || className.toLowerCase().includes('grade 7') || className.toLowerCase().includes('standard 7');
              if (isGrade7) {
                const eczSubjects = (reportCard.subjectBreakdown || []).map((s: any) => ({
                  name: s.subjectName,
                  score: s.finalPercentage ?? s.totalRawScore ?? 0,
                  grade: s.finalGrade ?? '-',
                  points: s.points ?? 0,
                  remark: s.finalRemark ?? '-',
                }));
                const ecz = checkEczEligibility(eczSubjects);
                return (
                  <div className={`mt-6 p-4 rounded-lg border-2 ${ecz.eligible ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{ecz.eligible ? '🎓' : '📋'}</span>
                        <div>
                          <h4 className={`font-semibold ${ecz.eligible ? 'text-green-800' : 'text-amber-800'}`}>
                            ECZ Certificate Eligibility
                          </h4>
                          <p className={`text-sm ${ecz.eligible ? 'text-green-700' : 'text-amber-700'}`}>{ecz.details}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${ecz.eligible ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                        {ecz.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">Subjects</p>
                        <p className="text-lg font-bold">{ecz.totalSubjects}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">Best 6 Total</p>
                        <p className={`text-lg font-bold ${ecz.bestSixTotal <= 36 ? 'text-green-600' : 'text-red-600'}`}>{ecz.bestSixTotal}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">English</p>
                        <p className={`text-lg font-bold ${ecz.englishPassed ? 'text-green-600' : 'text-red-600'}`}>{ecz.englishPassed ? '✓ Pass' : '✗ Fail'}</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded border">
                        <p className="text-xs text-gray-500">Mathematics</p>
                        <p className={`text-lg font-bold ${ecz.mathPassed ? 'text-green-600' : 'text-red-600'}`}>{ecz.mathPassed ? '✓ Pass' : '✗ Fail'}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-600 mb-1.5">Best 6 Subjects (lowest points):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {ecz.bestSix.map((s) => (
                          <span key={s.name} className={`px-2 py-0.5 bg-white rounded text-xs border ${s.points < 7 ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'}`}>
                            {s.name}: Grade {s.grade} ({s.points} pts)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
