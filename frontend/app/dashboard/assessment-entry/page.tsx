'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DataGrid,
  GridColDef,
  GridRowModel,
  GridCellEditStopParams,
  GridCellEditStopReasons,
  GridEditCellProps,
} from '@mui/x-data-grid';
import { assessmentEngineApi, classApi, subjectApi, termApi, studentApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

interface StudentRow {
  id: string;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  rawScore: number | null;
  percentage: number | null;
  grade: string | null;
  remarks: string | null;
  isAbsent: boolean;
  existing: boolean;
}

function computeGrade(percentage: number): string {
  if (percentage >= 75) return '1';
  if (percentage >= 70) return '2';
  if (percentage >= 65) return '3';
  if (percentage >= 60) return '4';
  if (percentage >= 55) return '5';
  if (percentage >= 50) return '6';
  if (percentage >= 45) return '7';
  if (percentage >= 40) return '8';
  return '9';
}

export default function AssessmentEntryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [maxScore, setMaxScore] = useState(100);
  const [saving, setSaving] = useState(false);
  const [batchTitle, setBatchTitle] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showSavedBanner, setShowSavedBanner] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: assessmentDefs } = useQuery({
    queryKey: ['assessment-defs'],
    queryFn: () => assessmentEngineApi.definitions.list().then(r => r.data?.data || r.data),
    enabled: !!user?.schoolId,
  });

  const { data: configurations } = useQuery({
    queryKey: ['assessment-configs', selectedClass, selectedSubject, selectedTerm],
    queryFn: () =>
      assessmentEngineApi.configurations.get(selectedClass, selectedSubject, selectedTerm).then(
        r => r.data?.data || r.data
      ),
    enabled: !!(selectedClass && selectedSubject && selectedTerm),
  });

  const { data: students } = useQuery({
    queryKey: ['students', selectedClass],
    queryFn: () =>
      studentApi.getAll({ classId: selectedClass }).then(r => r.data?.data || r.data),
    enabled: !!selectedClass,
  });

  const { data: existingResults } = useQuery({
    queryKey: ['class-results', selectedClass, selectedSubject, selectedTerm, selectedAssessment],
    queryFn: () =>
      assessmentEngineApi.results.class(selectedClass, selectedSubject, selectedTerm, selectedAssessment).then(
        r => r.data?.data || r.data
      ),
    enabled: !!(selectedClass && selectedSubject && selectedTerm && selectedAssessment),
  });

  useEffect(() => {
    if (students && selectedAssessment) {
      const config = configurations?.find((c: any) => c.assessmentDefId === selectedAssessment);
      if (config) {
        setMaxScore(config.maxScore);
      }

      const resultRows: StudentRow[] = students
        .filter((s: any) => s.status === 'ACTIVE' || !s.status)
        .map((student: any) => {
          const existing = existingResults?.find((r: any) => r.studentId === student.id);
          return {
            id: student.id,
            studentId: student.id,
            admissionNumber: student.admissionNumber || '',
            firstName: student.firstName || '',
            lastName: student.lastName || '',
            rawScore: existing?.rawScore ?? null,
            percentage: existing?.percentage ?? null,
            grade: existing?.grade ?? null,
            remarks: existing?.remarks ?? null,
            isAbsent: existing?.isAbsent ?? false,
            existing: !!existing,
          };
        });

      setRows(resultRows);
    }
  }, [students, selectedAssessment, configurations, existingResults]);

  const bulkSaveMutation = useMutation({
    mutationFn: (data: any) => assessmentEngineApi.scores.bulk(data).then(r => r.data?.data || r.data),
    onSuccess: (data: any) => {
      const count = data.summary?.entered || 0;
      setSavedCount(count);
      setLastSavedAt(new Date().toLocaleTimeString());
      setShowSavedBanner(true);
      setTimeout(() => setShowSavedBanner(false), 8000);
      toast.success(`${count} scores saved successfully`);
      queryClient.invalidateQueries({ queryKey: ['class-results'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'pending'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save scores');
    },
  });

  const handleSave = useCallback(() => {
    if (!selectedClass || !selectedSubject || !selectedTerm || !selectedAssessment) {
      toast.error('Please select class, subject, term, and assessment type');
      return;
    }

    const scores = rows
      .filter(r => r.rawScore !== null || r.isAbsent)
      .map(r => ({
        studentId: r.studentId,
        rawScore: r.rawScore,
        isAbsent: r.isAbsent,
        absentCode: r.isAbsent ? ('X' as const) : undefined,
        remarks: r.remarks || undefined,
      }));

    if (scores.length === 0) {
      toast.error('No scores to save');
      return;
    }

    setSaving(true);
    bulkSaveMutation.mutate({
      classId: selectedClass,
      subjectId: selectedSubject,
      termId: selectedTerm,
      assessmentDefId: selectedAssessment,
      maxScore,
      title: batchTitle || undefined,
      scores,
    }, {
      onSettled: () => setSaving(false),
    });
  }, [rows, selectedClass, selectedSubject, selectedTerm, selectedAssessment, maxScore, batchTitle, bulkSaveMutation]);

  const handleCellEditStop = useCallback((params: GridCellEditStopParams, event: any) => {
    event.defaultMuiPrevented = true;

    const { id, field, value } = params;

    setRows(prev => {
      const updated = prev.map(row => {
        if (row.id !== id) return row;

        if (field === 'rawScore') {
          const strValue = String(value).trim().toUpperCase();

          if (strValue === 'X' || strValue === 'A') {
            return { ...row, rawScore: null, isAbsent: true, percentage: null, grade: null, remarks: `[Absent-${strValue}]` };
          }

          if (strValue === '' || strValue === 'null') {
            return { ...row, rawScore: null, isAbsent: false, percentage: null, grade: null };
          }

          const numValue = parseFloat(value);
          if (isNaN(numValue) || numValue < 0 || numValue > maxScore) {
            toast.error(`Score must be between 0 and ${maxScore}, or X/A for absent`);
            return row;
          }
          const percentage = (numValue / maxScore) * 100;
          const grade = computeGrade(percentage);
          return { ...row, rawScore: numValue, isAbsent: false, percentage, grade };
        }

        return { ...row, [field]: value };
      });

      return updated;
    });

    const activeCell = document.querySelector(`[data-field="${field}"][data-id="${id}"]`);
    if (activeCell) {
      const input = activeCell.querySelector('input');
      if (input) input.focus();
    }
  }, [maxScore]);

  const handleCellEditStart = useCallback((params: any) => {
    setTimeout(() => {
      const input = document.querySelector(`[data-field="${params.field}"][data-id="${params.id}"] input`) as HTMLInputElement;
      if (input && params.field === 'rawScore') {
        input.type = 'text';
        input.inputMode = 'decimal';
      }
    }, 0);
  }, []);

  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'existing',
      headerName: '',
      width: 40,
      editable: false,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        if (params.value) {
          return (
            <span className="flex items-center justify-center w-full h-full" title="Previously saved">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
          );
        }
        return null;
      },
    },
    {
      field: 'admissionNumber',
      headerName: 'Adm No',
      width: 100,
      editable: false,
      sortable: true,
    },
    {
      field: 'firstName',
      headerName: 'First Name',
      width: 150,
      editable: false,
      sortable: true,
    },
    {
      field: 'lastName',
      headerName: 'Last Name',
      width: 150,
      editable: false,
      sortable: true,
    },
    {
      field: 'rawScore',
      headerName: 'Score (X=Absent)',
      width: 130,
      editable: true,
      sortable: false,
      valueGetter: (value: any, row: any) => {
        if (row.isAbsent) return 'X';
        return value;
      },
      cellClassName: (params: any) => {
        if (params.row?.isAbsent) return 'score-absent';
        if (params.value === null || params.value === undefined) return '';
        if (params.value >= 75) return 'score-distinction';
        if (params.value >= 60) return 'score-credit';
        if (params.value >= 40) return 'score-pass';
        return 'score-fail';
      },
    },
    {
      field: 'percentage',
      headerName: '%',
      width: 80,
      editable: false,
      sortable: true,
      type: 'number',
      valueFormatter: (value: number | null) => value !== null ? `${value.toFixed(1)}%` : '-',
    },
    {
      field: 'grade',
      headerName: 'Grade',
      width: 80,
      editable: false,
      sortable: true,
      cellClassName: (params) => {
        const grade = params.value;
        if (!grade) return '';
        const num = parseInt(grade);
        if (num <= 2) return 'grade-excellent';
        if (num <= 4) return 'grade-good';
        if (num <= 6) return 'grade-average';
        return 'grade-poor';
      },
    },
    {
      field: 'remarks',
      headerName: 'Remarks',
      width: 200,
      editable: true,
      sortable: false,
    },
  ], []);

  const rowCount = rows.length;
  const enteredCount = rows.filter(r => r.rawScore !== null || r.isAbsent).length;
  const absentCount = rows.filter(r => r.isAbsent).length;
  const missingCount = rowCount - enteredCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Assessment Score Entry</h1>
        <p className="text-gray-500 mt-1">Enter scores for entire class at once. Saved scores are preserved and restored when you return. <span className="text-green-600 font-medium">Synced to results sheet.</span></p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedClass}
              onChange={e => { setSelectedClass(e.target.value); setSelectedAssessment(''); }}
            >
              <option value="">Select Class</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
            >
              <option value="">Select Subject</option>
              {subjects?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Type</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedAssessment}
              onChange={e => setSelectedAssessment(e.target.value)}
            >
              <option value="">Select Assessment</option>
              {configurations?.map((c: any) => (
                <option key={c.assessmentDefId} value={c.assessmentDefId}>
                  {c.assessmentDef?.name} ({c.weightPercentage}%, Max: {c.maxScore})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch Title (Optional)</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. CAT 1"
              value={batchTitle}
              onChange={e => setBatchTitle(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selectedAssessment && (
        <div className="bg-white rounded-lg shadow p-4">
          {showSavedBanner && (
            <div className="mb-3 flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
              <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>{savedCount}</strong> score{savedCount !== 1 ? 's' : ''} saved successfully at <strong>{lastSavedAt}</strong>.
                {' '}All saved scores are synced to the results sheet and will be preserved when you return.
              </span>
              <button onClick={() => setShowSavedBanner(false)} className="ml-auto text-green-500 hover:text-green-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                <i className="fa fa-users mr-1"></i>
                {rowCount} students
              </span>
              <span className="text-sm text-green-600">
                <i className="fa fa-check-circle mr-1"></i>
                {enteredCount} entered
              </span>
              <span className="text-sm text-orange-600">
                <i className="fa fa-user-slash mr-1"></i>
                {absentCount} absent
              </span>
              <span className="text-sm text-red-600">
                <i className="fa fa-exclamation-circle mr-1"></i>
                {missingCount} missing
              </span>
              <span className="text-sm text-gray-500">
                Max: <strong>{maxScore}</strong>
              </span>
              {lastSavedAt && !showSavedBanner && (
                <span className="text-xs text-gray-400 border-l border-gray-200 pl-3">
                  Last saved: <strong>{lastSavedAt}</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const text = navigator.clipboard.readText?.();
                  toast.info('Paste from Excel: Click first score cell and press Ctrl+V');
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <i className="fa fa-paste mr-1"></i>Paste from Excel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || enteredCount === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><i className="fa fa-spinner fa-spin mr-1"></i>Saving...</>
                ) : (
                  <><i className="fa fa-save mr-1"></i>Save All ({enteredCount})</>
                )}
              </button>
            </div>
          </div>

          <div className="assessment-data-grid">
            <DataGrid
              rows={rows}
              columns={columns}
              pageSizeOptions={[20, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 50 } },
                sorting: { sortModel: [{ field: 'lastName', sort: 'asc' }] },
              }}
              disableRowSelectionOnClick
              editMode="cell"
              processRowUpdate={(newRow: GridRowModel, oldRow: GridRowModel) => {
                setRows(prev => prev.map(r => r.id === newRow.id ? newRow as StudentRow : r));
                return newRow;
              }}
              onCellEditStart={handleCellEditStart}
              onCellEditStop={handleCellEditStop}
              sx={{
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                '& .MuiDataGrid-main': { border: 'none' },
                '& .MuiDataGrid-cell': {
                  borderRight: '1px solid #e5e7eb',
                  borderBottom: '1px solid #e5e7eb',
                  outline: 'none',
                },
                '& .MuiDataGrid-cell:focus': { outline: 'none' },
                '& .MuiDataGrid-cell:focus-within': { outline: 'none' },
                '& .MuiDataGrid-columnHeader': {
                  borderRight: '1px solid #d1d5db',
                  backgroundColor: '#f1f5f9',
                },
                '& .MuiDataGrid-columnHeader:last-child': { borderRight: 'none' },
                '& .score-distinction': {
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  fontWeight: 600,
                },
                '& .score-credit': {
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  fontWeight: 600,
                },
                '& .score-pass': {
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  fontWeight: 600,
                },
                '& .score-fail': {
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  fontWeight: 600,
                },
                '& .score-absent': {
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  fontWeight: 700,
                  fontStyle: 'italic',
                },
                '& .grade-excellent': { color: '#059669', fontWeight: 700 },
                '& .grade-good': { color: '#2563eb', fontWeight: 600 },
                '& .grade-average': { color: '#d97706' },
                '& .grade-poor': { color: '#dc2626' },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#f1f5f9',
                  fontWeight: 600,
                  borderBottom: '2px solid #cbd5e1',
                },
                '& .MuiDataGrid-row:nth-of-type(even)': {
                  backgroundColor: '#f8fafc',
                },
                '& .MuiDataGrid-row:nth-of-type(odd)': {
                  backgroundColor: '#ffffff',
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: '#eef2ff',
                },
                '& .MuiDataGrid-cell--editable': {
                  backgroundColor: '#fffbeb',
                },
                '& .MuiDataGrid-cell--editing': {
                  backgroundColor: '#fefce8',
                  boxShadow: 'inset 0 0 0 2px #f59e0b',
                },
              }}
            />
          </div>
        </div>
      )}

      {!selectedAssessment && selectedClass && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <i className="fa fa-clipboard text-4xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">Select class, subject, term, and assessment type to begin entering scores</p>
        </div>
      )}

      <style jsx global>{`
        .assessment-data-grid .MuiDataGrid-cell {
          padding: 4px 8px !important;
        }
        .assessment-data-grid .MuiDataGrid-cell input {
          text-align: center;
          font-weight: 600;
          font-size: 14px;
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
        }
        .assessment-data-grid .MuiDataGrid-columnHeader[data-field="rawScore"] {
          background-color: #fef9c3 !important;
        }
        .assessment-data-grid .MuiDataGrid-columnHeader[data-field="remarks"] {
          background-color: #f0f9ff !important;
        }
        .assessment-data-grid .MuiDataGrid-cell[data-field="rawScore"]:not(.MuiDataGrid-cell--editing) {
          background-color: #fffbeb;
          cursor: pointer;
        }
        .assessment-data-grid .MuiDataGrid-cell[data-field="remarks"]:not(.MuiDataGrid-cell--editing) {
          background-color: #f0f9ff;
          cursor: pointer;
        }
        .assessment-data-grid .score-absent {
          background-color: #fef3c7 !important;
          color: #92400e !important;
          font-weight: 700;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
