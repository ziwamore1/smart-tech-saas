'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentApi, classApi, termApi, subjectApi, enrollmentApi } from '@/lib/api';

export default function AssessmentsPage() {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  const { data: classesResponse = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const data = res.data?.data || res.data?.classes || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: termsResponse = [] } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      const data = res.data?.data || res.data?.terms || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: subjectsResponse = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const classes = Array.isArray(classesResponse) ? classesResponse : [];
  const terms = Array.isArray(termsResponse) ? termsResponse : [];
  const subjects = Array.isArray(subjectsResponse) ? subjectsResponse : [];

  const { data: studentsData = [] } = useQuery({
    queryKey: ['class-students', selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return [];
      const res = await enrollmentApi.getByClass(selectedClass);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const students = Array.isArray(studentsData) ? studentsData : [];

  const { data: assessmentTypesData = [] } = useQuery({
    queryKey: ['assessment-types', selectedSubject, selectedTerm],
    queryFn: async () => {
      const res = await assessmentApi.getTypes({ subjectId: selectedSubject, termId: selectedTerm });
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedSubject && !!selectedTerm,
  });

  const assessmentTypes = Array.isArray(assessmentTypesData) ? assessmentTypesData : [];

  const studentIds = students.map((s: any) => s.student?.id || s.studentId);
  const studentIdsKey = studentIds.length > 0 ? studentIds.join(',') : '';

  const { data: existingScores = [] } = useQuery({
    queryKey: ['existing-scores', selectedAssessmentType, studentIdsKey],
    queryFn: async () => {
      if (!selectedAssessmentType || studentIds.length === 0) return [];
      const allScores: any[] = [];
      for (const studentId of studentIds) {
        const assessments = await assessmentApi.getStudentAssessments(studentId, selectedTerm);
        const typeScore = assessments.data?.find((a: any) => a.assessmentTypeId === selectedAssessmentType);
        if (typeScore) {
          allScores.push({ studentId, score: typeScore.score, id: typeScore.id });
        }
      }
      return allScores;
    },
    enabled: !!selectedAssessmentType && studentIds.length > 0,
  });

  const enterScoreMutation = useMutation({
    mutationFn: (data: { studentId: string; assessmentTypeId: string; score: number }) =>
      assessmentApi.enterScore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['existing-scores'] });
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save score' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const computeAllMutation = useMutation({
    mutationFn: () => assessmentApi.computeAllClass(selectedClass, selectedSubject, selectedTerm),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'All results computed!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to compute' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const handleScoreChange = (studentId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setScores(prev => ({ ...prev, [studentId]: numValue }));
  };

  const handleSaveAll = () => {
    const scoreEntries = Object.entries(scores).map(([studentId, score]) => ({
      studentId,
      assessmentTypeId: selectedAssessmentType,
      score,
    }));
    
    scoreEntries.forEach(entry => {
      if (entry.score > 0) {
        enterScoreMutation.mutate(entry);
      }
    });
    
    setMessage({ type: 'success', text: 'Scores saved!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const totalWeight = assessmentTypes.reduce((sum: number, t: any) => sum + t.weight, 0);
  const isComplete = Math.abs(totalWeight - 1.0) < 0.001;

  const currentTerm = terms.find((t: any) => t.id === selectedTerm);
  const isLocked = currentTerm?.resultsLocked ?? false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessment Entry</h1>
          <p className="text-gray-600 mt-1">Enter student scores for different assessment types</p>
        </div>
        {isLocked && (
          <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
            🔒 Term Locked
          </span>
        )}
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Class</option>
              {classes.map((cls: any) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
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
              {terms.map((term: any) => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedAssessmentType('');
              }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Subject</option>
              {subjects.map((subject: any) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Type *</label>
            <select
              value={selectedAssessmentType}
              onChange={(e) => setSelectedAssessmentType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={!selectedSubject || assessmentTypes.length === 0}
            >
              <option value="">Select Assessment</option>
              {assessmentTypes.map((type: any) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({(type.weight * 100).toFixed(0)}%)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedSubject && assessmentTypes.length > 0 && (
        <div className={`p-4 rounded-lg ${isComplete ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <p className={`text-sm ${isComplete ? 'text-green-700' : 'text-yellow-700'}`}>
            Assessment Types Total: {(totalWeight * 100).toFixed(0)}% 
            {isComplete ? '✓ Ready for computation' : '⚠ Must equal 100% for results'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {assessmentTypes.map((type: any) => (
              <span key={type.id} className="px-2 py-1 bg-white border rounded text-sm">
                {type.name}: {(type.weight * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {selectedAssessmentType && students.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold">Enter Scores</h2>
            <div className="flex gap-2">
              <button
                onClick={handleSaveAll}
                disabled={isLocked}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Save All Scores
              </button>
              {isComplete && (
                <button
                  onClick={() => computeAllMutation.mutate()}
                  disabled={isLocked || computeAllMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {computeAllMutation.isPending ? 'Computing...' : 'Compute Final Results'}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 w-16">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Student Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Admission No.</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Score ({assessmentTypes.find((t: any) => t.id === selectedAssessmentType)?.maxScore || 100})
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">%</th>
                </tr>
              </thead>
              <tbody>
                {students.map((enrollment: any, index: number) => {
                  const student = enrollment.student || enrollment;
                  const score = scores[student.id] || 0;
                  const maxScore = assessmentTypes.find((t: any) => t.id === selectedAssessmentType)?.maxScore || 100;
                  const percentage = maxScore > 0 ? ((score / maxScore) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={student.id} className="border-t hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                      <td className="py-3 px-4 font-medium">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{student.admissionNumber}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          max={maxScore}
                          value={score || ''}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          disabled={isLocked}
                          className="w-24 px-3 py-2 border rounded-lg text-center disabled:bg-gray-100"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-mono ${score >= 75 ? 'text-green-600' : score >= 50 ? 'text-blue-600' : 'text-red-600'}`}>
                          {percentage}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50 border-t">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Total Students: {students.length}</span>
              <span>
                Entered: {Object.values(scores).filter(s => s > 0).length} / {students.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedAssessmentType && students.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No students found in this class for the selected term
        </div>
      )}

      {!selectedAssessmentType && selectedClass && selectedTerm && selectedSubject && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500 mb-4">
            {assessmentTypes.length === 0 ? (
              <>
                <p className="text-lg mb-2">No Assessment Types Defined</p>
                <p className="text-sm">Go to Results Management → Assessment Types to add assessment types for this subject/term</p>
              </>
            ) : (
              <p>Select an assessment type to enter scores</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
