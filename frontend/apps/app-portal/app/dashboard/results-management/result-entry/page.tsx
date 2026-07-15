'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { socket } from '@/lib/socket';

const PASS_THRESHOLD = 50;

function getGradeColor(score: number | null) {
  if (score == null) return { bg: '#fef3c7', text: '#d97706' };
  if (score >= 75) return { bg: '#d1fae5', text: '#059669' };
  if (score >= 50) return { bg: '#dbeafe', text: '#2563eb' };
  return { bg: '#fee2e2', text: '#dc2626' };
}

function getGrade(result: any, score: number | null) {
  if (result?.grade) return result.grade;
  if (score == null) return '-';
  return String(score);
}

export default function ResultEntryPage() {
  const { user, isClassTeacher } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    const eventName = `result:updated:${schoolId}`;
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['sheet-students'] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
    };
    socket.on(eventName, handler);
    return () => { socket.off(eventName, handler); };
  }, [user?.schoolId, queryClient]);

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('bulk');
  const [searchFilter, setSearchFilter] = useState('');
  const [editingCell, setEditingCell] = useState<{ studentId: string; subjectId: string; value: string } | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [scores, setScores] = useState<Record<string, Record<string, number | null>>>({});
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [pasteMode, setPasteMode] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const r = await classApi.getAll();
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const classes = useMemo(() => Array.isArray(classesData) ? classesData : [], [classesData]);

  const { data: termsData } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const r = await termApi.getAll();
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const terms = useMemo(() => Array.isArray(termsData) ? termsData : [], [termsData]);

  const { data: classSubjectsData } = useQuery({
    queryKey: ['class-subjects', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const r = await api.get(`/class-subjects/class/${selectedClass}`);
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!selectedClass,
  });
  const classSubjects = useMemo(() => Array.isArray(classSubjectsData) ? classSubjectsData : [], [classSubjectsData]);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['sheet-students', selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return [];
      const r = await api.get('/results-management/sheets', { params: { classId: selectedClass, termId: selectedTerm } });
      const sheets = r.data?.data || r.data;
      const sheetArr = Array.isArray(sheets) ? sheets : [];
      const sheetId = sheetArr.length > 0 ? sheetArr[0].id : null;
      if (sheetId) {
        const sr = await api.get(`/results-management/sheets/${sheetId}/students`);
        const sd = sr.data?.data || sr.data;
        const students = Array.isArray(sd) ? sd : [];
        // If there are no results in the response, try getting students from enrollment endpoint
        const hasResults = students.some((s: any) => s.results?.length > 0);
        if (!hasResults) {
          // Fetch enrollment-based student list
          const er = await api.get(`/enrollments/class/${selectedClass}`);
          const ed = er.data?.data || er.data || [];
          const enrollments = Array.isArray(ed) ? ed : [];
          return enrollments.map((enr: any) => {
            const s = enr.student || enr;
            return {
              id: s.id, firstName: s.firstName, lastName: s.lastName,
              admissionNumber: s.admissionNumber, gender: s.gender, results: [],
            };
          });
        }
        return students;
      }
      // No sheet yet, try direct student enrollment
      const er = await api.get(`/enrollments/class/${selectedClass}`);
      const ed = er.data?.data || er.data || [];
      const enrollments = Array.isArray(ed) ? ed : [];
      return enrollments.map((enr: any) => {
        const s = enr.student || enr;
        return {
          id: s.id, firstName: s.firstName, lastName: s.lastName,
          admissionNumber: s.admissionNumber, gender: s.gender, results: [],
        };
      });
    },
    enabled: !!selectedClass && !!selectedTerm,
  });
  const students = useMemo(() => Array.isArray(studentsData) ? studentsData : [], [studentsData]);

  // Filter subjects based on entry mode
  const displaySubjects = useMemo(() => {
    if (selectedSubject === 'all') return classSubjects;
    return classSubjects.filter((cs: any) =>
      (cs.subject?.id || cs.subjectId) === selectedSubject
    );
  }, [classSubjects, selectedSubject]);

  const filteredStudents = useMemo(() => {
    if (!searchFilter) return students;
    const q = searchFilter.toLowerCase();
    return students.filter((s: any) =>
      (s.firstName?.toLowerCase() || '').includes(q) ||
      (s.lastName?.toLowerCase() || '').includes(q) ||
      (s.admissionNumber?.toLowerCase() || '').includes(q)
    );
  }, [students, searchFilter]);

  const [bulkSaving, setBulkSaving] = useState(false);

  const bulkSaveMutation = useMutation({
    mutationFn: (scoreList: Array<{ studentId: string; subjectId: string; termId: string; score: number }>) =>
      api.post('/results/bulk', { results: scoreList }, { timeout: 120000 }),
    onSuccess: (_data: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ['sheet-students'] });
      queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
      setDirtyCells(new Set());
      setBulkSaving(false);
      const count = variables?.length || 0;
      toast.success(`${count} score${count !== 1 ? 's' : ''} saved successfully`, {
        description: `${count} result${count !== 1 ? 's' : ''} have been recorded. You can now view the full results.`,
        action: {
          label: 'View Results',
          onClick: () => window.location.href = '/dashboard/results-management/view-results',
        },
        duration: 8000,
      });
    },
    onError: (err: any) => {
      setBulkSaving(false);
      toast.error(err?.response?.data?.message || 'Failed to save scores. Please try again.');
    },
  });

  const handleCellSave = useCallback((studentId: string, subjectId: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') return;
    const score = parseFloat(trimmed);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error('Score must be between 0 and 100');
      return;
    }
    const key = `${studentId}::${subjectId}`;
    setScores(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [subjectId]: score },
    }));
    setDirtyCells(prev => new Set(prev).add(key));
    setEditingCell(null);
  }, []);

  const handleBulkSaveAll = useCallback(() => {
    if (dirtyCells.size === 0) {
      toast.error('No changes to save');
      return;
    }
    if (bulkSaving || bulkSaveMutation.isPending) return;
    const scoreList: Array<{ studentId: string; subjectId: string; termId: string; score: number }> = [];
    dirtyCells.forEach(key => {
      const [studentId, subjectId] = key.split('::');
      const score = scores[studentId]?.[subjectId];
      if (score != null && score >= 0) {
        scoreList.push({ studentId, subjectId, termId: selectedTerm, score });
      }
    });
    if (scoreList.length > 0) {
      setBulkSaving(true);
      toast.info(`Saving ${scoreList.length} score${scoreList.length !== 1 ? 's' : ''}...`);
      bulkSaveMutation.mutate(scoreList);
    }
  }, [dirtyCells, scores, selectedTerm, bulkSaveMutation, bulkSaving]);

  const handlePasteFromExcel = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('Paste data must have at least 2 rows (header + data)');
        return;
      }
      const headers = lines[0].split('\t').map(h => h.trim());
      const subjectCols = headers.slice(4); // Skip Admission#, FirstName, LastName, Class
      let pasted = 0;
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        const admissionNo = cols[0]?.trim();
        if (!admissionNo) continue;

        const student = filteredStudents.find((s: any) =>
          s.admissionNumber?.toLowerCase() === admissionNo.toLowerCase()
        );
        if (!student) { errors++; continue; }

        for (let j = 0; j < subjectCols.length; j++) {
          const scoreVal = cols[j + 4]?.trim();
          if (!scoreVal) continue;
          const score = parseFloat(scoreVal);
          if (isNaN(score) || score < 0 || score > 100) { errors++; continue; }

          const subjectName = subjectCols[j].toLowerCase();
          const cs = classSubjects.find((c: any) =>
            (c.subject?.name || '').toLowerCase() === subjectName
          );
          if (!cs) { errors++; continue; }

          const subjectId = cs.subject?.id || cs.subjectId;
          const key = `${student.id}::${subjectId}`;
          setScores(prev => ({
            ...prev,
            [student.id]: { ...(prev[student.id] || {}), [subjectId]: score },
          }));
          setDirtyCells(prev => new Set(prev).add(key));
          pasted++;
        }
      }
      toast.success(`Pasted ${pasted} scores${errors > 0 ? `, ${errors} errors` : ''}`);
      setPasteMode(false);
    } catch {
      toast.error('Failed to read clipboard. Make sure you have copied data from Excel.');
    }
  }, [filteredStudents, classSubjects]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIdx: number, colIdx: number, studentId: string, subjectId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingCell) {
        handleCellSave(editingCell.studentId, editingCell.subjectId, editingCell.value);
      }
      const nextRow = rowIdx + 1;
      if (nextRow < filteredStudents.length) {
        setActiveCell({ row: nextRow, col: colIdx });
        const student = filteredStudents[nextRow];
        setEditingCell({ studentId: student.id, subjectId, value: '' });
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (editingCell) {
        handleCellSave(editingCell.studentId, editingCell.subjectId, editingCell.value);
      }
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
      const minCol = 2;
      const maxCol = 1 + displaySubjects.length;
      if (nextCol >= minCol && nextCol <= maxCol) {
        setActiveCell({ row: rowIdx, col: nextCol });
        if (nextCol >= 2) {
          const student = filteredStudents[rowIdx];
          const subj = displaySubjects[nextCol - 2];
          if (subj) {
            const subjId = subj.subject?.id || subj.subjectId;
            setEditingCell({ studentId: student.id, subjectId: subjId, value: '' });
          }
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setActiveCell(null);
    }
  }, [editingCell, handleCellSave, filteredStudents, displaySubjects]);

  const stats = useMemo(() => {
    if (!students.length || !displaySubjects.length) return { entered: 0, total: 0, missing: 0 };
    const total = students.length * displaySubjects.length;
    let entered = 0;
    students.forEach((s: any) => {
      displaySubjects.forEach((cs: any) => {
        const subjId = cs.subject?.id || cs.subjectId;
        const r = s.results?.find((res: any) => res.subjectId === subjId || res.subject?.id === subjId);
        const pending = scores[s.id]?.[subjId];
        if (r?.score != null || pending != null) entered++;
      });
    });
    return { entered, total, missing: total - entered };
  }, [students, displaySubjects, scores]);

  const isDirector = user?.roles?.includes('Director');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Result Entry</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            {entryMode === 'bulk' ? 'Enter scores for all subjects at once (Class Teacher Mode)' : 'Enter scores for one subject at a time'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setEntryMode(entryMode === 'bulk' ? 'single' : 'bulk')}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              background: entryMode === 'bulk' ? '#5f4b3a' : '#f5efe8',
              color: entryMode === 'bulk' ? 'white' : '#374151',
              border: 'none', borderRadius: '8px', cursor: 'pointer'
            }}
          >
            <i className={`fa ${entryMode === 'bulk' ? 'fa-table' : 'fa-edit'}`} style={{ marginRight: '6px' }}></i>
            {entryMode === 'bulk' ? 'Bulk Mode (All Subjects)' : 'Single Subject'}
          </button>
          <button
            onClick={() => setPasteMode(true)}
            style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600,
              background: '#eff6ff', color: '#3b82f6', border: '1px solid #93c5fd',
              borderRadius: '8px', cursor: 'pointer'
            }}
          >
            <i className="fa fa-paste" style={{ marginRight: '6px' }}></i>
            Paste from Excel
          </button>
        </div>
      </div>

      {/* Paste Modal */}
      {pasteMode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)'
        }}
          onClick={e => { if (e.target === e.currentTarget) setPasteMode(false); }}
        >
          <div style={{
            background: '#fdfaf7', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>Paste from Excel</h2>
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
              Copy cells from Excel/Sheets and paste them here. The data must include: AdmissionNumber, FirstName, LastName, Class, followed by subject columns.
            </p>
            <div style={{
              background: '#fefcf9', border: '2px dashed #e8ddd0', borderRadius: '10px',
              padding: '24px', textAlign: 'center', marginBottom: '20px'
            }}>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 12px' }}>
                Press <strong>Ctrl+V</strong> or click the button below to paste
              </p>
              <button
                onClick={handlePasteFromExcel}
                style={{
                  padding: '12px 32px', fontSize: '14px', fontWeight: 600, color: 'white',
                  background: '#ea6645', border: 'none', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                <i className="fa fa-paste" style={{ marginRight: '8px' }}></i>
                Paste from Clipboard
              </button>
            </div>
            <button
              onClick={() => setPasteMode(false)}
              style={{ padding: '8px 16px', fontSize: '14px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Class</label>
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject('all'); }}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}>
            <option value="">Select Class</option>
            {classes.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term</label>
          <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}>
            <option value="">Select Term</option>
            {terms.map((t: any) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
        {entryMode === 'single' && (
          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Subject</label>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}>
              <option value="all">All Subjects</option>
              {classSubjects.map((cs: any) => (
                <option key={cs.subject?.id || cs.subjectId} value={cs.subject?.id || cs.subjectId}>
                  {cs.subject?.name || cs.subjectName || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {selectedClass && selectedTerm && students.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px', background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '10px', padding: '14px 18px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{students.length}</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Students</p>
          </div>
          <div style={{ flex: 1, minWidth: '120px', background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '10px', padding: '14px 18px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#059669', margin: 0 }}>{stats.entered}</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Entered</p>
          </div>
          <div style={{ flex: 1, minWidth: '120px', background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '10px', padding: '14px 18px' }}>
            <p style={{ fontSize: '22px', fontWeight: 700, color: '#d97706', margin: 0 }}>{stats.missing}</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Missing</p>
          </div>
          <div style={{ flex: 1, minWidth: '120px', background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '10px', padding: '14px 18px' }}>
            <div style={{ height: '8px', background: '#e8ddd0', borderRadius: '4px', marginTop: '8px' }}>
              <div style={{
                width: `${stats.total > 0 ? Math.round((stats.entered / stats.total) * 100) : 0}%`,
                height: '100%', background: '#059669', borderRadius: '4px', transition: 'width 0.3s'
              }}></div>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0', textAlign: 'right' }}>
              {stats.total > 0 ? Math.round((stats.entered / stats.total) * 100) : 0}% Complete
            </p>
          </div>
        </div>
      )}

      {/* Search + Save */}
      {students.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <i className="fa fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}></i>
            <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search by name or admission number..."
              style={{ width: '100%', padding: '10px 14px 10px 38px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleBulkSaveAll}
              disabled={dirtyCells.size === 0 || bulkSaveMutation.isPending || bulkSaving}
              style={{
                padding: '10px 20px', fontSize: '13px', fontWeight: 600, color: 'white',
                background: dirtyCells.size === 0 ? '#d1d5db' : '#059669',
                border: 'none', borderRadius: '8px', cursor: dirtyCells.size === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <i className={`fa ${bulkSaveMutation.isPending ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
              {bulkSaveMutation.isPending ? 'Saving...' : `Save All (${dirtyCells.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Spreadsheet */}
      {studentsLoading ? (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#ea6645' }}></i>
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Loading students...</p>
        </div>
      ) : !selectedClass || !selectedTerm ? (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-hand-pointer" style={{ fontSize: '40px', color: '#e8ddd0' }}></i>
          <p style={{ color: '#9ca3af', marginTop: '12px' }}>Select a class and term to start entering results</p>
        </div>
      ) : students.length === 0 ? (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-user-graduate" style={{ fontSize: '40px', color: '#e8ddd0' }}></i>
          <p style={{ color: '#9ca3af', marginTop: '12px' }}>No students found. Enroll students first.</p>
        </div>
      ) : (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden' }}>
          <div ref={tableRef} style={{ overflow: 'auto', maxHeight: 'calc(100vh - 440px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#5f4b3a', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{
                    textAlign: 'left', padding: '10px 14px', color: 'white', fontWeight: 600,
                    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px',
                    position: 'sticky', left: 0, background: '#5f4b3a', zIndex: 11, minWidth: '180px'
                  }}>
                    <i className="fa fa-user" style={{ marginRight: '6px' }}></i>Student Name
                  </th>
                  <th style={{
                    textAlign: 'left', padding: '10px 14px', color: 'white', fontWeight: 600,
                    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px',
                    minWidth: '110px', position: 'sticky', left: '180px', background: '#5f4b3a', zIndex: 11
                  }}>
                    <i className="fa fa-id-card" style={{ marginRight: '6px' }}></i>Admission No.
                  </th>
                  {displaySubjects.map((cs: any, idx: number) => {
                    const subjName = cs.subject?.name || cs.subjectName || 'Subject';
                    const short = subjName.length > 12 ? subjName.slice(0, 10) + '..' : subjName;
                    return (
                      <th key={cs.subject?.id || cs.subjectId} style={{
                        textAlign: 'center', padding: '10px 8px', color: 'white', fontWeight: 600,
                        fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.3px',
                        minWidth: '80px', maxWidth: '100px',
                        background: '#5f4b3a',
                        borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.15)' : 'none'
                      }}>
                        <div>{short}</div>
                        <div style={{ fontSize: '9px', opacity: 0.7, fontWeight: 400 }}>{isNaN(stats.entered) ? '' : `${students.length} stds`}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student: any, rowIdx: number) => {
                  const isActive = activeCell?.row === rowIdx;
                  const studentScores = scores[student.id] || {};
                  const rowClass = isActive ? '#fffbeb' : rowIdx % 2 === 0 ? '#fefcf9' : '#faf7f4';

                  return (
                    <tr key={student.id} style={{ background: rowClass, transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f5efe8'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = rowClass; }}>
                      <td style={{
                        position: 'sticky', left: 0, background: rowClass, zIndex: 2,
                        padding: '8px 14px', fontWeight: 600, color: '#1f2937',
                        borderBottom: '1px solid #e8ddd0',
                        boxShadow: isActive ? 'inset 3px 0 0 #ea6645' : 'none'
                      }}>
                        {student.firstName} {student.lastName}
                      </td>
                      <td style={{
                        position: 'sticky', left: '180px', background: rowClass, zIndex: 2,
                        padding: '8px 14px', color: '#6b7280', fontSize: '12px',
                        borderBottom: '1px solid #e8ddd0'
                      }}>
                        {student.admissionNumber || '-'}
                      </td>
                      {displaySubjects.map((cs: any, colIdx: number) => {
                        const subjId = cs.subject?.id || cs.subjectId;
                        const result = student.results?.find((r: any) =>
                          r.subjectId === subjId || r.subject?.id === subjId
                        );
                        const dbScore = result?.score;
                        const pendingScore = studentScores[subjId];
                        const effectiveScore = pendingScore != null ? pendingScore : dbScore;
                        const isEmpty = effectiveScore == null && (!editingCell || editingCell.studentId !== student.id || editingCell.subjectId !== subjId);
                        const isEditing = editingCell?.studentId === student.id && editingCell?.subjectId === subjId;
                        const isDirty = dirtyCells.has(`${student.id}::${subjId}`);
                        const cellKey = `${student.id}::${subjId}`;
                        const colors = getGradeColor(effectiveScore);

                        let cellBg = 'transparent';
                        if (isEmpty) cellBg = '#fffbeb';
                        if (isEditing) cellBg = '#dbeafe';
                        if (isDirty) cellBg = '#ecfdf5';
                        if (effectiveScore != null && effectiveScore < PASS_THRESHOLD && !isEditing) {
                          cellBg = '#fef2f2';
                        }

                        return (
                          <td key={cellKey} style={{
                            textAlign: 'center', padding: '2px 4px',
                            borderBottom: '1px solid #e8ddd0', borderRight: '1px solid #e8ddd0',
                            background: cellBg, cursor: 'pointer', minWidth: '80px'
                          }}
                            onClick={() => {
                              setActiveCell({ row: rowIdx, col: colIdx + 2 });
                              setEditingCell({ studentId: student.id, subjectId: subjId, value: effectiveScore != null ? String(effectiveScore) : '' });
                              setTimeout(() => inputRef.current?.focus(), 50);
                            }}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type="number" min="0" max="100" step="0.5"
                                value={editingCell?.value ?? ''}
                                onChange={e => setEditingCell({ studentId: student.id, subjectId: subjId, value: e.target.value })}
                                onBlur={() => {
                                  if (editingCell?.studentId === student.id && editingCell?.subjectId === subjId) {
                                    handleCellSave(student.id, subjId, editingCell.value);
                                  }
                                }}
                                onKeyDown={e => handleKeyDown(e, rowIdx, colIdx + 2, student.id, subjId)}
                                style={{
                                  width: '64px', padding: '5px 6px', textAlign: 'center',
                                  border: '2px solid #3b82f6', borderRadius: '6px',
                                  fontSize: '13px', fontWeight: 600, outline: 'none', background: 'white'
                                }}
                                autoFocus
                              />
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '6px 0' }}>
                                <span style={{
                                  fontWeight: effectiveScore != null ? 600 : 400,
                                  color: effectiveScore != null ? colors.text : '#d1d5db',
                                  fontSize: '14px'
                                }}>
                                  {effectiveScore != null ? effectiveScore : '-'}
                                </span>
                                {effectiveScore != null && (
                                  <span style={{
                                    fontSize: '10px', fontWeight: 600,
                                    padding: '1px 8px', borderRadius: '10px',
                                    background: colors.bg, color: colors.text
                                  }}>
                                    {getGrade(result, effectiveScore)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      <div style={{ marginTop: '16px', background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '10px', padding: '12px 20px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          <kbd style={{ padding: '2px 6px', background: '#f5efe8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Enter</kbd> Move down
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          <kbd style={{ padding: '2px 6px', background: '#f5efe8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Tab</kbd> Move right
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          <kbd style={{ padding: '2px 6px', background: '#f5efe8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Shift+Tab</kbd> Move left
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          <kbd style={{ padding: '2px 6px', background: '#f5efe8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Esc</kbd> Cancel edit
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          <i className="fa fa-paste" style={{ marginRight: '4px' }}></i>
          <kbd style={{ padding: '2px 6px', background: '#f5efe8', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Paste</kbd> Import from Excel
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          Yellow cells = Missing marks, <span style={{ color: '#dc2626' }}>Red background</span> = Failed ({'<'}50%)
        </span>
        {stats.entered > 0 && (
          <a href="/dashboard/results-management/view-results" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '12px', fontWeight: 600, color: '#059669', background: '#d1fae5', borderRadius: '6px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className="fa fa-eye"></i> View Results
          </a>
        )}
      </div>
    </div>
  );
}
