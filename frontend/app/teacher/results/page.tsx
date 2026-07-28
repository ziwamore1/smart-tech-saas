'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { teacherApi, resultApi, termApi, subjectApi, assessmentApi, studentApi } from '@/lib/api';

export default function TeacherResultsPage() {
  const { user, isClassTeacher } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBulkEntry, setIsBulkEntry] = useState(false);

  const { data: teacherData } = useQuery({
    queryKey: ['my-teacher-profile'],
    queryFn: () => teacherApi.getById('me').then(res => res.data),
    retry: false,
  });

  const { data: classesResponse } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: async () => {
      const res = await teacherApi.getClasses();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: termsResponse } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.terms) data = data.terms;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: subjectsResponse } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.subjects) data = data.subjects;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? data : [];
    },
  });

  const classes = Array.isArray(classesResponse) ? classesResponse : [];
  const terms = Array.isArray(termsResponse) ? termsResponse : [];
  const subjects = Array.isArray(subjectsResponse) ? subjectsResponse : [];

  const { data: assessmentTypes } = useQuery({
    queryKey: ['assessment-types', selectedSubject, selectedTerm],
    queryFn: () => selectedSubject && selectedTerm 
      ? assessmentApi.getTypes({ subjectId: selectedSubject, termId: selectedTerm }).then(res => res.data)
      : Promise.resolve([]),
    enabled: !!selectedSubject && !!selectedTerm,
  });

  const teacher = teacherData?.data || teacherData;
  const assignedClass = teacher?.classTeacherOf;
  const teachingSubjects = teacher?.subjects || [];

  const { data: studentsData } = useQuery({
    queryKey: ['class-students', selectedClass],
    queryFn: () => selectedClass 
      ? studentApi.getAll({ limit: 100 }).then(res => {
          const students = res.data?.data || res.data?.students || [];
          return students.filter((s: any) => 
            s.enrollments?.some((e: any) => e.classId === selectedClass && e.isActive)
          );
        })
      : Promise.resolve([]),
    enabled: !!selectedClass,
  });

  const { data: existingResults } = useQuery({
    queryKey: ['results', selectedClass, selectedTerm, selectedSubject],
    queryFn: () => selectedClass && selectedTerm && selectedSubject
      ? resultApi.getAll({ classId: selectedClass, termId: selectedTerm, subjectId: selectedSubject }).then(res => res.data)
      : Promise.resolve([]),
    enabled: !!selectedClass && !!selectedTerm && !!selectedSubject,
  }) as any;

  const enterScoreMutation = useMutation({
    mutationFn: (data: { studentId: string; score: number }) => {
      if (selectedAssessmentType) {
        return assessmentApi.enterScore({
          studentId: data.studentId,
          assessmentTypeId: selectedAssessmentType,
          score: data.score,
        });
      }
      return resultApi.create({
        studentId: data.studentId,
        subjectId: selectedSubject,
        termId: selectedTerm,
        score: data.score,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      setMessage({ type: 'success', text: 'Score saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save score' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const bulkEnterScoresMutation = useMutation({
    mutationFn: (scoreList: Array<{ studentId: string; score: number }>) => {
      if (selectedAssessmentType) {
        return assessmentApi.enterBulkScores(
          scoreList.map(s => ({
            studentId: s.studentId,
            assessmentTypeId: selectedAssessmentType,
            score: s.score,
          }))
        );
      }
      return resultApi.createBulk(
        scoreList.map(s => ({
          studentId: s.studentId,
          subjectId: selectedSubject,
          termId: selectedTerm,
          score: s.score,
        }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      setScores({});
      setMessage({ type: 'success', text: 'All scores saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save scores' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const computeResultMutation = useMutation({
    mutationFn: (classId: string) => assessmentApi.computeAllClass(classId, selectedSubject, selectedTerm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      setMessage({ type: 'success', text: 'Results computed successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to compute results' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const students = studentsData || [];
  const existingResultsMap: Map<string, any> = new Map(
    (existingResults || []).map((r: any) => [r.studentId, r])
  );

  const handleSaveAll = () => {
    const scoreList = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .map(([studentId, score]) => ({ studentId, score }));
    
    if (scoreList.length === 0) {
      setMessage({ type: 'error', text: 'Please enter at least one score' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    bulkEnterScoresMutation.mutate(scoreList);
  };

  const getGradeColor = (score: number) => {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getGrade = (result: any, score: number) => {
    if (result?.grade) return result.grade;
    if (score >= 75) return 'A';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  };

  const currentTerm = terms?.find((t: any) => t.isCurrent);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/teacher" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Results</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Enter Results</h1>
        <p className="text-gray-600 mt-1">
          Enter and manage student results for your subjects
        </p>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Class</option>
              {classes?.map((cls: any) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}{isClassTeacher && cls.id === assignedClass?.id ? ' (Your Class)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term *</label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Term</option>
              {currentTerm && <option value={currentTerm.id}>{currentTerm.name} (Current)</option>}
              {terms?.filter((t: any) => !t.isCurrent).map((term: any) => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Subject</option>
              {teachingSubjects.map((subject: any) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
              {subjects?.map((subject: any) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Type</label>
            <select
              value={selectedAssessmentType}
              onChange={(e) => setSelectedAssessmentType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Direct (Final Score)</option>
              {(assessmentTypes || []).map((type: any) => (
                <option key={type.id} value={type.id}>{type.name} ({type.weight * 100}%)</option>
              ))}
            </select>
          </div>
        </div>

        {(selectedAssessmentType || isBulkEntry) && (
          <div className="mt-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isBulkEntry}
                onChange={(e) => setIsBulkEntry(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">Bulk Entry Mode (Save All at Once)</span>
            </label>
          </div>
        )}
      </div>

      {selectedClass && selectedTerm && selectedSubject && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Enter Scores - {subjects?.find((s: any) => s.id === selectedSubject)?.name}
            </h2>
            <div className="flex gap-2">
              {assessmentTypes?.length > 0 && selectedSubject && (
                <button
                  onClick={() => computeResultMutation.mutate(selectedClass)}
                  disabled={computeResultMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  Compute Final Results
                </button>
              )}
              {isBulkEntry && Object.keys(scores).length > 0 && (
                <button
                  onClick={handleSaveAll}
                  disabled={bulkEnterScoresMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  Save All Scores
                </button>
              )}
            </div>
          </div>

          {students.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl">👥</span>
              <p className="text-gray-500 mt-2">No students found in this class.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Admission #</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Student Name</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Current Score</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Grade</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">
                      {isBulkEntry ? 'Enter Score' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student: any, index: number) => {
                    const existing: any = existingResultsMap.get(student.id);
                    const currentScore = scores[student.id] ?? existing?.score ?? 0;
                    
                    return (
                      <tr key={student.id} className="border-t hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                        <td className="py-3 px-4 font-mono text-sm">{student.admissionNumber}</td>
                        <td className="py-3 px-4 font-medium">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {existing ? (
                            <span className="font-semibold">{existing.score?.toFixed(1) || '-'}</span>
                          ) : (
                            <span className="text-gray-400">Not entered</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {currentScore > 0 ? (
                            <span className={`px-2 py-1 rounded text-sm font-medium ${getGradeColor(currentScore)}`}>
                              {getGrade(existing, currentScore)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isBulkEntry ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={scores[student.id] ?? ''}
                              onChange={(e) => setScores({
                                ...scores,
                                [student.id]: Number(e.target.value),
                              })}
                              className="w-20 px-2 py-1 border rounded text-center"
                              placeholder="0-100"
                            />
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                id={`score-${student.id}`}
                                className="w-20 px-2 py-1 border rounded text-center"
                                placeholder="0-100"
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`score-${student.id}`) as HTMLInputElement;
                                  const score = Number(input.value);
                                  if (score >= 0 && score <= 100) {
                                    enterScoreMutation.mutate({ studentId: student.id, score });
                                    input.value = '';
                                  }
                                }}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                Save
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {teachingSubjects.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <span className="text-4xl">⚠️</span>
          <h3 className="text-lg font-semibold mt-4">No Subjects Assigned</h3>
          <p className="text-gray-600 mt-2">
            You don't have any subjects assigned. Contact the director to assign subjects to you.
          </p>
        </div>
      )}
    </div>
  );
}
