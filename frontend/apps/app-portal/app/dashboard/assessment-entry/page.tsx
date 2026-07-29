'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DataGrid,
  GridColDef,
  GridRowModel,
  GridCellEditStopParams,
  GridCellEditStopReasons,
} from '@mui/x-data-grid';
import { assessmentEngineApi, classApi, subjectApi, termApi, studentApi, classSubjectApi } from '@/lib/api';
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

function SavingOverlay({ visible, enteredCount, assessmentName }: { visible: boolean; enteredCount: number; assessmentName: string }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-600 border-t-transparent mx-auto mb-6" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Saving Scores...</h3>
        <p className="text-gray-500 mb-2">
          Saving {enteredCount} score{enteredCount !== 1 ? 's' : ''} for <strong>{assessmentName}</strong>
        </p>
        <div className="w-full bg-gray-100 rounded-full h-2 mt-4">
          <div className="bg-indigo-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
        </div>
        <p className="text-xs text-gray-400 mt-3">Please wait while your scores are being saved and synced to the results sheet.</p>
      </div>
    </div>
  );
}

function SuccessModal({ visible, enteredCount, assessmentName, onClose }: { visible: boolean; enteredCount: number; assessmentName: string; onClose: () => void }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Scores Saved Successfully</h3>
          <p className="text-gray-600 mb-4">
            {enteredCount} score{enteredCount !== 1 ? 's' : ''} for <strong>{assessmentName}</strong> have been saved.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 mb-6 text-left">
            <p className="text-sm text-blue-800 leading-relaxed">
              Your assessment scores have been successfully saved. This will automatically be submitted to the results sheet in the Results Management. The status will remain pending until verified and approved by the relevant supervisor, then the results sheet progress bar will move depending on how many assessment scores/exam types have been submitted.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletionProgressBar({ completionRate, label, sublabel }: { completionRate: number; label: string; sublabel?: string }) {
  const color = completionRate >= 100 ? 'bg-green-500' : completionRate >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span className="font-medium text-gray-700">{label}</span>
          <span>{completionRate.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${Math.min(completionRate, 100)}%` }} />
        </div>
        {sublabel && <p className="text-[11px] text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
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
  const [batchTitle, setBatchTitle] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: classSubjects, isLoading: classSubjectsLoading } = useQuery({
    queryKey: ['class-subjects-entry', selectedClass, selectedTerm],
    queryFn: async () => {
      if (!selectedClass) return [];
      const res = await classSubjectApi.getByClass(selectedClass, selectedTerm || undefined);
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedClass,
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

  const { data: completionData } = useQuery({
    queryKey: ['completion-stats', selectedClass, selectedSubject, selectedTerm],
    queryFn: () =>
      assessmentEngineApi.completionStats(selectedClass, selectedSubject, selectedTerm).then(
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

  const selectedConfig = useMemo(() => {
    return configurations?.find((c: any) => c.assessmentDefId === selectedAssessment);
  }, [configurations, selectedAssessment]);

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
      setSavedCount(data.summary?.entered || 0);
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ['class-results'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['completion-stats'] });
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

    bulkSaveMutation.mutate({
      classId: selectedClass,
      subjectId: selectedSubject,
      termId: selectedTerm,
      assessmentDefId: selectedAssessment,
      maxScore,
      title: batchTitle || undefined,
      scores,
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

  const columns: GridColDef[] = useMemo(() => [
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

  const assessments = completionData?.assessments || [];

  return (
    <div className="space-y-6">
      <SavingOverlay
        visible={bulkSaveMutation.isPending}
        enteredCount={enteredCount}
        assessmentName={selectedConfig?.assessmentDef?.name || ''}
      />

      <SuccessModal
        visible={showSuccessModal}
        enteredCount={savedCount}
        assessmentName={selectedConfig?.assessmentDef?.name || ''}
        onClose={() => setShowSuccessModal(false)}
      />

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Assessment Score Entry</h1>
        <p className="text-gray-500 mt-1">Enter scores for entire class at once. Scores auto-sync to results sheet on submit.</p>
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
            {selectedClass ? (
              classSubjectsLoading ? (
                <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 text-sm">Loading subjects...</div>
              ) : classSubjects && classSubjects.length > 0 ? (
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                >
                  <option value="">Select Subject</option>
                  {classSubjects.map((cs: any) => {
                    const subj = cs.subject || cs;
                    return (
                      <option key={subj.id} value={subj.id}>{subj.name}{subj.code ? ` (${subj.code})` : ''}</option>
                    );
                  })}
                </select>
              ) : (
                <div className="w-full px-3 py-3 border rounded-lg bg-amber-50 border-amber-200">
                  <p className="text-amber-700 text-sm font-medium">No subjects assigned to this class.</p>
                </div>
              )
            ) : (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-400 text-sm">Select a class first</div>
            )}
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

      {selectedClass && selectedSubject && selectedTerm && assessments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Assessment Completion Progress</h3>
          <div className="space-y-3">
            {assessments.map((a: any) => (
              <CompletionProgressBar
                key={a.assessmentDefId}
                completionRate={a.completionRate}
                label={`${a.assessmentName} (${a.weightPercentage}%)`}
                sublabel={`${a.enteredCount} of ${a.totalStudents} students — ${a.missingCount > 0 ? `${a.missingCount} missing` : 'Complete'}`}
              />
            ))}
            {assessments.length > 1 && (
              <div className="pt-2 border-t border-gray-100 mt-3">
                <CompletionProgressBar
                  completionRate={completionData?.overallCompletionRate || 0}
                  label="Overall Progress"
                  sublabel={`${assessments.filter((a: any) => a.completionRate >= 100).length} of ${assessments.length} assessments complete`}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {selectedAssessment && (
        <div className="bg-white rounded-lg shadow p-4">
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
                Max Score: <strong>{maxScore}</strong>
              </span>
              {selectedConfig && (
                <span className="text-sm text-indigo-600">
                  Weight: <strong>{selectedConfig.weightPercentage}%</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={bulkSaveMutation.isPending || enteredCount === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkSaveMutation.isPending ? (
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
              onCellEditStop={handleCellEditStop}
              sx={{
                border: 'none',
                '& .MuiDataGrid-cell:focus': { outline: 'none' },
                '& .MuiDataGrid-cell:focus-within': { outline: 'none' },
                '& .score-distinction': { color: '#059669', fontWeight: 600 },
                '& .score-credit': { color: '#2563eb', fontWeight: 600 },
                '& .score-pass': { color: '#d97706', fontWeight: 600 },
                '& .score-fail': { color: '#dc2626', fontWeight: 600 },
                '& .grade-excellent': { color: '#059669', fontWeight: 700 },
                '& .grade-good': { color: '#2563eb', fontWeight: 600 },
                '& .grade-average': { color: '#d97706' },
                '& .grade-poor': { color: '#dc2626' },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#f8fafc',
                  fontWeight: 600,
                },
                '& .MuiDataGrid-row:nth-of-type(odd)': {
                  backgroundColor: '#fafafa',
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
        .assessment-data-grid .MuiDataGrid-cell input[type="number"] {
          text-align: center;
          font-weight: 600;
          font-size: 14px;
        }
        .assessment-data-grid .score-absent {
          color: #f59e0b !important;
          font-weight: 700;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
