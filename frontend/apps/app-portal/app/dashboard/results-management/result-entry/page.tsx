'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

export default function ResultEntryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [editingCell, setEditingCell] = useState<{ studentId: string; subjectId: string; value: string } | null>(null);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const r = await api.get('/subject');
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const subjects = useMemo(() => Array.isArray(subjectsData) ? subjectsData : [], [subjectsData]);

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
      if (sheetArr.length === 0) return [];
      const sheetId = sheetArr[0].id;
      const sr = await api.get(`/results-management/sheets/${sheetId}/students`);
      const sd = sr.data?.data || sr.data;
      return Array.isArray(sd) ? sd : [];
    },
    enabled: !!selectedClass && !!selectedTerm,
  });
  const students = useMemo(() => Array.isArray(studentsData) ? studentsData : [], [studentsData]);

  const isDirector = user?.roles?.includes('Director');

  const currentTermObj = useMemo(() => terms.find((t: any) => t.id === selectedTerm), [terms, selectedTerm]);

  const filteredStudents = useMemo(() => {
    if (!searchFilter) return students;
    const q = searchFilter.toLowerCase();
    return students.filter((s: any) =>
      (s.firstName?.toLowerCase() || '').includes(q) ||
      (s.lastName?.toLowerCase() || '').includes(q) ||
      (s.admissionNumber?.toLowerCase() || '').includes(q)
    );
  }, [students, searchFilter]);

  const updateScoreMutation = useMutation({
    mutationFn: ({ studentId, subjectId, score }: { studentId: string; subjectId: string; score: number }) =>
      api.post('/results', { studentId, subjectId, termId: selectedTerm, score }),
    onSuccess: () => {
      toast.success('Score saved');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save score');
    },
  });

  const handleCellSave = useCallback((studentId: string, subjectId: string, value: string) => {
    const score = parseFloat(value);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error('Score must be between 0 and 100');
      return;
    }
    updateScoreMutation.mutate({ studentId, subjectId, score });
    setEditingCell(null);
  }, [selectedTerm, updateScoreMutation]);

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
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (editingCell) {
        handleCellSave(editingCell.studentId, editingCell.subjectId, editingCell.value);
      }
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextCol >= 0 && nextCol <= classSubjects.length) {
        setActiveCell({ row: rowIdx, col: nextCol });
        if (nextCol === 0) {
          setEditingCell(null);
        } else {
          const student = filteredStudents[rowIdx];
          const subject = classSubjects[nextCol - 1];
          setEditingCell({ studentId: student.id, subjectId: subject.subject?.id || subject.subjectId, value: '' });
        }
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setActiveCell(null);
    }
  }, [editingCell, handleCellSave, filteredStudents, classSubjects]);

  const enteredCount = useMemo(() => {
    return students.reduce((count: number, s: any) => {
      return count + (s.results?.filter((r: any) => r.score != null).length || 0);
    }, 0);
  }, [students]);

  const totalCells = useMemo(() => students.length * classSubjects.length, [students, classSubjects]);
  const missingCount = totalCells - enteredCount;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Result Entry</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            Enter and edit student scores with spreadsheet-style navigation
          </p>
        </div>
        {currentTermObj?.isCurrent && (
          <span style={{
            padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
            background: '#d1fae5', color: '#059669'
          }}>
            <i className="fa fa-check-circle" style={{ marginRight: '6px' }}></i>
            Current Term
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Class</label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">Select Class</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term</label>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">Select Term</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Subject</label>
          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">All Subjects</option>
            {classSubjects.map((cs: any) => (
              <option key={cs.subject?.id || cs.subjectId} value={cs.subject?.id || cs.subjectId}>
                {cs.subject?.name || cs.subjectName || 'Unknown'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      {selectedClass && selectedTerm && (
        <div style={{
          display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap'
        }}>
          <div style={{
            flex: 1, minWidth: '140px', background: '#fdfaf7', border: '1px solid #e8ddd0',
            borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
            }}>
              <i className="fa fa-users"></i>
            </div>
            <div>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{students.length}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Total Students</p>
            </div>
          </div>
          <div style={{
            flex: 1, minWidth: '140px', background: '#fdfaf7', border: '1px solid #e8ddd0',
            borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669'
            }}>
              <i className="fa fa-check"></i>
            </div>
            <div>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{enteredCount}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Entered</p>
            </div>
          </div>
          <div style={{
            flex: 1, minWidth: '140px', background: '#fdfaf7', border: '1px solid #e8ddd0',
            borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706'
            }}>
              <i className="fa fa-exclamation-triangle"></i>
            </div>
            <div>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{missingCount}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Missing</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {students.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <input
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Search student by name or admission number..."
            style={{
              width: '100%', maxWidth: '400px', padding: '10px 14px 10px 40px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          />
          <i className="fa fa-search" style={{ position: 'relative', left: '30px', top: '1px', color: '#9ca3af' }}></i>
        </div>
      )}

      {/* Spreadsheet */}
      {studentsLoading ? (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#ea6645' }}></i>
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Loading students...</p>
        </div>
      ) : !selectedClass || !selectedTerm ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <i className="fa fa-hand-pointer" style={{ fontSize: '40px', color: '#e8ddd0' }}></i>
          <p style={{ color: '#9ca3af', marginTop: '12px' }}>Select a class and term to start entering results</p>
        </div>
      ) : students.length === 0 ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <i className="fa fa-user-graduate" style={{ fontSize: '40px', color: '#e8ddd0' }}></i>
          <p style={{ color: '#9ca3af', marginTop: '12px' }}>No students found for this class. Enroll students first.</p>
        </div>
      ) : (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          overflow: 'hidden', position: 'relative'
        }}>
          <div ref={tableRef} style={{ overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#5f4b3a', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{
                    textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 600,
                    fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px',
                    position: 'sticky', left: 0, background: '#5f4b3a', zIndex: 11,
                    minWidth: '200px'
                  }}>
                    Student Name
                  </th>
                  <th style={{
                    textAlign: 'left', padding: '12px 16px', color: 'white', fontWeight: 600,
                    fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px',
                    minWidth: '120px', position: 'sticky', left: '200px', background: '#5f4b3a', zIndex: 11
                  }}>
                    Admission No.
                  </th>
                  {classSubjects.map((cs: any) => (
                    <th key={cs.subject?.id || cs.subjectId} style={{
                      textAlign: 'center', padding: '12px 16px', color: 'white', fontWeight: 600,
                      fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px',
                      minWidth: '100px'
                    }}>
                      {cs.subject?.name || cs.subjectName || 'Subject'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student: any, rowIdx: number) => {
                  const isActive = activeCell?.row === rowIdx;
                  const nameStyle = {
                    position: 'sticky' as const, left: 0, background: '#fefcf9', zIndex: 2,
                    padding: '10px 16px', fontWeight: 600, color: '#1f2937',
                    borderBottom: '1px solid #e8ddd0',
                    boxShadow: isActive ? 'inset 3px 0 0 #ea6645' : 'none'
                  };
                  const admissionStyle = {
                    position: 'sticky' as const, left: '200px', background: '#fefcf9', zIndex: 2,
                    padding: '10px 16px', color: '#6b7280', fontSize: '13px',
                    borderBottom: '1px solid #e8ddd0'
                  };
                  return (
                    <tr key={student.id} style={{
                      background: isActive ? '#fffbeb' : rowIdx % 2 === 0 ? '#fefcf9' : '#faf7f4',
                      transition: 'background 0.15s'
                    }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f5efe8'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = rowIdx % 2 === 0 ? '#fefcf9' : '#faf7f4'; }}
                    >
                      <td style={nameStyle}>
                        {student.firstName} {student.lastName}
                      </td>
                      <td style={admissionStyle}>
                        {student.admissionNumber || '-'}
                      </td>
                      {classSubjects.map((cs: any, colIdx: number) => {
                        const subjectId = cs.subject?.id || cs.subjectId;
                        const result = student.results?.find((r: any) =>
                          r.subjectId === subjectId || r.subject?.id === subjectId
                        );
                        const score = result?.score;
                        const isEditing = editingCell?.studentId === student.id && editingCell?.subjectId === subjectId;
                        const isEmpty = score == null && !isEditing;
                        const cellKey = `${student.id}-${subjectId}`;

                        return (
                          <td key={cellKey} style={{
                            textAlign: 'center', padding: '4px 8px',
                            borderBottom: '1px solid #e8ddd0',
                            borderRight: '1px solid #e8ddd0',
                            background: isEmpty ? '#fffbeb' : isEditing ? '#dbeafe' : 'transparent',
                            cursor: 'pointer',
                            minWidth: '100px'
                          }}
                            onClick={() => {
                              setActiveCell({ row: rowIdx, col: colIdx + 2 });
                              setEditingCell({ studentId: student.id, subjectId, value: score != null ? String(score) : '' });
                            }}
                            onDoubleClick={() => {
                              setEditingCell({ studentId: student.id, subjectId, value: score != null ? String(score) : '' });
                            }}
                          >
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={editingCell?.value ?? ''}
                                onChange={e => setEditingCell({ studentId: student.id, subjectId, value: e.target.value })}
                                onBlur={() => {
                                  setTimeout(() => {
                                    if (editingCell?.studentId === student.id && editingCell?.subjectId === subjectId) {
                                      handleCellSave(student.id, subjectId, editingCell.value);
                                    }
                                  }, 200);
                                }}
                                onKeyDown={e => handleKeyDown(e, rowIdx, colIdx + 2, student.id, subjectId)}
                                style={{
                                  width: '80px', padding: '6px 8px', textAlign: 'center',
                                  border: '2px solid #3b82f6', borderRadius: '6px',
                                  fontSize: '14px', fontWeight: 600, outline: 'none',
                                  background: 'white'
                                }}
                                autoFocus
                              />
                            ) : (
                              <span style={{
                                fontWeight: score != null ? 600 : 400,
                                color: score != null
                                  ? score >= 75 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626'
                                  : '#d1d5db',
                                fontSize: '14px'
                              }}>
                                {score != null ? score : '-'}
                              </span>
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

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
