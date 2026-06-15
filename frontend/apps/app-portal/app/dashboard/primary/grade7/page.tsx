'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { grade7EczApi, studentApi, subjectApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const ECZ_SUBJECTS = [
  { name: 'English', code: 'ENG', color: '#3b82f6', icon: 'fa-book-open' },
  { name: 'Mathematics', code: 'MTH', color: '#10b981', icon: 'fa-calculator' },
  { name: 'Science', code: 'SCI', color: '#8b5cf6', icon: 'fa-flask' },
  { name: 'Social Studies', code: 'SST', color: '#f59e0b', icon: 'fa-globe-africa' },
  { name: 'Zambian Language', code: 'ZAM', color: '#ec4899', icon: 'fa-language' },
  { name: 'Religious Education', code: 'RE', color: '#0891b2', icon: 'fa-church' },
];

type Tab = 'overview' | 'mock-exams' | 'selection';

export default function Grade7Page() {
  const { isAuthenticated, isLoading: authLoading, schoolId } = useAuth();
  const [activeSection, setActiveSection] = useState<Tab>('overview');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', paperType: 'SP1' as 'SP1' | 'SP2' | 'MOCK',
    subjectId: '', duration: 120, totalScore: 100,
  });
  const [creating, setCreating] = useState(false);

  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [examResults, setExamResults] = useState<any>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [scoreEntryExam, setScoreEntryExam] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [savingScores, setSavingScores] = useState(false);

  const { data: rawStudents } = useQuery({
    queryKey: ['grade7-students'],
    queryFn: () => studentApi.getAll({ grade: '7' }).then(r => r.data?.data || r.data || []),
    enabled: isAuthenticated,
  });

  const { data: classesRes } = useQuery({
    queryKey: ['grade7-classes'],
    queryFn: () => grade7EczApi.getClasses().then(r => r.data?.data || []),
    enabled: isAuthenticated,
  });

  const { data: subjectsRes } = useQuery({
    queryKey: ['school-subjects'],
    queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data || []),
    enabled: isAuthenticated,
  });

  const classes = classesRes || [];
  const subjects = subjectsRes || [];

  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes]);

  useEffect(() => {
    if (subjects.length > 0 && !createForm.subjectId) {
      const ecz = subjects.find((s: any) => ECZ_SUBJECTS.some(e => s.name.toLowerCase().includes(e.name.toLowerCase())));
      if (ecz) setCreateForm(f => ({ ...f, subjectId: ecz.id }));
    }
  }, [subjects]);

  const { data: mockExamsRes, refetch: refetchMockExams } = useQuery({
    queryKey: ['grade7-mock-exams', selectedClassId],
    queryFn: () => grade7EczApi.getMockExams(selectedClassId || undefined).then(r => r.data?.data || []),
    enabled: isAuthenticated && !!selectedClassId,
  });

  const { data: predictionRes, refetch: refetchPrediction } = useQuery({
    queryKey: ['grade7-prediction', selectedClassId, selectedTermId],
    queryFn: () => grade7EczApi.getPrediction(selectedClassId, selectedTermId).then(r => r.data?.data || null),
    enabled: isAuthenticated && !!selectedClassId && !!selectedTermId,
  });

  const mockExams = mockExamsRes || [];
  const prediction = predictionRes || null;
  const grade7Students = (rawStudents || []).filter((s: any) => {
    const grade = s.grade || s.className || '';
    return grade.includes('7') || grade.includes('Seven') || grade.includes('seven');
  });

  const loadResults = async (examId: string) => {
    try {
      setResultsLoading(true); setError('');
      const res = await grade7EczApi.getMockExamResults(examId);
      setExamResults(res.data?.data || null);
    } catch (err: any) {
      setError('Failed to load results');
    } finally { setResultsLoading(false); }
  };

  const handleCreateMockExam = async () => {
    if (!createForm.title || !selectedClassId || !selectedTermId || !createForm.subjectId) {
      setError('Please fill in all required fields'); return;
    }
    try {
      setCreating(true); setError('');
      await grade7EczApi.createMockExam({ ...createForm, classId: selectedClassId, termId: selectedTermId });
      setShowCreate(false);
      setCreateForm({ title: '', paperType: 'SP1', subjectId: '', duration: 120, totalScore: 100 });
      refetchMockExams();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create exam');
    } finally { setCreating(false); }
  };

  const handleSaveScores = async () => {
    if (!scoreEntryExam) return;
    try {
      setSavingScores(true); setError('');
      const entries = Object.entries(scores).map(([studentId, score]) => ({ studentId, score: Number(score) }));
      await grade7EczApi.enterBulkScores({ examId: scoreEntryExam, scores: entries });
      setScoreEntryExam(null); setScores({});
      loadResults(scoreEntryExam);
      refetchMockExams();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save scores');
    } finally { setSavingScores(false); }
  };

  const handleRankResults = async () => {
    if (!schoolId || !selectedTermId) return;
    try {
      await grade7EczApi.rankResults(schoolId, selectedTermId);
      refetchPrediction();
    } catch (err: any) {
      setError('Failed to rank results');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const tabBtn = (key: Tab, label: string, icon: string) => (
    <button onClick={() => setActiveSection(key)}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
        activeSection === key ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500' : 'text-gray-500 hover:text-gray-700'
      }`}>
      <i className={`fas ${icon}`} /> {label}
    </button>
  );

  const eczSubjects = subjects.filter((s: any) =>
    ECZ_SUBJECTS.some(e => s.name.toLowerCase().includes(e.name.toLowerCase())),
  );

  const renderCreateModal = () => (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => setShowCreate(false)}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Create Grade 7 Mock Exam</h3>
          <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title</label>
            <input type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="e.g. Mock Exam 1 - Term 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paper Type</label>
              <select value={createForm.paperType} onChange={e => setCreateForm({ ...createForm, paperType: e.target.value as any })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                <option value="SP1">SP1 (Special Paper 1)</option>
                <option value="SP2">SP2 (Special Paper 2)</option>
                <option value="MOCK">Mock</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select value={createForm.subjectId} onChange={e => setCreateForm({ ...createForm, subjectId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                <option value="">Select subject...</option>
                {eczSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <input type="number" value={createForm.duration} onChange={e => setCreateForm({ ...createForm, duration: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Score</label>
              <input type="number" value={createForm.totalScore} onChange={e => setCreateForm({ ...createForm, totalScore: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleCreateMockExam} disabled={creating}
              className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {creating ? <><i className="fas fa-spinner fa-spin" /> Creating...</> : 'Create Exam'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScoreEntryModal = () => {
    const exam = mockExams.find((e: any) => e.id === scoreEntryExam);
    const students = grade7Students;
    return (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => { setScoreEntryExam(null); setScores({}); }}>
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Enter Scores</h3>
              <p className="text-sm text-gray-500">{exam?.title} ({exam?.type})</p>
            </div>
            <button onClick={() => { setScoreEntryExam(null); setScores({}); }} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
          </div>
          {students.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No Grade 7 students found for this class.</p>
          ) : (
            <div className="space-y-3">
              {students.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-gray-400">{s.studentNumber}</p>
                  </div>
                  <input
                    type="number" placeholder="Score"
                    value={scores[s.id] ?? ''}
                    onChange={e => setScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-right focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <span className="text-xs text-gray-400 w-12">/ {exam?.totalScore || 100}</span>
                </div>
              ))}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button onClick={handleSaveScores} disabled={savingScores}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingScores ? <><i className="fas fa-spinner fa-spin" /> Saving...</> : 'Save All Scores'}
                </button>
                <button onClick={() => { setScoreEntryExam(null); setScores({}); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderOverview = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ECZ_SUBJECTS.map(subj => (
          <div key={subj.code} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: subj.color }}>
                <i className={`fas ${subj.icon}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{subj.name}</h3>
                <p className="text-xs text-gray-400">Code: {subj.code}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Composite</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Syllabus: —%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Grade 7 Classes</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {classes.length === 0 ? (
            <p className="text-sm text-gray-500 col-span-full text-center py-4">No Grade 7 classes found.</p>
          ) : classes.map((cls: any) => (
            <div key={cls.id} className="border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800">{cls.name}</h3>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{cls._count?.enrollments || 0} students</span>
              </div>
              {cls.levelType && <p className="text-xs text-gray-400">{cls.levelType.name}</p>}
              <button onClick={() => setSelectedClassId(cls.id)}
                className={`mt-3 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  selectedClassId === cls.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {selectedClassId === cls.id ? 'Selected' : 'Select'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Preparation Milestones</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { stage: 'Syllabus Coverage', desc: 'Complete Grade 7 syllabus for all examinable subjects' },
            { stage: 'Mock Exam 1', desc: 'First mock examination under timed conditions' },
            { stage: 'Remedial Teaching', desc: 'Address gaps identified in Mock 1' },
            { stage: 'Mock Exam 2', desc: 'Second mock with ECZ-style questions' },
            { stage: 'Past Papers', desc: 'Practice with past ECZ papers (last 5 years)' },
            { stage: 'Final Revision', desc: 'Intensive revision before national exam' },
          ].map((m, i) => {
            const status = mockExams.length > 0 && i <= 1 ? 'completed' : 'pending';
            return (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>{i + 1}</div>
                  <div>
                    <p className="font-medium text-gray-900">{m.stage}</p>
                    <p className="text-xs text-gray-500">{m.desc}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>{status === 'completed' ? 'Done' : 'Pending'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  const renderMockExams = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Mock Examinations (SP1, SP2, Mock)</h2>
        <button onClick={() => { setShowCreate(true); setError(''); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2">
          <i className="fas fa-plus" /> Create Mock Exam
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}

      {showCreate && renderCreateModal()}
      {scoreEntryExam && renderScoreEntryModal()}

      {mockExams.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4 text-gray-300"><i className="fas fa-pencil-alt" /></div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Mock Exams Yet</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Create SP1, SP2, or Mock examinations for your Grade 7 candidates. Results will be auto-synced to the Grade 7 computation pipeline.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {mockExams.map((exam: any) => (
            <div key={exam.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold ${
                    exam.type === 'SP1' ? 'bg-blue-500' : exam.type === 'SP2' ? 'bg-violet-500' : 'bg-amber-500'
                  }`}>{exam.type}</div>
                  <div>
                    <h3 className="font-medium text-gray-900">{exam.title}</h3>
                    <p className="text-xs text-gray-400">
                      {exam.class?.name} &middot; {exam.subject?.name} &middot; {exam.term?.name} &middot; {exam.duration}min &middot; {exam.totalScore}pts
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{exam._count?.attempts || 0} submissions</span>
                  <button onClick={() => { setScoreEntryExam(exam.id); setScores({}); }} className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">
                    <i className="fas fa-plus mr-1" /> Scores
                  </button>
                  <button onClick={() => {
                    if (expandedExam === exam.id) { setExpandedExam(null); setExamResults(null); }
                    else { setExpandedExam(exam.id); loadResults(exam.id); }
                  }} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                    <i className={`fas ${expandedExam === exam.id ? 'fa-chevron-up' : 'fa-chevron-down'} mr-1`} />
                    {expandedExam === exam.id ? 'Hide' : 'Results'}
                  </button>
                </div>
              </div>
              {expandedExam === exam.id && (
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                  {resultsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                    </div>
                  ) : examResults ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
                          <p className="text-2xl font-bold text-gray-800">{examResults.statistics?.averageScore?.toFixed(1) || 0}</p>
                          <p className="text-xs text-gray-500">Average</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
                          <p className="text-2xl font-bold text-emerald-600">{examResults.statistics?.highestScore || 0}</p>
                          <p className="text-xs text-gray-500">Highest</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
                          <p className="text-2xl font-bold text-red-600">{examResults.statistics?.lowestScore || 0}</p>
                          <p className="text-xs text-gray-500">Lowest</p>
                        </div>
                      </div>
                      {examResults.attempts?.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-3 font-medium text-gray-500">#</th>
                                <th className="text-left py-2 px-3 font-medium text-gray-500">Student</th>
                                <th className="text-left py-2 px-3 font-medium text-gray-500">Number</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-500">Score</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-500">%</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-500">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {examResults.attempts.map((a: any, i: number) => (
                                <tr key={a.id} className="border-b border-gray-100 hover:bg-white">
                                  <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                                  <td className="py-2 px-3 font-medium text-gray-800">{a.studentName}</td>
                                  <td className="py-2 px-3 text-gray-500">{a.studentNumber}</td>
                                  <td className="py-2 px-3 text-right font-medium">{a.score}</td>
                                  <td className="py-2 px-3 text-right">{a.percentage}%</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      a.grade === 'A' ? 'bg-emerald-100 text-emerald-700' :
                                      a.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                                      a.grade === 'C' ? 'bg-amber-100 text-amber-700' :
                                      a.grade === 'D' ? 'bg-orange-100 text-orange-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>{a.grade || '-'}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-2">No results available. Click "Scores" to enter marks.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-sync text-purple-600 text-lg" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Score Entry & Auto-Sync</h3>
            <p className="text-sm text-gray-600">
              Use the <strong>Scores</strong> button to enter marks for each exam. Scores are automatically synced to the Grade 7 Result engine.
              After entering all scores, go to the <strong>Selection Prediction</strong> tab and click <strong>Compute</strong> to calculate ECZ divisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSelection = () => (
    <div className="space-y-6">
      {!selectedTermId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <i className="fas fa-exclamation-triangle text-amber-500 text-3xl mb-3" />
          <h3 className="font-semibold text-gray-800 mb-1">Term Required</h3>
          <p className="text-sm text-gray-600">Please select a term to view selection predictions.</p>
        </div>
      ) : !prediction ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading predictions...</p>
        </div>
      ) : prediction.totalStudents === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4 text-gray-300"><i className="fas fa-chart-line" /></div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Prediction Data</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            No Grade 7 results found. Enter scores in the Mock Exams tab first, then click Compute.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 p-5">
              <p className="text-3xl font-bold text-emerald-600">{prediction.eligibleForForm1}</p>
              <p className="text-sm text-gray-600">Eligible for Form 1</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-5">
              <p className="text-3xl font-bold text-amber-600">{prediction.borderline}</p>
              <p className="text-sm text-gray-600">Borderline</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl border border-red-200 p-5">
              <p className="text-3xl font-bold text-red-600">{prediction.atRisk}</p>
              <p className="text-sm text-gray-600">At Risk</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-5">
              <p className="text-3xl font-bold text-purple-600">{prediction.totalStudents}</p>
              <p className="text-sm text-gray-600">Total Students</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Division Breakdown</h2>
              </div>
              <div className="p-6">
                <div className="flex items-end gap-4 h-48">
                  {prediction.divisionBreakdown?.map((d: any) => {
                    const maxCount = Math.max(...(prediction.divisionBreakdown || []).map((x: any) => x.count), 1);
                    const colors: Record<string, string> = {
                      'Division 1': '#059669', 'Division 2': '#3b82f6', 'Division 3': '#f59e0b',
                      'Division 4': '#f97316', 'Unclassified': '#dc2626',
                    };
                    return (
                      <div key={d.division} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-sm font-bold text-gray-700">{d.count}</span>
                        <div className="w-full rounded-lg transition-all" style={{ height: `${Math.max((d.count / maxCount) * 100, 4)}%`, backgroundColor: colors[d.division] || '#9ca3af' }} />
                        <span className="text-xs text-gray-500 text-center whitespace-nowrap">{d.division.replace('Division ', 'Div ')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  <strong>Average Aggregate:</strong> {prediction.averageAggregate?.toFixed(1) || '-'}
                </p>
                <button onClick={() => grade7EczApi.computeGrade7(selectedClassId, selectedTermId).then(() => refetchPrediction())}
                  className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
                  <i className="fas fa-calculator" /> Compute ECZ Divisions
                </button>
                <button onClick={handleRankResults}
                  className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <i className="fas fa-sort-amount-down" /> Rank Students
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Student Predictions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Student</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Number</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">Aggregate</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Division</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">Rank</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {prediction.studentPredictions?.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400">No data</td></tr>
                  ) : prediction.studentPredictions?.map((sp: any, i: number) => (
                    <tr key={sp.studentId || i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-800">{sp.studentName}</td>
                      <td className="py-3 px-4 text-gray-500">{sp.studentNumber || '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold">{sp.finalAggregate ?? '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          sp.division === 'Division 1' ? 'bg-emerald-100 text-emerald-700' :
                          sp.division === 'Division 2' ? 'bg-blue-100 text-blue-700' :
                          sp.division === 'Division 3' ? 'bg-amber-100 text-amber-700' :
                          sp.division === 'Division 4' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{sp.division || 'Unclassified'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">{sp.schoolRank ?? '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium ${
                          sp.prediction?.includes('Likely') ? 'text-emerald-600' :
                          sp.prediction?.includes('Borderline') ? 'text-amber-600' : 'text-red-600'
                        }`}>{sp.prediction}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grade 7 ECZ Preparation</h1>
          <p className="text-gray-500 text-sm mt-1">National Examination preparation, mock exams, and placement prediction</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-purple-500">
            <option value="">Select class...</option>
            {classes.map((cls: any) => (
              <option key={cls.id} value={cls.id}>{cls.name} ({cls._count?.enrollments || 0} students)</option>
            ))}
          </select>
          <a href="/dashboard/curriculum/exam-structures" className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            <i className="fas fa-cog" /> Settings
          </a>
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 text-2xl">
            <i className="fas fa-graduation-cap" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Grade 7 National Assessment</h2>
            <p className="text-sm text-gray-600 mt-1">
              {grade7Students.length} candidates enrolled. Create mock exams, enter scores, compute ECZ divisions, and predict secondary school placement.
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{grade7Students.length}</p>
            <p className="text-xs text-gray-500">Candidates</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {tabBtn('overview', 'Exam Overview', 'fa-clipboard-list')}
        {tabBtn('mock-exams', 'Mock Exams', 'fa-pencil-alt')}
        {tabBtn('selection', 'Selection Prediction', 'fa-chart-line')}
      </div>

      {activeSection === 'overview' && renderOverview()}
      {activeSection === 'mock-exams' && renderMockExams()}
      {activeSection === 'selection' && renderSelection()}
    </div>
  );
}
