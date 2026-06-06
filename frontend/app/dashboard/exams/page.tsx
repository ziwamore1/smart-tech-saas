'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { examApi, classApi, subjectApi, termApi } from '@/lib/api';

type TabType = 'exams' | 'question-bank' | 'templates' | 'uploaded';
type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY' | 'MATCHING' | 'FILL_IN_BLANK' | 'STRUCTURED' | 'PRACTICAL';

const gradPink = 'linear-gradient(135deg, #ec4899, #db2777)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'TRUE_FALSE', label: 'True/False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'ESSAY', label: 'Essay' },
  { value: 'MATCHING', label: 'Matching' },
  { value: 'FILL_IN_BLANK', label: 'Fill in Blank' },
  { value: 'STRUCTURED', label: 'Structured' },
  { value: 'PRACTICAL', label: 'Practical' },
];

const DIFFICULTY = ['EASY', 'MEDIUM', 'HARD', 'ADVANCED'];

export default function ExamsPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('exams');
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Exam form
  const [showCreate, setShowCreate] = useState(false);
  const [editingExam, setEditingExam] = useState<any>(null);
  const [examForm, setExamForm] = useState<any>({ title: '', description: '', type: 'EXAM', classId: '', subjectId: '', termId: '', duration: 60, totalScore: 100, passingScore: 50, instructions: '', startsAt: '', endsAt: '' });

  // Questions
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [qForm, setQForm] = useState<any>({ question: '', questionType: 'MULTIPLE_CHOICE', options: ['', ''], correctAnswer: '', explanation: '', score: 5, difficulty: 'MEDIUM', topic: '' });

  // Question Bank
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [bankFilters, setBankFilters] = useState<Record<string, string>>({});
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState<any>({ name: '', description: '', subjectId: '', duration: 60, totalMarks: 100, instructions: '', sections: [] });

  // Uploaded Exams
  const [uploadedExams, setUploadedExams] = useState<any[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState<any>({ title: '', subjectId: '', classId: '', termId: '' });
  const [previewExam, setPreviewExam] = useState<any>(null);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadAll();
  }, [isAuthenticated]);

  const loadAll = async () => {
    setLoading(true);
    const safeData = (res: any) => res?.data?.data || res?.data || [];
    const [eRes, cRes, sRes, tRes] = await Promise.all([
      examApi.getAll(filters).catch(e => { console.warn('examApi.getAll failed:', e); return { data: [] }; }),
      classApi.getAll().catch(e => { console.warn('classApi.getAll failed:', e); return { data: [] }; }),
      subjectApi.getAll().catch(e => { console.warn('subjectApi.getAll failed:', e); return { data: [] }; }),
      termApi.getAll().catch(e => { console.warn('termApi.getAll failed:', e); return { data: [] }; }),
    ]);
    setExams(safeData(eRes));
    setClasses(safeData(cRes));
    setSubjects(safeData(sRes));
    setTerms(safeData(tRes));
    setLoading(false);
  };

  useEffect(() => { if (isAuthenticated) loadAll(); }, [filters]);
  useEffect(() => { if (activeTab === 'question-bank') loadBank(); }, [activeTab, bankFilters]);
  useEffect(() => { if (activeTab === 'templates') loadTemplates(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'uploaded') loadUploaded(); }, [activeTab]);

  const loadBank = async () => {
    try { const r = await examApi.getBankQuestions(bankFilters); setBankQuestions(r.data?.data || r.data || []); } catch {}
  };
  const loadTemplates = async () => {
    try { const r = await examApi.getTemplates(); setTemplates(r.data?.data || r.data || []); } catch {}
  };
  const loadUploaded = async () => {
    try { const r = await examApi.getUploadedExams(); setUploadedExams(r.data?.data || r.data || []); } catch {}
  };
  const loadQuestions = async (id: string) => {
    try { const r = await examApi.getById(id); const d = r.data?.data || r.data; setQuestions(d?.questions || []); } catch {}
  };

  // ===== Exam CRUD =====
  const handleCreateExam = async () => {
    try {
      await examApi.create({ ...examForm, startsAt: new Date(examForm.startsAt).toISOString(), endsAt: new Date(examForm.endsAt).toISOString() });
      setShowCreate(false); setExamForm({ title: '', description: '', type: 'EXAM', classId: '', subjectId: '', termId: '', duration: 60, totalScore: 100, passingScore: 50, instructions: '', startsAt: '', endsAt: '' });
      loadAll();
    } catch (err) { console.error('Create exam failed:', err); }
  };

  const handleUpdateExam = async () => {
    if (!editingExam) return;
    try {
      await examApi.update(editingExam.id, examForm);
      setEditingExam(null); setShowCreate(false); loadAll();
    } catch (err) { console.error('Update exam failed:', err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this exam?')) return;
    await examApi.delete(id); loadAll();
  };

  const openEdit = (exam: any) => {
    setEditingExam(exam);
    setExamForm({ title: exam.title, description: exam.description || '', type: exam.type, classId: exam.classId, subjectId: exam.subjectId, termId: exam.termId, duration: exam.duration, totalScore: exam.totalScore, passingScore: exam.passingScore, instructions: exam.instructions || '', startsAt: exam.startsAt?.slice(0, 16) || '', endsAt: exam.endsAt?.slice(0, 16) || '' });
    setShowCreate(true);
  };

  const togglePublish = async (exam: any) => {
    try {
      if (exam.isPublished) await examApi.unpublish(exam.id);
      else await examApi.publish(exam.id);
      loadAll();
    } catch {}
  };

  // ===== Questions =====
  const openQuestionEditor = async (exam: any) => {
    setSelectedExam(exam);
    await loadQuestions(exam.id);
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async () => {
    if (!selectedExam) return;
    try {
      const payload: any = { ...qForm };
      if (qForm.questionType === 'MULTIPLE_CHOICE' || qForm.questionType === 'MATCHING') {
        payload.options = qForm.options.filter((o: string) => o.trim());
      }
      if (editingQuestion) await examApi.updateQuestion(editingQuestion.id, payload);
      else await examApi.addQuestion(selectedExam.id, payload);
      setEditingQuestion(null);
      setQForm({ question: '', questionType: 'MULTIPLE_CHOICE', options: ['', ''], correctAnswer: '', explanation: '', score: 5, difficulty: 'MEDIUM', topic: '' });
      loadQuestions(selectedExam.id);
    } catch (err) { console.error('Save question failed:', err); }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await examApi.deleteQuestion(id);
    loadQuestions(selectedExam.id);
  };

  const handleOptionChange = (i: number, val: string) => {
    const opts = [...qForm.options]; opts[i] = val; setQForm({ ...qForm, options: opts });
  };

  const addOption = () => setQForm({ ...qForm, options: [...qForm.options, ''] });
  const removeOption = (i: number) => {
    if (qForm.options.length <= 2) return;
    setQForm({ ...qForm, options: qForm.options.filter((_: any, idx: number) => idx !== i) });
  };

  // ===== Preview =====
  const handlePreview = async (exam: any) => {
    setPreviewExam(exam);
    try {
      const r = await examApi.renderPreviewHtml(exam.id);
      setPreviewHtml(r.data?.html || r.data?.data?.html || '');
    } catch { setPreviewHtml('<p>Preview unavailable</p>'); }
  };

  // ===== Template =====
  const handleSaveTemplate = async () => {
    try {
      await examApi.createTemplate(templateForm);
      setShowTemplateForm(false);
      setTemplateForm({ name: '', description: '', subjectId: '', duration: 60, totalMarks: 100, instructions: '', sections: [] });
      loadTemplates();
    } catch {}
  };

  const handleApplyTemplate = async (examId: string, templateId: string) => {
    await examApi.applyTemplate(examId, templateId);
    loadAll();
  };

  // ===== Upload =====
  const handleUploadExam = async () => {
    if (!uploadFile) return;
    const fd = new FormData();
    fd.append('file', uploadFile);
    Object.entries(uploadForm).forEach(([k, v]) => fd.append(k, String(v)));
    try {
      await examApi.uploadExam(fd);
      setUploadFile(null);
      setUploadForm({ title: '', subjectId: '', classId: '', termId: '' });
      loadUploaded();
    } catch {}
  };

  const handleParseDoc = async (id: string) => {
    await examApi.parseExamDoc(id);
    loadUploaded();
  };

  // ===== Auto Mark =====
  const handleAutoMark = async (id: string) => {
    if (!confirm('Auto-mark all ungraded attempts for this exam?')) return;
    await examApi.autoMarkExam(id);
    alert('Auto-marking complete!');
  };

  // ===== Utils =====
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '-';
  const formatTime = (d: string) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!isAuthenticated) return null;

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'exams', label: 'Exams', icon: 'fa-file-text' },
    { key: 'question-bank', label: 'Question Bank', icon: 'fa-database' },
    { key: 'templates', label: 'Templates', icon: 'fa-file-code' },
    { key: 'uploaded', label: 'Uploaded Papers', icon: 'fa-upload' },
  ];

  const sInput = (label: string, val: any, set: (v: any) => void, opts?: any) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>{label}</label>
      {opts?.type === 'textarea' ? (
        <textarea value={val} onChange={e => set(e.target.value)} rows={opts?.rows || 3} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
      ) : opts?.type === 'select' ? (
        <select value={val} onChange={e => set(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}>
          <option value="">Select...</option>
          {opts?.options?.map((o: any, i: number) => <option key={i} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : opts?.type === 'number' ? (
        <input type="number" value={val} onChange={e => set(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
      ) : (
        <input type={opts?.inputType || 'text'} value={val} onChange={e => set(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
      )}
    </div>
  );

  // ===== RENDER =====
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Online Exams</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>Advanced examination management engine</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'exams' && <button onClick={() => { setEditingExam(null); setExamForm({ title: '', description: '', type: 'EXAM', classId: '', subjectId: '', termId: '', duration: 60, totalScore: 100, passingScore: 50, instructions: '', startsAt: '', endsAt: '' }); setShowCreate(true); }} style={{ padding: '10px 20px', background: gradPink, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="fa fa-plus"></i> Create Exam</button>}
          {activeTab === 'templates' && <button onClick={() => { setShowTemplateForm(true); }} style={{ padding: '10px 20px', background: gradPurple, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="fa fa-plus"></i> New Template</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#f3f4f6', padding: '4px', borderRadius: '12px' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: '10px 16px', background: activeTab === t.key ? 'white' : 'transparent', color: activeTab === t.key ? '#1f2937' : '#6b7280', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            <i className={`fa ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>

      {/* ===== EXAMS TAB ===== */}
      {activeTab === 'exams' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input placeholder="Search exams..." value={filters.search || ''} onChange={e => setFilters({ ...filters, search: e.target.value })} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', flex: 1, minWidth: '200px' }} />
            <select value={filters.subjectId || ''} onChange={e => setFilters({ ...filters, subjectId: e.target.value })} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filters.classId || ''} onChange={e => setFilters({ ...filters, classId: e.target.value })} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filters.status || ''} onChange={e => setFilters({ ...filters, status: e.target.value })} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[{ label: 'Total Exams', val: exams.length, grad: gradPink }, { label: 'Published', val: exams.filter(e => e.isPublished).length, grad: gradGreen }, { label: 'Drafts', val: exams.filter(e => !e.isPublished).length, grad: gradBlue }, { label: 'Questions', val: exams.reduce((s, e) => s + (e._count?.questions || 0), 0), grad: gradPurple }].map((stat, i) => (
              <div key={i} style={{ background: '#fefcf9', borderRadius: '12px', padding: '16px', border: '1px solid #f3f4f6' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>{stat.label}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, margin: 0, background: stat.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{stat.val}</p>
              </div>
            ))}
          </div>

          {/* Exam List */}
          {loading ? <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p> : exams.length === 0 ? <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>No exams found. Create your first exam!</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {exams.map(exam => (
                <div key={exam.id} style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{exam.title}</h3>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>{exam.subject?.name || ''} · {exam.class?.name || ''} · {exam.term?.name || ''}</p>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: exam.isPublished ? '#d1fae5' : '#fef3c7', color: exam.isPublished ? '#065f46' : '#92400e' }}>{exam.isPublished ? 'Published' : exam.status || 'Draft'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                      <span><i className="fa fa-clock"></i> {exam.duration}min</span>
                      <span><i className="fa fa-star"></i> {exam.totalScore} marks</span>
                      <span><i className="fa fa-question-circle"></i> {exam._count?.questions || 0} Qs</span>
                      <span><i className="fa fa-users"></i> {exam._count?.attempts || 0} attempts</span>
                    </div>
                    {exam.instructions && <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{exam.instructions}</p>}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button onClick={() => openQuestionEditor(exam)} style={{ padding: '6px 12px', background: '#eff6ff', color: '#3b82f6', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-list"></i> Questions</button>
                      <button onClick={() => handlePreview(exam)} style={{ padding: '6px 12px', background: '#f0fdf4', color: '#059669', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-eye"></i> Preview</button>
                      <button onClick={() => handleAutoMark(exam.id)} style={{ padding: '6px 12px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-check"></i> Mark</button>
                      <button onClick={() => openEdit(exam)} style={{ padding: '6px 12px', background: '#f5efe8', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-edit"></i> Edit</button>
                      <button onClick={() => togglePublish(exam)} style={{ padding: '6px 12px', background: '#f5efe8', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className={`fa ${exam.isPublished ? 'fa-eye-slash' : 'fa-eye'}`}></i> {exam.isPublished ? 'Unpublish' : 'Publish'}</button>
                      <button onClick={() => handleDelete(exam.id)} style={{ padding: '6px 12px', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: '#fefcf9' }}><i className="fa fa-trash"></i></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== QUESTION BANK TAB ===== */}
      {activeTab === 'question-bank' && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input placeholder="Search questions..." value={bankFilters.search || ''} onChange={e => setBankFilters({ ...bankFilters, search: e.target.value })} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', flex: 1 }} />
            <select value={bankFilters.subjectId || ''} onChange={e => setBankFilters({ ...bankFilters, subjectId: e.target.value })} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={bankFilters.difficulty || ''} onChange={e => setBankFilters({ ...bankFilters, difficulty: e.target.value })} style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}>
              <option value="">All Difficulties</option>
              {DIFFICULTY.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', padding: '16px' }}>
            {bankQuestions.length === 0 ? <p style={{ textAlign: 'center', color: '#6b7280' }}>No questions in bank. Create questions in exams to build your bank.</p> : bankQuestions.map((q, i) => (
              <div key={q.id} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{i + 1}. {q.question}</p>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#6b7280' }}>
                    <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>{q.questionType}</span>
                    <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>{q.difficulty}</span>
                    <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>{q.score} marks</span>
                    {q.topic && <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>{q.topic}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { navigator.clipboard.writeText(q.id); }} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fefcf9', cursor: 'pointer' }}>Copy ID</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== TEMPLATES TAB ===== */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {templates.map(t => (
            <div key={t.id} style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', padding: '18px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{t.name}</h3>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280' }}>{t.description}</p>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                <span><i className="fa fa-clock"></i> {t.duration}min</span>
                <span><i className="fa fa-star"></i> {t.totalMarks} marks</span>
                <span><i className="fa fa-layer-group"></i> {t.sections?.length || 0} sections</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setTemplateForm(t); setShowTemplateForm(true); }} style={{ padding: '6px 14px', background: gradBlue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-edit"></i> Edit</button>
                <button onClick={async () => { await examApi.deleteTemplate(t.id); loadTemplates(); }} style={{ padding: '6px 14px', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: '#fefcf9' }}><i className="fa fa-trash"></i></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== UPLOADED EXAMS TAB ===== */}
      {activeTab === 'uploaded' && (
        <div>
          <div style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Upload Exam Paper</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div><input placeholder="Title" value={uploadForm.title} onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><select value={uploadForm.subjectId} onChange={e => setUploadForm({ ...uploadForm, subjectId: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}><option value="">Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><select value={uploadForm.classId} onChange={e => setUploadForm({ ...uploadForm, classId: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}><option value="">Class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><select value={uploadForm.termId} onChange={e => setUploadForm({ ...uploadForm, termId: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}><option value="">Term</option>{terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input type="file" accept=".docx,.doc,.pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ fontSize: '14px' }} />
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>Supported: DOCX, DOC, PDF (max 100MB)</p>
            </div>
            <button onClick={handleUploadExam} disabled={!uploadFile} style={{ padding: '10px 24px', background: uploadFile ? gradPink : '#d1d5db', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: uploadFile ? 'pointer' : 'not-allowed' }}><i className="fa fa-upload"></i> Upload</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {uploadedExams.map(u => (
              <div key={u.id} style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1f2937' }}>{u.title || u.fileName}</h3>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: u.status === 'PARSED' ? '#d1fae5' : u.status === 'FAILED' ? '#fee2e2' : '#fef3c7', color: u.status === 'PARSED' ? '#065f46' : u.status === 'FAILED' ? '#991b1b' : '#92400e' }}>{u.status}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }}>{u.fileName} · {(u.fileSize / 1024 / 1024).toFixed(1)}MB</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleParseDoc(u.id)} style={{ padding: '6px 12px', background: gradBlue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-file-text"></i> Parse</button>
                  <button onClick={async () => { const r = await examApi.getUploadedPreview(u.id); setPreviewHtml(r.data?.previewHtml || '<p>No preview</p>'); setPreviewExam({ title: u.title || u.fileName }); }} style={{ padding: '6px 12px', background: '#f5efe8', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-eye"></i> Preview</button>
                  <button onClick={async () => { await examApi.deleteUploadedExam(u.id); loadUploaded(); }} style={{ padding: '6px 12px', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: '#fefcf9' }}><i className="fa fa-trash"></i></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CREATE/EDIT EXAM MODAL ===== */}
      {showCreate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', width: '600px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#1f2937' }}>{editingExam ? 'Edit Exam' : 'Create Exam'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>{sInput('Title', examForm.title, v => setExamForm({ ...examForm, title: v }))}</div>
              <div style={{ gridColumn: '1 / -1' }}>{sInput('Description', examForm.description, v => setExamForm({ ...examForm, description: v }), { type: 'textarea', rows: 2 })}</div>
              <div>{sInput('Type', examForm.type, v => setExamForm({ ...examForm, type: v }), { type: 'select', options: ['EXAM', 'QUIZ', 'TEST', 'MID_TERM', 'END_TERM', 'PRACTICAL', 'OBJECTIVE', 'STRUCTURED'] })}</div>
              <div>{sInput('Duration (min)', examForm.duration, v => setExamForm({ ...examForm, duration: v }), { type: 'number' })}</div>
              <div>{sInput('Total Score', examForm.totalScore, v => setExamForm({ ...examForm, totalScore: v }), { type: 'number' })}</div>
              <div>{sInput('Passing Score', examForm.passingScore, v => setExamForm({ ...examForm, passingScore: v }), { type: 'number' })}</div>
              <div>{sInput('Class', examForm.classId, v => setExamForm({ ...examForm, classId: v }), { type: 'select', options: classes.map(c => ({ value: c.id, label: c.name })) })}</div>
              <div>{sInput('Subject', examForm.subjectId, v => setExamForm({ ...examForm, subjectId: v }), { type: 'select', options: subjects.map(s => ({ value: s.id, label: s.name })) })}</div>
              <div>{sInput('Term', examForm.termId, v => setExamForm({ ...examForm, termId: v }), { type: 'select', options: terms.map(t => ({ value: t.id, label: t.name })) })}</div>
              <div>{sInput('Starts At', examForm.startsAt, v => setExamForm({ ...examForm, startsAt: v }), { inputType: 'datetime-local' })}</div>
              <div>{sInput('Ends At', examForm.endsAt, v => setExamForm({ ...examForm, endsAt: v }), { inputType: 'datetime-local' })}</div>
              <div style={{ gridColumn: '1 / -1' }}>{sInput('Instructions', examForm.instructions, v => setExamForm({ ...examForm, instructions: v }), { type: 'textarea', rows: 3 })}</div>
            </div>
            {/* Templates selector */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Apply Template (optional)</label>
              <select onChange={async e => { if (!e.target.value) return; await handleApplyTemplate(editingExam?.id || 'new', e.target.value); if (!editingExam) setExamForm({ ...examForm, templateId: e.target.value }); }} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fefcf9' }}>
                <option value="">No template</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => { setShowCreate(false); setEditingExam(null); }} style={{ padding: '10px 20px', background: '#fefcf9', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={editingExam ? handleUpdateExam : handleCreateExam} style={{ padding: '10px 24px', background: gradPink, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>{editingExam ? 'Update' : 'Create'} Exam</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== QUESTION EDITOR MODAL ===== */}
      {showQuestionModal && selectedExam && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', width: '800px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>Questions: {selectedExam.title}</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>{questions.length} questions · {selectedExam.totalScore} total marks</p>

            {/* Question Form */}
            <div style={{ background: '#f5efe8', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1 / -1' }}>{sInput('Question', qForm.question, v => setQForm({ ...qForm, question: v }), { type: 'textarea', rows: 3 })}</div>
                <div>{sInput('Type', qForm.questionType, v => setQForm({ ...qForm, questionType: v, options: v === 'MULTIPLE_CHOICE' ? ['', ''] : v === 'MATCHING' ? ['', ''] : [], correctAnswer: '' }), { type: 'select', options: QUESTION_TYPES })}</div>
                <div>{sInput('Difficulty', qForm.difficulty, v => setQForm({ ...qForm, difficulty: v }), { type: 'select', options: DIFFICULTY })}</div>
                <div>{sInput('Marks', qForm.score, v => setQForm({ ...qForm, score: v }), { type: 'number' })}</div>
                <div>{sInput('Topic (optional)', qForm.topic, v => setQForm({ ...qForm, topic: v }))}</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  {sInput('Correct Answer', qForm.correctAnswer, v => setQForm({ ...qForm, correctAnswer: v }), { type: qForm.questionType === 'ESSAY' || qForm.questionType === 'STRUCTURED' ? 'textarea' : 'text', rows: qForm.questionType === 'ESSAY' ? 3 : 1 })}
                </div>
              </div>

              {/* Options for MC / Matching */}
              {(qForm.questionType === 'MULTIPLE_CHOICE' || qForm.questionType === 'MATCHING') && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Options</label>
                  {qForm.options.map((opt: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                      <input value={opt} onChange={e => handleOptionChange(i, e.target.value)} placeholder={`Option ${i + 1}`} style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }} />
                      <button onClick={() => removeOption(i)} style={{ padding: '4px 10px', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', background: '#fefcf9', cursor: 'pointer' }}><i className="fa fa-times"></i></button>
                    </div>
                  ))}
                  <button onClick={addOption} style={{ padding: '6px 14px', border: '1px dashed #d1d5db', borderRadius: '8px', background: '#fefcf9', fontSize: '12px', cursor: 'pointer', color: '#3b82f6' }}>+ Add Option</button>
                </div>
              )}

              <div style={{ gridColumn: '1 / -1' }}>
                {sInput('Explanation (optional)', qForm.explanation, v => setQForm({ ...qForm, explanation: v }), { type: 'textarea', rows: 2 })}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={handleSaveQuestion} style={{ padding: '8px 20px', background: gradBlue, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-save"></i> {editingQuestion ? 'Update' : 'Add'} Question</button>
                {editingQuestion && <button onClick={() => setEditingQuestion(null)} style={{ padding: '8px 20px', background: '#fefcf9', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel Edit</button>}
              </div>
            </div>

            {/* Question List */}
            {questions.length === 0 ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>No questions yet. Use the form above to add questions.</p> : questions.map((q, i) => (
              <div key={q.id} style={{ padding: '12px 16px', border: '1px solid #f3f4f6', borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: '#1f2937' }}><span style={{ color: '#9ca3af', fontWeight: 400 }}>Q{i + 1}.</span> {q.question}</p>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
                    <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{q.questionType}</span>
                    <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{q.score} marks</span>
                    <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{q.difficulty || 'MEDIUM'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => { setEditingQuestion(q); setQForm({ question: q.question, questionType: q.questionType, options: q.options || ['', ''], correctAnswer: q.correctAnswer || '', explanation: q.explanation || '', score: q.score, difficulty: q.difficulty || 'MEDIUM', topic: q.topic || '' }); }} style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fefcf9', fontSize: '12px', cursor: 'pointer' }}><i className="fa fa-edit"></i></button>
                  <button onClick={() => handleDeleteQuestion(q.id)} style={{ padding: '4px 10px', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', background: '#fefcf9', fontSize: '12px', cursor: 'pointer' }}><i className="fa fa-trash"></i></button>
                </div>
              </div>
            ))}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowQuestionModal(false); setEditingQuestion(null); }} style={{ padding: '10px 24px', background: '#fefcf9', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TEMPLATE FORM MODAL ===== */}
      {showTemplateForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', width: '500px', maxWidth: '90vw' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>Exam Template</h2>
            {sInput('Template Name', templateForm.name, v => setTemplateForm({ ...templateForm, name: v }))}
            {sInput('Description', templateForm.description, v => setTemplateForm({ ...templateForm, description: v }), { type: 'textarea', rows: 2 })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {sInput('Subject', templateForm.subjectId, v => setTemplateForm({ ...templateForm, subjectId: v }), { type: 'select', options: subjects.map(s => ({ value: s.id, label: s.name })) })}
              <div>{sInput('Duration', templateForm.duration, v => setTemplateForm({ ...templateForm, duration: v }), { type: 'number' })}</div>
              <div>{sInput('Total Marks', templateForm.totalMarks, v => setTemplateForm({ ...templateForm, totalMarks: v }), { type: 'number' })}</div>
            </div>
            {sInput('Default Instructions', templateForm.instructions, v => setTemplateForm({ ...templateForm, instructions: v }), { type: 'textarea', rows: 3 })}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setShowTemplateForm(false)} style={{ padding: '10px 20px', background: '#fefcf9', color: '#374151', border: '1px solid #d1d5db', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveTemplate} style={{ padding: '10px 24px', background: gradPurple, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Save Template</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PREVIEW MODAL ===== */}
      {previewExam && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Preview: {previewExam.title}</h3>
              <button onClick={() => { setPreviewExam(null); setPreviewHtml(''); }} style={{ padding: '6px 14px', background: '#fefcf9', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
