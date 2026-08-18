'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, teacherApi, resultApi, termApi, subjectApi, assessmentApi, assessmentEngineApi, studentApi } from '@/lib/api';
import { socket } from '@/lib/socket';

const PASS_THRESHOLD = 50;

function getGradeColor(score: number) {
  if (score >= 75) return 'bg-green-100 text-green-800';
  if (score >= PASS_THRESHOLD) return 'bg-blue-100 text-blue-800';
  return 'bg-red-100 text-red-800';
}

function getGrade(result: any, score: number) {
  if (result?.grade) return result.grade;
  if (score >= 75) return 'A';
  if (score >= PASS_THRESHOLD) return 'C';
  return 'F';
}

type EntryMode = 'single' | 'multi' | 'class';

export default function TeacherResultsPage() {
  const { user, isClassTeacher } = useAuth();
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedAssessmentType, setSelectedAssessmentType] = useState('');
  const [entryMode, setEntryMode] = useState<EntryMode>('single');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [absentCells, setAbsentCells] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isBulkEntry, setIsBulkEntry] = useState(false);

  useEffect(() => {
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    const eventName = `result:updated:${schoolId}`;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['class-students'] });
      queryClient.invalidateQueries({ queryKey: ['sheet-students-teacher'] });
    };
    socket.on(eventName, handler);

    const savedHandler = (data: any) => {
      if (selectedClass && data.classId === selectedClass && selectedTerm && data.termId === selectedTerm) {
        queryClient.invalidateQueries({ queryKey: ['results'] });
        queryClient.invalidateQueries({ queryKey: ['sheet-students-teacher'] });
      }
    };
    socket.on('results:saved', savedHandler);

    return () => { socket.off(eventName, handler); socket.off('results:saved', savedHandler); };
  }, [user?.schoolId, selectedClass, selectedTerm, queryClient]);

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

  const { data: assessmentConfigs = [] } = useQuery({
    queryKey: ['assessment-configs', selectedClass, selectedSubject, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedSubject || !selectedTerm || selectedSubject === 'all') return [];
      const res = await assessmentEngineApi.configurations.get(selectedClass, selectedSubject, selectedTerm);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedClass && !!selectedSubject && !!selectedTerm && selectedSubject !== 'all',
  });

  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subjects-teacher', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const r = await fetch(`/api/v1/class-subjects/class/${selectedClass}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
      });
      const json = await r.json();
      return json?.data || json || [];
    },
    enabled: !!selectedClass,
  });

  const teacher = teacherData?.data || teacherData;
  const assignedClass = teacher?.classTeacherOf;
  const teachingSubjects = teacher?.subjects || [];
  const classSubjects = Array.isArray(classSubjectsData) ? classSubjectsData : [];

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

  const { data: sheetStudentsData } = useQuery({
    queryKey: ['sheet-students-teacher', selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return [];
      try {
        const r = await api.get('/results-management/sheets', { params: { classId: selectedClass, termId: selectedTerm } });
        const sheets = r.data?.data || r.data;
        const sheetArr = Array.isArray(sheets) ? sheets : [];
        const sheetId = sheetArr.length > 0 ? sheetArr[0].id : null;
        if (sheetId) {
          const sr = await api.get(`/results-management/sheets/${sheetId}/students`);
          let sd = sr.data?.data || sr.data;
          if (sd && !Array.isArray(sd) && sd.students) sd = sd.students;
          return Array.isArray(sd) ? sd : [];
        }
      } catch { /* ignore */ }
      return [];
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: existingResults } = useQuery({
    queryKey: ['results', selectedClass, selectedTerm, selectedSubject],
    queryFn: () => selectedClass && selectedTerm && selectedSubject
      ? resultApi.getAll({ classId: selectedClass, termId: selectedTerm, subjectId: selectedSubject }).then(res => res.data)
      : Promise.resolve([]),
    enabled: !!selectedClass && !!selectedTerm && (entryMode === 'single' || selectedSubject !== 'all'),
  }) as any;

  const enterScoreMutation = useMutation({
    mutationFn: (data: { studentId: string; score: number }) => {
      if (selectedAssessmentType) {
        const config = assessmentConfigs.find((c: any) => c.assessmentDefId === selectedAssessmentType);
        return assessmentEngineApi.scores.single({
          studentId: data.studentId,
          subjectId: selectedSubject,
          termId: selectedTerm,
          classId: selectedClass,
          assessmentDefId: selectedAssessmentType,
          rawScore: data.score,
          maxScore: config?.maxScore || 100,
          enteredBy: user?.id || '',
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
      queryClient.invalidateQueries({ queryKey: ['sheet-students-teacher'] });
      setMessage({ type: 'success', text: 'Score saved and auto-submitted for review!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save score' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const bulkEnterScoresMutation = useMutation({
    mutationFn: (scoreList: Array<{ studentId: string; subjectId: string; score: number }>) =>
      resultApi.createBulk(
        scoreList.map(s => ({
          studentId: s.studentId,
          subjectId: s.subjectId,
          termId: selectedTerm,
          score: s.score,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['sheet-students-teacher'] });
      setScores({});
      setMessage({ type: 'success', text: 'All scores saved and auto-submitted for review!' });
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
      queryClient.invalidateQueries({ queryKey: ['sheet-students-teacher'] });
      setMessage({ type: 'success', text: 'Results computed successfully!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to compute results' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const students = studentsData || [];

  // Merge results from sheets endpoint (shows all statuses: DRAFT, SUBMITTED, COMPUTED, etc.)
  const sheetStudents: any[] = sheetStudentsData || [];
  const sheetResultsMap = new Map<string, any>();
  for (const s of sheetStudents) {
    for (const r of (s.results || [])) {
      const key = `${s.id}-${r.subjectId || r.subject?.id}`;
      sheetResultsMap.set(key, {
        studentId: s.id,
        subjectId: r.subjectId || r.subject?.id,
        score: r.score ?? r.finalPercentage ?? r.totalRawScore ?? null,
        grade: r.grade || r.finalGrade || null,
        remark: r.remark || r.finalRemark || null,
        points: r.points ?? null,
      });
    }
  }

  const existingResultsArray: any[] = existingResults || [];
  const existingResultsMap: Map<string, any> = new Map(
    existingResultsArray.map((r: any) => [`${r.studentId}-${r.subjectId}`, r])
  );
  // Merge: sheet results fill in gaps where legacy results are missing
  for (const [key, val] of sheetResultsMap) {
    if (!existingResultsMap.has(key)) existingResultsMap.set(key, val);
  }

  // Determine which subjects to show based on entry mode
  const displaySubjects = entryMode === 'class'
    ? classSubjects
    : selectedSubject === 'all'
      ? teachingSubjects
      : teachingSubjects.filter((s: any) => s.id === selectedSubject || s.subjectId === selectedSubject);

  const handleSaveAll = () => {
    const scoreList: Array<{ studentId: string; subjectId: string; score: number }> = [];

    absentCells.forEach(key => {
      const [studentId, subjectId] = key.split('|');
      scoreList.push({ studentId, subjectId, score: 0 });
    });

    Object.entries(scores)
      .filter(([, score]) => score >= 0)
      .forEach(([key, score]) => {
        const [studentId, subjectId] = key.split('|');
        const absentKey = `${studentId}|${subjectId}`;
        if (!absentCells.has(absentKey)) {
          scoreList.push({ studentId, subjectId, score });
        }
      });

    if (scoreList.length === 0) {
      setMessage({ type: 'error', text: 'Please enter at least one score' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    bulkEnterScoresMutation.mutate(scoreList);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Enter Results</h1>
            <p className="text-gray-600 mt-1">Enter and manage student results</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setEntryMode('single'); setSelectedSubject('all'); }}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${entryMode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <i className="fa fa-edit mr-1"></i> Single Subject
            </button>
            {teachingSubjects.length > 1 && (
              <button
                onClick={() => { setEntryMode('multi'); setSelectedSubject('all'); }}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${entryMode === 'multi' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <i className="fa fa-layer-group mr-1"></i> Multi Subject
              </button>
            )}
            {isClassTeacher && (
              <button
                onClick={() => { setEntryMode('class'); setSelectedSubject('all'); }}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${entryMode === 'class' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <i className="fa fa-users mr-1"></i> Class Bulk
              </button>
            )}
          </div>
        </div>
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

      {/* Entry Mode Description */}
      <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <i className="fa fa-info-circle mr-2"></i>
        {entryMode === 'single' && 'Mode A: Single Subject — You can enter marks for one subject at a time. Select a subject below.'}
        {entryMode === 'multi' && `Mode B: Multi Subject — You teach ${teachingSubjects.length} subjects. All your subjects are shown.`}
        {entryMode === 'class' && `Mode C: Class Teacher Bulk — ${classSubjects.length} subjects loaded for your class. Enter all at once.`}
        <span className="ml-2 text-amber-700 font-semibold">
          <i className="fa fa-user-slash mr-1"></i>Type <strong>X</strong> or <strong>A</strong> to mark a learner absent.
        </span>
      </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject {entryMode === 'class' ? `(All ${classSubjects.length} subjects)` : '*'}
            </label>
            {entryMode === 'class' ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-600">
                <i className="fa fa-check-circle text-green-600 mr-2"></i>
                All class subjects loaded
              </div>
            ) : (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="all">All My Subjects</option>
                {teachingSubjects.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
                {subjects?.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Type</label>
            <select
              value={selectedAssessmentType}
              onChange={(e) => setSelectedAssessmentType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={selectedSubject === 'all'}
            >
              <option value="">Direct (Final Score)</option>
              {assessmentConfigs.map((c: any) => (
                <option key={c.assessmentDefId} value={c.assessmentDefId}>
                  {c.assessmentDef?.name || 'Unknown'} ({c.weightPercentage}%, Max: {c.maxScore})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
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
      </div>

      {(selectedClass && selectedTerm && (entryMode === 'class' || (selectedSubject !== ''))) && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              {entryMode === 'class' ? (
                <span>Class Results — All Subjects</span>
              ) : selectedSubject === 'all' ? (
                <span>Multi Subject Entry — {teachingSubjects.length} subjects</span>
              ) : (
                <span>Enter Scores — {subjects?.find((s: any) => s.id === selectedSubject)?.name}</span>
              )}
            </h2>
            <div className="flex gap-2">
              {assessmentConfigs?.length > 0 && selectedSubject && selectedSubject !== 'all' && (
                <button
                  onClick={() => computeResultMutation.mutate(selectedClass)}
                  disabled={computeResultMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  Compute Final Results
                </button>
              )}
              {isBulkEntry && (Object.keys(scores).length > 0 || absentCells.size > 0) && (
                <button
                  onClick={handleSaveAll}
                  disabled={bulkEnterScoresMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  Save All ({Object.keys(scores).length + absentCells.size})
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
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10" style={{ left: '40px' }}>Admission #</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10" style={{ left: '140px' }}>Student Name</th>
                    {displaySubjects.map((subj: any) => (
                      <th key={subj.id || subj.subjectId} className="text-center py-3 px-4 font-medium text-gray-700 min-w-[90px]">
                        {subj.name || subj.subject?.name || 'Subject'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student: any, index: number) => (
                    <tr key={student.id} className="border-t hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-500 sticky left-0 bg-white z-10">{index + 1}</td>
                      <td className="py-3 px-4 font-mono text-sm sticky left-0 bg-white z-10" style={{ left: '40px' }}>{student.admissionNumber}</td>
                      <td className="py-3 px-4 font-medium sticky left-0 bg-white z-10" style={{ left: '140px' }}>
                        {student.firstName} {student.lastName}
                      </td>
                      {displaySubjects.map((subj: any) => {
                        const subjId = subj.id || subj.subjectId || subj.subject?.id;
                        const existing: any = existingResultsMap.get(`${student.id}-${subjId}`);
                        const scoreKey = `${student.id}|${subjId}`;
                        const currentScore = scores[scoreKey] ?? existing?.score ?? 0;
                        const isMissing = !scores[scoreKey] && !existing?.score;

                        return (
                          <td key={scoreKey} className={`py-2 px-3 text-center ${isMissing ? 'bg-yellow-50' : ''}`}>
                            {absentCells.has(scoreKey) && (
                              <div className="mb-1">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                  Absent
                                </span>
                              </div>
                            )}
                            {currentScore > 0 && !isMissing && !absentCells.has(scoreKey) && (
                              <div className="mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getGradeColor(currentScore)}`}>
                                  {getGrade(existing, currentScore)}
                                </span>
                              </div>
                            )}
                            <input
                              type="text"
                              inputMode="text"
                              value={absentCells.has(scoreKey) ? '' : (scores[scoreKey] ?? (existing?.score ?? ''))}
                              onChange={(e) => {
                                const val = e.target.value.trim().toUpperCase();
                                if (val === 'X' || val === 'A') {
                                  setAbsentCells(prev => new Set(prev).add(scoreKey));
                                  setScores(prev => {
                                    const next = { ...prev };
                                    delete next[scoreKey];
                                    return next;
                                  });
                                } else {
                                  setAbsentCells(prev => { const next = new Set(prev); next.delete(scoreKey); return next; });
                                  setScores(prev => ({
                                    ...prev,
                                    [scoreKey]: val ? Number(val) : 0,
                                  }));
                                }
                              }}
                              className={`w-16 px-1.5 py-1 border rounded text-center text-sm ${
                                absentCells.has(scoreKey)
                                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                                  : !isMissing && existing?.score < PASS_THRESHOLD
                                    ? 'border-red-300 bg-red-50'
                                    : isMissing ? 'border-yellow-300 bg-yellow-50' : ''
                              }`}
                              placeholder={absentCells.has(scoreKey) ? 'X/A' : '0-100 or X/A'}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {teachingSubjects.length === 0 && entryMode !== 'class' && (
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
