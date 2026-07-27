'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentEngineApi, classApi, termApi, subjectApi, enrollmentApi } from '@/lib/api';
import { toast } from 'sonner';

export default function AssessmentsPage() {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedAssessmentDefId, setSelectedAssessmentDefId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const data = res.data?.data || res.data?.classes || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: terms = [] } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      const data = res.data?.data || res.data?.terms || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

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

  const { data: configurations = [] } = useQuery({
    queryKey: ['assessment-configs', selectedClass, selectedSubject, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedSubject || !selectedTerm) return [];
      const res = await assessmentEngineApi.configurations.get(selectedClass, selectedSubject, selectedTerm);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedClass && !!selectedSubject && !!selectedTerm,
  });

  const selectedConfig = configurations.find((c: any) => c.assessmentDefId === selectedAssessmentDefId);

  const { data: existingResults = [] } = useQuery({
    queryKey: ['class-results', selectedClass, selectedSubject, selectedTerm, selectedAssessmentDefId],
    queryFn: async () => {
      if (!selectedClass || !selectedSubject || !selectedTerm || !selectedAssessmentDefId) return [];
      const res = await assessmentEngineApi.results.class(selectedClass, selectedSubject, selectedTerm, selectedAssessmentDefId);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedClass && !!selectedSubject && !!selectedTerm && !!selectedAssessmentDefId,
  });

  const existingResultsMap = new Map<string, any>(
    (Array.isArray(existingResults) ? existingResults : []).map((r: any) => [r.studentId, r])
  );

  const bulkSaveMutation = useMutation({
    mutationFn: (data: any) => assessmentEngineApi.scores.bulk(data).then(r => r.data?.data || r.data),
    onSuccess: (data: any) => {
      toast.success(`${data.summary?.entered || 0} scores saved successfully`);
      queryClient.invalidateQueries({ queryKey: ['class-results'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save scores');
    },
  });

  const handleSaveAll = () => {
    if (!selectedClass || !selectedSubject || !selectedTerm || !selectedAssessmentDefId) {
      toast.error('Please select class, subject, term, and assessment type');
      return;
    }

    const scoresToSave = students
      .filter((enrollment: any) => {
        const student = enrollment.student || enrollment;
        return scores[student.id] !== undefined && scores[student.id] !== null;
      })
      .map((enrollment: any) => {
        const student = enrollment.student || enrollment;
        return {
          studentId: student.id,
          rawScore: scores[student.id],
        };
      })
      .filter((s: any) => s.rawScore !== undefined);

    if (scoresToSave.length === 0) {
      toast.error('No scores to save');
      return;
    }

    bulkSaveMutation.mutate({
      classId: selectedClass,
      subjectId: selectedSubject,
      termId: selectedTerm,
      assessmentDefId: selectedAssessmentDefId,
      maxScore: selectedConfig?.maxScore || 100,
      scores: scoresToSave,
    });
  };

  const currentTerm = terms.find((t: any) => t.isCurrent);
  const isLocked = currentTerm?.resultsLocked ?? false;
  const maxScore = selectedConfig?.maxScore || 100;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessment Entry</h1>
          <p className="text-gray-600 mt-1">Enter student scores for different assessment types</p>
        </div>
        {isLocked && (
          <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
            Term Locked
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
            <select
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); setSelectedAssessmentDefId(''); }}
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
              onChange={(e) => { setSelectedTerm(e.target.value); setSelectedAssessmentDefId(''); }}
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
              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedAssessmentDefId(''); }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Subject</option>
              {subjects.map((subject: any) => (
                <option key={subject.id} value={subject.id}>{subject.name} {subject.code ? `(${subject.code})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Type *</label>
            <select
              value={selectedAssessmentDefId}
              onChange={(e) => setSelectedAssessmentDefId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={!selectedClass || !selectedSubject || !selectedTerm || configurations.length === 0}
            >
              <option value="">
                {!selectedClass || !selectedSubject || !selectedTerm
                  ? 'Select Class, Subject & Term first'
                  : configurations.length === 0
                    ? 'No assessments configured'
                    : 'Select Assessment'}
              </option>
              {configurations.map((c: any) => (
                <option key={c.assessmentDefId} value={c.assessmentDefId}>
                  {c.assessmentDef?.name || 'Unknown'} ({c.weightPercentage}%, Max: {c.maxScore})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedSubject && configurations.length > 0 && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-700">
            Assessment Types Configured: {configurations.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {configurations.map((c: any) => (
              <span key={c.assessmentDefId} className={`px-2 py-1 border rounded text-sm ${c.assessmentDefId === selectedAssessmentDefId ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300'}`}>
                {c.assessmentDef?.name}: {c.weightPercentage}% (Max: {c.maxScore})
              </span>
            ))}
          </div>
        </div>
      )}

      {selectedAssessmentDefId && students.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              Enter Scores — {selectedConfig?.assessmentDef?.name}
              <span className="text-sm font-normal text-gray-500 ml-2">(Max: {maxScore})</span>
            </h2>
            <button
              onClick={handleSaveAll}
              disabled={isLocked || bulkSaveMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {bulkSaveMutation.isPending ? 'Saving...' : `Save All (${Object.keys(scores).length} scores)`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 w-16">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Student Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Admission No.</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Score (0-{maxScore})</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">%</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((enrollment: any, index: number) => {
                  const student = enrollment.student || enrollment;
                  const existing = existingResultsMap.get(student.id);
                  const score = scores[student.id] ?? existing?.rawScore ?? null;
                  const percentage = score !== null && score !== undefined ? ((score / maxScore) * 100).toFixed(1) : '-';

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
                          step="0.5"
                          value={score ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScores(prev => ({
                              ...prev,
                              [student.id]: val ? Number(val) : 0,
                            }));
                          }}
                          disabled={isLocked}
                          className="w-24 px-3 py-2 border rounded-lg text-center disabled:bg-gray-100"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-mono ${score !== null && score >= 75 ? 'text-green-600' : score !== null && score >= 50 ? 'text-blue-600' : 'text-red-600'}`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {existing?.isAbsent ? (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm font-medium">Absent</span>
                        ) : existing?.rawScore != null ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">Saved</span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">Pending</span>
                        )}
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
                Entered: {Object.keys(scores).length} / {students.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {selectedAssessmentDefId && students.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          No students found in this class for the selected term
        </div>
      )}

      {!selectedAssessmentDefId && selectedClass && selectedTerm && selectedSubject && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-500 mb-4">
            {configurations.length === 0 ? (
              <>
                <p className="text-lg mb-2">No Assessments Configured</p>
                <p className="text-sm">Go to Assessment Config to set up assessment types for this class/subject/term</p>
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
