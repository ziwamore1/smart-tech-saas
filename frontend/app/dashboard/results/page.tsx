'use client';

import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, resultApi, classApi, termApi, assessmentEngineApi, bulkSaveResults, reportEngineApi } from '@/lib/api';
import { getSubjectShortcut } from '@/config/subjectColors';
import { EXAM_TYPE_OPTIONS, examTypeLabel } from '@/lib/exam-types';

async function downloadTemplateFile(termId: string, classId: string | undefined) {
  const response = await resultApi.getTemplate(termId, { classId: classId || undefined });
  const rawContentType = response.headers?.['content-type'];
  const contentType = typeof rawContentType === 'string' ? rawContentType : Array.isArray(rawContentType) ? rawContentType.join(', ') : '';
  if (
    !contentType.includes('spreadsheetml') &&
    !contentType.includes('octet-stream')
  ) {
    throw new Error('The server returned an invalid response instead of the Excel template. Please try again.');
  }
  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'results-template.xlsx';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  document.body.removeChild(a);
}

type Tab = 'upload' | 'entry' | 'assessments' | 'review' | 'publish' | 'reports';

const SHEET_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
  SUBMITTED: { bg: '#dbeafe', color: '#2563eb', label: 'Submitted' },
  VERIFIED: { bg: '#d1fae5', color: '#059669', label: 'Verified' },
  PUBLISHED: { bg: '#f3e8ff', color: '#7c3aed', label: 'Published' },
  LOCKED: { bg: '#fee2e2', color: '#dc2626', label: 'Locked' },
};

interface UploadResultsTabProps {
  classes: any[];
  terms: any[];
  selectedClass: string;
  selectedTerm: string;
  selectedExamType: string;
  defaultExamType: string;
  onClassChange: (id: string) => void;
  onTermChange: (id: string) => void;
  onExamChange: (id: string) => void;
  onDownloadTemplate: () => void;
  message: { type: 'success' | 'error'; text: string } | null;
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
  onImported: () => void;
}

function UploadResultsTab({
  classes,
  terms,
  selectedClass,
  selectedTerm,
  selectedExamType,
  defaultExamType,
  onClassChange,
  onTermChange,
  onExamChange,
  onDownloadTemplate,
  message,
  onMessage,
  onImported,
}: UploadResultsTabProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      onMessage({ type: 'error', text: 'Please select an Excel file (.xlsx or .xls)' });
      return;
    }
    setSelectedFile(file);
    setPreviewData(null);
    setValidationErrors([]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('termId', selectedTerm);
    if (selectedClass) formData.append('classId', selectedClass);

    api.post('/results-management/sheets/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then((r) => {
        const d = r.data?.data || r.data;
        const rows = d.entries || d.rows || [];
        const errors = d.errors || [];
        setPreviewData(rows);
        setValidationErrors(errors);
        onMessage({
          type: errors.length ? 'error' : 'success',
          text: errors.length
            ? `${errors.length} validation issue(s) found`
            : `File parsed successfully (${rows.length} rows)`,
        });
      })
      .catch((err) => {
        onMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to parse file' });
      });
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('termId', selectedTerm);
      if (selectedClass) formData.append('classId', selectedClass);
      formData.append('examType', selectedExamType || defaultExamType || 'END_TERM');
      const r = await api.post('/results-management/sheets/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(pct);
        },
      });
      return r.data?.data || r.data;
    },
    onSuccess: (data: any) => {
      onMessage({
        type: 'success',
        text: `Import complete: ${data.created || data.entriesCreated || data.resultsInserted || 0} created, ${data.errors || 0} errors, ${data.skipped || 0} skipped`,
      });
      setSelectedFile(null);
      setPreviewData(null);
      setValidationErrors([]);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImported();
    },
    onError: (err: any) => {
      onMessage({ type: 'error', text: err?.response?.data?.message || 'Import failed' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Results from Excel</h2>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Class *</label>
            <select
              value={selectedClass}
              onChange={(e) => onClassChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Class</option>
              {classes.map((cls: any) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Term *</label>
            <select
              value={selectedTerm}
              onChange={(e) => onTermChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Term</option>
              {terms.map((term: any) => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exam Type</label>
            <select
              value={selectedExamType}
              onChange={(e) => onExamChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Default (End of Term)</option>
              {EXAM_TYPE_OPTIONS.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="text-4xl mb-2">📄</div>
            {selectedFile ? (
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-900">Click to select Excel file</p>
                <p className="text-sm text-gray-500">Supports .xlsx and .xls files</p>
              </div>
            )}
          </label>
          {selectedFile && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setPreviewData(null);
                setValidationErrors([]);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="mt-2 text-sm text-red-600 hover:text-red-800"
            >
              Remove file
            </button>
          )}
        </div>

        {validationErrors.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">
              ⚠️ Validation Issues ({validationErrors.length})
            </h4>
            <div className="max-h-40 overflow-y-auto">
              {validationErrors.map((err: any, i: number) => (
                <p key={i} className="text-sm text-yellow-700">
                  Row {err.row || err.rowNumber || i + 1}: {err.message || err.error || 'Unknown error'}
                </p>
              ))}
            </div>
          </div>
        )}

        {previewData && previewData.length > 0 && (
          <div className="mb-4 bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h4 className="font-medium text-sm">👁️ Preview ({previewData.length} rows)</h4>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key} className="text-left py-2 px-3 font-medium text-gray-600 text-xs uppercase whitespace-nowrap">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row: any, i: number) => (
                    <tr key={i} className="border-t">
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="py-2 px-3 text-gray-700">
                          {val ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onDownloadTemplate}
            disabled={!selectedTerm}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            📥 Download Template
          </button>

          {previewData && previewData.length > 0 && (
            <button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || validationErrors.length > 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {importMutation.isPending ? 'Importing...' : '📤 Import Results'}
            </button>
          )}
        </div>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-3">Instructions:</h3>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>Select the class, term and exam type for the results you want to upload</li>
          <li>Click "Download Template" to get the Excel file with student data</li>
          <li>Fill in the scores for each student and subject in the template</li>
          <li>Enter <strong>X</strong> or <strong>A</strong> in a score cell to mark a student absent for that subject</li>
          <li>Save the Excel file and upload it using the drop zone above</li>
          <li>Review the preview data and validation errors before importing</li>
          <li>Click "Import Results" to finalize the upload</li>
          <li>After import, go to "Review Results" tab to verify the entries</li>
          <li>Once all results are complete, go to "Publish Results" to publish</li>
        </ol>
      </div>

      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
        <h3 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>Scores must be between 0 and 100</li>
          <li>Student admission numbers in the Excel must match existing students</li>
          <li>Subject names must match the subjects assigned to the class</li>
          <li>Existing results will be updated if the same student/subject combination exists</li>
          <li>Imported results land in the same result sheet used by Results Entry and Bulk Upload</li>
        </ul>
      </div>
    </div>
  );
}

interface AssessmentTypesTabProps {
  selectedClass: string;
  selectedSubject: string;
  selectedTerm: string;
  isLocked: boolean;
  onRefresh: () => void;
}

function AssessmentTypesTab({ selectedClass, selectedSubject, selectedTerm, isLocked, onRefresh }: AssessmentTypesTabProps) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<{ defId: string; maxScore: number; weight: number }>({ defId: '', maxScore: 100, weight: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: defsData = [] } = useQuery({
    queryKey: ['assessment-defs'],
    queryFn: () => assessmentEngineApi.definitions.list().then((r) => r.data?.data || r.data),
  });
  const assessmentDefs = Array.isArray(defsData) ? defsData : [];

  const { data: configsData = [] } = useQuery({
    queryKey: ['result-sheet-assessment-configs', selectedClass, selectedSubject, selectedTerm],
    queryFn: async () => {
      if (!selectedClass || !selectedSubject || !selectedTerm) return [];
      const r = await assessmentEngineApi.configurations.get(selectedClass, selectedSubject, selectedTerm);
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!selectedClass && !!selectedSubject && !!selectedTerm,
  });
  const configs = Array.isArray(configsData) ? configsData : [];

  const configureMutation = useMutation({
    mutationFn: (payload: any) =>
      assessmentEngineApi.configurations.configure(payload).then((r) => r.data?.data || r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['result-sheet-assessment-configs'] });
      onRefresh();
      setShowAddForm(false);
      setMessage({ type: 'success', text: 'Assessment types updated!' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update assessment types' });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const totalWeight = configs.reduce((sum: number, t: any) => sum + (t.weightPercentage || 0), 0);
  const isComplete = Math.abs(totalWeight - 100) < 0.001;
  const canEdit = !!selectedClass && !!selectedSubject && !!selectedTerm && !isLocked;

  const serialize = (list: any[]) =>
    list.map((c: any) => ({
      assessmentDefId: c.assessmentDefId,
      maxScore: c.maxScore,
      weightPercentage: c.weightPercentage,
      mandatory: c.mandatory ?? true,
      sequenceOrder: c.sequenceOrder ?? 0,
    }));

  const handleAdd = () => {
    if (!newType.defId || newType.maxScore <= 0 || newType.weight <= 0) {
      setMessage({ type: 'error', text: 'Select an assessment type and enter max score and weight' });
      setTimeout(() => setMessage(null), 4000);
      return;
    }
    const next = [
      ...serialize(configs),
      {
        assessmentDefId: newType.defId,
        maxScore: newType.maxScore,
        weightPercentage: newType.weight,
        mandatory: true,
        sequenceOrder: configs.length,
      },
    ];
    configureMutation.mutate({ classId: selectedClass, subjectId: selectedSubject, termId: selectedTerm, configurations: next });
  };

  const handleRemove = (defId: string) => {
    const remaining = serialize(configs.filter((c: any) => c.assessmentDefId !== defId));
    let payload = remaining;
    if (remaining.length === 0) {
      const fallback = assessmentDefs.find((d: any) =>
        d.active !== false && ['END_TERM', 'MID_TERM'].includes(d.examType)
      );
      if (fallback) {
        payload = [{
          assessmentDefId: fallback.id,
          maxScore: fallback.defaultMaxScore || 100,
          weightPercentage: 100,
          mandatory: true,
          sequenceOrder: 0,
        }];
      } else {
        setMessage({ type: 'error', text: 'All assessments were removed but no End of Term / Mid-Term type exists to revert to.' });
        setTimeout(() => setMessage(null), 5000);
        return;
      }
    }
    configureMutation.mutate({ classId: selectedClass, subjectId: selectedSubject, termId: selectedTerm, configurations: payload });
  };

  if (!selectedTerm) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          Select a term to manage assessment types
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {message && (
        <div className={`mx-4 mt-4 px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Assessment Types</h2>
          <p className="text-sm text-gray-500">
            Total Weight: {totalWeight.toFixed(1)}% {isComplete ? '✓ Complete' : '⚠ Must equal 100%'}
          </p>
          {!selectedSubject && (
            <p className="text-xs text-yellow-600 mt-1">Select a subject above to manage its assessment types</p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Assessment Type
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
              <select
                value={newType.defId}
                onChange={(e) => setNewType({ ...newType, defId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select type...</option>
                {assessmentDefs
                  .filter((d: any) => d.active !== false)
                  .map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Score *</label>
              <input
                type="number"
                min="1"
                value={newType.maxScore > 0 ? newType.maxScore : ''}
                placeholder="e.g., 100"
                onChange={(e) => setNewType({ ...newType, maxScore: e.target.value ? Number(e.target.value) : 0 })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight (%) *</label>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                value={newType.weight > 0 ? newType.weight : ''}
                placeholder="e.g., 20"
                onChange={(e) => setNewType({ ...newType, weight: e.target.value ? Number(e.target.value) : 0 })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAdd}
                disabled={!newType.defId || newType.maxScore <= 0 || newType.weight <= 0 || configureMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {configureMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {configs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {!selectedSubject
            ? 'Select a subject to see its assessment types'
            : 'No assessment types defined. Add types that sum to 100%.'}
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Max Score</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Weight</th>
              <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config: any) => {
              const def = config.assessmentDef || assessmentDefs.find((d: any) => d.id === config.assessmentDefId);
              return (
                <tr key={config.assessmentDefId} className="border-t">
                  <td className="py-3 px-4 font-medium">{def?.name || config.assessmentDefId}</td>
                  <td className="py-3 px-4">{config.maxScore}</td>
                  <td className="py-3 px-4">{(config.weightPercentage || 0).toFixed(1)}%</td>
                  <td className="py-3 px-4">
                    {!isLocked && (
                      <button
                        onClick={() => {
                          if (confirm(`Remove "${def?.name || config.assessmentDefId}" from this subject's configuration?`)) {
                            handleRemove(config.assessmentDefId);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="p-4 bg-blue-50 border-t">
        <h3 className="font-medium mb-2">Common Assessment Setup Examples:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Simple (Exam only):</strong> End of Term Exam = 100%</li>
          <li>• <strong>Standard:</strong> CAT = 20%, Mid-Term = 20%, End of Term = 60%</li>
          <li>• <strong>Detailed:</strong> Assignment = 10%, CAT = 15%, Project = 15%, Exam = 60%</li>
          <li>• <strong>With Mock:</strong> Class Work = 20%, Mock Exam = 30%, Final Exam = 50%</li>
        </ul>
        <p className="text-sm text-gray-500 mt-2">
          These configurations drive the weighted scores every result sheet uses.
        </p>
      </div>
    </div>
  );
}

interface ReviewResultsTabProps {
  sheetData: any;
  students: any[];
  subjectColumns: Array<{ id: string; name: string }>;
  summary: { totalStudents: number; totalSubjects: number; resultsEntered: number; expectedResults: number; percentageComplete: number };
  isLoading: boolean;
  isLocked: boolean;
  isVerifying: boolean;
  onVerify: () => void;
  onRefresh: () => void;
  onUnlock: () => void;
}

function ReviewResultsTab({
  sheetData,
  students,
  subjectColumns,
  summary,
  isLoading,
  isLocked,
  isVerifying,
  onVerify,
  onRefresh,
  onUnlock,
}: ReviewResultsTabProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!sheetData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          Select a class and term to review results
        </div>
      </div>
    );
  }

  const isComplete = summary.expectedResults > 0 && summary.resultsEntered >= summary.expectedResults;
  const isPublished = sheetData.status === 'PUBLISHED' || sheetData.status === 'LOCKED';
  const statusStyle = SHEET_STATUS_STYLES[sheetData.status] || SHEET_STATUS_STYLES.DRAFT;

  const incompleteStudents = students
    .map((s: any) => ({
      name: `${s.firstName} ${s.lastName}`,
      admissionNumber: s.admissionNumber,
      missing: subjectColumns
        .filter((subj) => {
          const r = (s.results || []).find((x: any) => x.subjectId === subj.id);
          return !r || r.score == null;
        })
        .map((subj) => subj.name),
    }))
    .filter((s) => s.missing.length > 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              Results Review - {sheetData.class?.name || 'Class'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                {statusStyle.label}
              </span>
              <span className="text-sm text-gray-600">
                {sheetData.title || `${sheetData.class?.name || ''} ${examTypeLabel(sheetData.examType) || sheetData.examType || ''}`}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onVerify}
              disabled={isLocked || isVerifying || isPublished}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              title="Calculate grades and points for all subjects, then verify the sheet"
            >
              {isVerifying ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Calculating...
                </>
              ) : (
                <>
                  📊 Calculate All Grades
                </>
              )}
            </button>
            <button
              onClick={onRefresh}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.totalStudents}</div>
            <div className="text-sm text-gray-600">Total Students</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-600">{summary.totalSubjects}</div>
            <div className="text-sm text-gray-600">Subjects</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-orange-600">{summary.resultsEntered}</div>
            <div className="text-sm text-gray-600">Results Entered</div>
          </div>
          <div className={`rounded-lg p-4 ${isComplete ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <div className={`text-2xl font-bold ${isComplete ? 'text-green-600' : 'text-yellow-600'}`}>
              {summary.percentageComplete}%
            </div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
        </div>

        {isPublished && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Results Published {sheetData.publishedAt ? `on ${new Date(sheetData.publishedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
        )}

        {isLocked && !isPublished && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <p className="text-red-800 font-medium">
              🔒 Results are locked
            </p>
            {onUnlock ? (
              <button
                onClick={onUnlock}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Unlock
              </button>
            ) : null}
          </div>
        )}

        <div className="mb-4">
          <h3 className="font-medium mb-2">Progress Bar</h3>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                isComplete ? 'bg-green-500' : summary.percentageComplete > 50 ? 'bg-blue-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${summary.percentageComplete}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {summary.resultsEntered} of {summary.expectedResults} expected results entered
            {incompleteStudents.length > 0 && ` (${incompleteStudents.length} students missing)`}
          </p>
        </div>

        {summary.expectedResults > 0 && summary.resultsEntered < summary.expectedResults && (
          <div className={`p-4 rounded-lg bg-yellow-50 text-yellow-800`}>
            <p className="font-medium">Results are not yet complete.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Subject Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {subjectColumns.map((subject) => {
            const subjectResults = students.reduce((count: number, student: any) => {
              const r = (student.results || []).find((x: any) => x.subjectId === subject.id);
              return count + (r && r.score != null ? 1 : 0);
            }, 0);
            const expected = summary.totalStudents || 0;
            const isSubjectComplete = subjectResults >= expected;

            return (
              <div
                key={subject.id}
                className={`p-3 rounded-lg border ${isSubjectComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
              >
                <div className="font-medium text-sm">{subject.name}</div>
                <div className="text-xs text-gray-600">
                  {subjectResults}/{expected} entered
                </div>
              </div>
            );
          })}
        </div>
        {subjectColumns.length === 0 && (
          <p className="text-gray-500">No subjects found for this class</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Students Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Student</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Results</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student: any) => {
                const entered = (student.results || []).filter((r: any) => r.score != null).length;
                const sComplete = summary.totalSubjects > 0 && entered >= summary.totalSubjects;
                return (
                  <tr key={student.id} className="border-t">
                    <td className="py-3 px-4">
                      <div className="font-medium">{student.firstName} {student.lastName}</div>
                      <div className="text-sm text-gray-500">{student.admissionNumber}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {entered}/{summary.totalSubjects}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {sComplete ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Complete</span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                          Missing {summary.totalSubjects - entered}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">
                    No students enrolled in this class
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {incompleteStudents.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-red-600">Students with Missing Results</h3>
          <div className="space-y-3">
            {incompleteStudents.map((student, index) => (
              <div key={index} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="font-medium">{student.name} ({student.admissionNumber})</div>
                <div className="text-sm text-red-700">
                  Missing {student.missing.length} subject(s): {student.missing.join(', ') || 'None specified'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLocked && isComplete && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Ready to Verify</h3>
          <p className="text-gray-600 mb-4">
            All results are entered. Click "Calculate All Grades" to compute grades, points and rankings, then use the Publish tab to publish.
          </p>
        </div>
      )}
    </div>
  );
}

interface PublishTabProps {
  classes: any[];
  terms: any[];
  sheetData: any;
  selectedClass: string;
  selectedTerm: string;
  summary: { totalStudents: number; totalSubjects: number; resultsEntered: number; expectedResults: number; percentageComplete: number };
  isPublishing: boolean;
  onPublish: () => void;
  onUnlock: () => void;
}

function PublishTab({ classes, terms, sheetData, selectedClass, selectedTerm, summary, isPublishing, onPublish, onUnlock }: PublishTabProps) {
  const isComplete = summary.expectedResults > 0 && summary.resultsEntered >= summary.expectedResults;
  const statusKey = sheetData?.status || 'DRAFT';
  const statusStyle = SHEET_STATUS_STYLES[statusKey] || SHEET_STATUS_STYLES.DRAFT;
  const isPublished = statusKey === 'PUBLISHED' || statusKey === 'LOCKED';
  const isLocked = statusKey === 'LOCKED';

  const publishSteps = [
    { id: 1, label: 'Submit for review', icon: '✓' },
    { id: 2, label: 'Verify & compute', icon: '📄' },
    { id: 3, label: 'Publish to portal', icon: '🚀' },
  ];

  const stepIndex = statusKey === 'PUBLISHED' || statusKey === 'LOCKED' ? 3 : statusKey === 'VERIFIED' ? 2 : statusKey === 'SUBMITTED' ? 1 : 0;

  return (
    <div className="space-y-6">
      {sheetData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Results Status: {sheetData.class?.name || ''}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{summary.totalStudents}</div>
              <div className="text-sm text-gray-600">Students</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{summary.totalSubjects}</div>
              <div className="text-sm text-gray-600">Subjects</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{summary.resultsEntered}</div>
              <div className="text-sm text-gray-600">Results Entered</div>
            </div>
            <div className={`rounded-lg p-4 ${isComplete ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <div className={`text-2xl font-bold ${isComplete ? 'text-green-600' : 'text-yellow-600'}`}>{summary.percentageComplete}%</div>
              <div className="text-sm text-gray-600">{isComplete ? 'Complete' : 'Incomplete'}</div>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: statusStyle.bg, color: statusStyle.color }}
            >
              {statusStyle.label}
            </span>
            {isPublished && (
              <p className="text-green-800 font-medium text-sm">
                ✓ Results Published {sheetData.publishedAt ? `on ${new Date(sheetData.publishedAt).toLocaleDateString()}` : ''}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            {publishSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    index < stepIndex ? 'bg-green-600 text-white' : index === stepIndex ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.icon}
                </div>
                <span className={`text-sm ${index < stepIndex ? 'text-green-700' : index === stepIndex ? 'text-blue-700' : 'text-gray-500'}`}>
                  {step.label}
                </span>
                {index < publishSteps.length - 1 && (
                  <div className={`w-6 h-0.5 ${index < stepIndex ? 'bg-green-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {!isComplete && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-red-800 font-medium">
                ⚠ Results not complete. Missing results will be skipped during publishing.
              </p>
            </div>
          )}

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                isComplete ? 'bg-green-500' : summary.percentageComplete > 50 ? 'bg-blue-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${summary.percentageComplete}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {summary.resultsEntered} of {summary.expectedResults} expected results
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Publish Result Sheet</h2>

        {!selectedClass || !selectedTerm || !sheetData ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            Please select a class and term from the filters above to publish results.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selected Term</label>
                <div className="px-3 py-2 border rounded-lg bg-gray-50">
                  {terms.find((t: any) => t.id === selectedTerm)?.name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Selected Class</label>
                <div className="px-3 py-2 border rounded-lg bg-gray-50">
                  {classes.find((c: any) => c.id === selectedClass)?.name || 'N/A'}
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={onPublish}
                  disabled={!selectedClass || !selectedTerm || isLocked || isPublishing}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  title={!isComplete ? 'Enter all results before publishing' : ''}
                >
                  {isPublishing ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Publishing...
                    </>
                  ) : (
                    <>
                      🚀 Publish Results
                    </>
                  )}
                </button>
              </div>
            </div>

            {isPublished && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                <p className="text-green-800 font-medium">
                  ✓ This result sheet is already published.
                </p>
              </div>
            )}

            {isLocked && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-800">
                  Results are locked.
                </p>
                <button
                  onClick={onUnlock}
                  className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Unlock
                </button>
              </div>
            )}

            {!isComplete && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                <p className="text-yellow-800">
                  Results must be entered before publishing. Missing subjects will be skipped.
                </p>
              </div>
            )}

            {!isPublished && !isLocked && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  Publishing runs the full workflow: {statusKey === 'DRAFT' ? 'submit → ' : ''}{statusKey !== 'VERIFIED' ? 'verify → ' : ''}publish.
                </p>
              </div>
            )}
          </>
        )}

        <div className="mt-6">
          <h3 className="font-medium mb-2">Publishing Guidelines:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>1. Ensure all student results are entered for the class</li>
            <li>2. Verify assessment types sum to 100% for each subject</li>
            <li>3. Calculate all grades before publishing</li>
            <li>4. Once published, results are visible to students and parents</li>
            <li>5. Lock the sheet when the results are final to stop further edits</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface ReportsTabProps {
  selectedClass: string;
  selectedTerm: string;
  sheetData: any;
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

function ReportsTab({ selectedClass, selectedTerm, sheetData, onMessage }: ReportsTabProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const isPublished = sheetData?.status === 'PUBLISHED' || sheetData?.status === 'LOCKED';

  const downloadBlob = (res: any, filename: string) => {
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadClassReports = async () => {
    if (!selectedClass || !selectedTerm) return;
    setLoading('class');
    try {
      const response = await reportEngineApi.generatePdf({
        type: 'CLASS_REPORT',
        classId: selectedClass,
        termId: selectedTerm,
        examType: sheetData?.examType,
      });
      downloadBlob(response, `class-reports-${selectedTerm}.pdf`);
      onMessage({ type: 'success', text: 'Class reports downloaded successfully' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.response?.data?.message || 'Failed to download class reports' });
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadMarkSchedule = async () => {
    if (!selectedClass || !selectedTerm || !sheetData?.id) return;
    setLoading('mark-schedule');
    try {
      const response = await api.get(`/results-management/sheets/${sheetData.id}/mark-schedule/pdf`, {
        responseType: 'blob',
        timeout: 120000,
      });
      downloadBlob(response, `mark-schedule-${selectedTerm}.pdf`);
      onMessage({ type: 'success', text: 'Mark schedule downloaded successfully' });
    } catch (error: any) {
      onMessage({ type: 'error', text: error.response?.data?.message || 'Failed to download mark schedule' });
    } finally {
      setLoading(null);
    }
  };

  const handleViewAnalytics = () => {
    window.location.href = `/dashboard/result-analytics?classId=${selectedClass}&termId=${selectedTerm}`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Generate Reports</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Report Cards</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download report cards PDF for all students in the selected class.
          </p>
          <button
            onClick={handleDownloadClassReports}
            disabled={!selectedClass || !selectedTerm || !isPublished || loading === 'class'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === 'class' ? 'Generating...' : 'Download Class Reports PDF'}
          </button>
          {!isPublished && selectedClass && selectedTerm && (
            <p className="text-xs text-red-500 mt-2">Publish results first to generate reports</p>
          )}
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Mark Schedule</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download the professional mark schedule PDF for the selected class and term.
          </p>
          <button
            onClick={handleDownloadMarkSchedule}
            disabled={!selectedClass || !selectedTerm || !sheetData?.id || loading === 'mark-schedule'}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading === 'mark-schedule' ? 'Generating...' : 'Download Mark Schedule PDF'}
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Class Summary</h3>
          <p className="text-sm text-gray-600 mb-4">
            Generate a summary report showing class performance across subjects.
          </p>
          <button
            onClick={handleViewAnalytics}
            disabled={!selectedClass || !selectedTerm}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            View Class Summary
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Analytics Dashboard</h3>
          <p className="text-sm text-gray-600 mb-4">
            View detailed analytics and performance charts.
          </p>
          <button
            onClick={handleViewAnalytics}
            disabled={!selectedClass || !selectedTerm}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            View Analytics
          </button>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-2">Professional Report Hub</h3>
          <p className="text-sm text-gray-600 mb-4">
            Generate branded report cards, transcripts, certificates, and class reports using the current templates.
          </p>
          <button
            onClick={() => { window.location.href = '/dashboard/report-hub'; }}
            className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Open Report Hub
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('entry');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    subjectId: string;
    resultId?: string | null;
    score?: number | null;
  } | null>(null);

  const showMessage = (msg: { type: 'success' | 'error'; text: string }) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 6000);
  };

  const { data: classesData = [], isLoading: classesLoading, error: classesError } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      if (data?.result) data = data.result;
      if (!Array.isArray(data)) data = [];
      return data;
    },
  });

  const classes = Array.isArray(classesData) ? classesData : [];

  const { data: termsData = [], isLoading: termsLoading, error: termsError } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.terms) data = data.terms;
      if (data?.result) data = data.result;
      if (!Array.isArray(data)) data = [];
      return data;
    },
  });

  const terms = Array.isArray(termsData) ? termsData : [];

  // The result sheet is the single source of truth shared with Results Entry,
  // Results Management, Bulk Upload and View Results. The backend auto-creates
  // a DRAFT sheet for the class + term on first request.
  const { data: sheetData, isLoading: sheetLoading, refetch: refetchSheet } = useQuery({
    queryKey: ['result-sheet', selectedClass, selectedTerm, selectedExamType],
    queryFn: async () => {
      if (!selectedClass || !selectedTerm) return null;
      const params: any = { classId: selectedClass, termId: selectedTerm };
      if (selectedExamType) params.examType = selectedExamType;
      const res = await api.get('/results-management/sheets', { params });
      const sheets = res.data?.data || res.data;
      const arr = Array.isArray(sheets) ? sheets : [];
      return arr.length > 0 ? arr[0] : null;
    },
    enabled: !!selectedClass && !!selectedTerm,
  });

  // Subjects are scoped to the selected class via the sheet, not the whole school.
  const { data: subjectsData = [], isLoading: subjectsLoading, refetch: refetchSubjects } = useQuery({
    queryKey: ['result-sheet-subjects', sheetData?.id],
    queryFn: async () => {
      if (!sheetData?.id) return [];
      const res = await api.get(`/results-management/sheets/${sheetData.id}/subjects`);
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!sheetData?.id,
  });

  const sheetSubjects = Array.isArray(subjectsData) ? subjectsData : [];

  const { data: studentsData = [], isLoading: studentsLoading, refetch: refetchStudents } = useQuery({
    queryKey: ['result-sheet-students', sheetData?.id],
    queryFn: async () => {
      if (!sheetData?.id) return [];
      const res = await api.get(`/results-management/sheets/${sheetData.id}/students`);
      let data = res.data?.data || res.data;
      if (data && !Array.isArray(data) && data.students) data = data.students;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!sheetData?.id,
  });

  const students = Array.isArray(studentsData) ? studentsData : [];
  const isLocked = sheetData?.status === 'LOCKED';
  const canEdit = !!sheetData && !isLocked;

  const subjectColumns = useMemo(() => {
    const cols = sheetSubjects.map((s: any) => ({ id: s.id, name: s.name || s.subject?.name || s.subjectName || 'Subject' }));
    return selectedSubject ? cols.filter((c) => c.id === selectedSubject) : cols;
  }, [sheetSubjects, selectedSubject]);

  const studentRows = useMemo(() => {
    const byStudent = new Map<string, { student: any; cells: Map<string, any> }>();
    for (const s of students) {
      const cells = new Map<string, any>();
      (s.results || []).forEach((r: any) => {
        if (r.subjectId) cells.set(r.subjectId, r);
      });
      byStudent.set(s.id, { student: s, cells });
    }
    return [...byStudent.values()];
  }, [students]);

  const summary = useMemo(() => {
    const totalStudents = studentRows.length;
    const totalSubjects = subjectColumns.length;
    const resultsEntered = studentRows.reduce(
      (sum, row) => sum + [...row.cells.values()].filter((r: any) => r.score != null).length,
      0,
    );
    const expectedResults = totalStudents * totalSubjects;
    const percentageComplete = expectedResults > 0 ? Math.round((resultsEntered / expectedResults) * 100) : 0;
    return { totalStudents, totalSubjects, resultsEntered, expectedResults, percentageComplete };
  }, [studentRows, subjectColumns]);

  const filtersLoading = sheetLoading || subjectsLoading;

  const bulkSaveMutation = useMutation({
    mutationFn: (scores: Array<{ studentId: string; subjectId: string; termId: string; score: number; isAbsent?: boolean; absentCode?: 'X' | 'A' }>) =>
      bulkSaveResults(scores, { chunkSize: 50, maxRetries: 3, timeout: 120000 }),
    onSuccess: async () => {
      if (sheetData?.id) {
        try {
          await api.post(`/results-management/sheets/${sheetData.id}/submit`);
        } catch {
          // Backend auto-submits; ignore duplicate submit errors.
        }
      }
      await refetchStudents();
      await refetchSheet();
      setEditingCell(null);
      showMessage({ type: 'success', text: 'Result saved successfully!' });
    },
    onError: (error: any) => {
      showMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save result' });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!sheetData?.id) return;
      let status = sheetData.status;
      if (status === 'DRAFT') {
        await api.post(`/results-management/sheets/${sheetData.id}/submit`);
        status = 'SUBMITTED';
      }
      if (status === 'SUBMITTED') {
        await api.post(`/results-management/sheets/${sheetData.id}/verify`);
      }
    },
    onSuccess: async () => {
      await refetchSheet();
      await refetchStudents();
      showMessage({ type: 'success', text: 'Grades and points calculated and sheet verified!' });
    },
    onError: (error: any) => {
      showMessage({ type: 'error', text: error.response?.data?.message || 'Failed to calculate and verify' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!sheetData?.id) return;
      let status = sheetData.status;
      if (status === 'DRAFT') {
        await api.post(`/results-management/sheets/${sheetData.id}/submit`);
        status = 'SUBMITTED';
      }
      if (status === 'SUBMITTED') {
        await api.post(`/results-management/sheets/${sheetData.id}/verify`);
        status = 'VERIFIED';
      }
      if (status === 'VERIFIED') {
        await api.post(`/results-management/sheets/${sheetData.id}/publish`);
        status = 'PUBLISHED';
      }
      return { status };
    },
    onSuccess: async () => {
      await refetchSheet();
      await refetchStudents();
      showMessage({ type: 'success', text: 'Results published successfully!' });
    },
    onError: (error: any) => {
      showMessage({ type: 'error', text: error.response?.data?.message || 'Failed to publish results' });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!sheetData?.id) return;
      await api.post(`/results-management/sheets/${sheetData.id}/unlock`);
    },
    onSuccess: async () => {
      await refetchSheet();
      showMessage({ type: 'success', text: 'Results unlocked' });
    },
    onError: (error: any) => {
      showMessage({ type: 'error', text: error.response?.data?.message || 'Failed to unlock results' });
    },
  });

  const handleImported = async () => {
    await refetchSheet();
    await refetchSubjects();
    await refetchStudents();
    queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
  };

  const saveCellScore = () => {
    if (!editingCell || !selectedTerm) return;
    const score = editingCell.score as number | undefined;
    if (score === null || score === undefined || isNaN(score)) return;
    if (score < 0 || score > 100) {
      showMessage({ type: 'error', text: 'Score must be between 0 and 100' });
      return;
    }
    bulkSaveMutation.mutate([
      {
        studentId: editingCell.studentId,
        subjectId: editingCell.subjectId,
        termId: selectedTerm,
        score,
        isAbsent: false,
      },
    ]);
  };

  const tabs = [
    { key: 'upload' as Tab, label: 'Upload Results', icon: '📤' },
    { key: 'entry' as Tab, label: 'View Results', icon: '📝' },
    { key: 'review' as Tab, label: 'Review Results', icon: '👁️' },
    { key: 'assessments' as Tab, label: 'Assessment Types', icon: '📋' },
    { key: 'publish' as Tab, label: 'Publish Results', icon: '🚀' },
    { key: 'reports' as Tab, label: 'Reports', icon: '📊' },
  ];

  const statusStyle = sheetData ? (SHEET_STATUS_STYLES[sheetData.status] || SHEET_STATUS_STYLES.DRAFT) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Results Management</h1>
          <p className="text-gray-600 mt-1">Manage student results, assessments, and publishing</p>
        </div>
        {isLocked && (
          <div className="flex items-center gap-2">
            <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
              🔒 Results Locked
            </span>
            <button
              onClick={() => {
                if (confirm('Unlock results for editing?')) {
                  unlockMutation.mutate();
                }
              }}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Unlock
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
            {classesLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500">Loading...</div>
            ) : classesError ? (
              <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-600 text-sm">
                Error loading classes
              </div>
            ) : (
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
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term *</label>
            {termsLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500">Loading...</div>
            ) : termsError ? (
              <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-600 text-sm">
                Error loading terms
              </div>
            ) : (
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select Term</option>
                {terms.map((term: any) => (
                  <option key={term.id} value={term.id}>{term.name} {term.isCurrent ? '(Current)' : ''}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exam Type</label>
            <select
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Types</option>
              {EXAM_TYPE_OPTIONS.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            {filtersLoading ? (
              <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500">Loading...</div>
            ) : (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Subjects</option>
                {sheetSubjects.map((subject: any) => (
                  <option key={subject.id} value={subject.id}>{subject.name || subject.subject?.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'upload' && (
        <UploadResultsTab
          classes={classes}
          terms={terms}
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          selectedExamType={selectedExamType}
          defaultExamType={sheetData?.examType || ''}
          onClassChange={setSelectedClass}
          onTermChange={setSelectedTerm}
          onExamChange={setSelectedExamType}
          onDownloadTemplate={async () => {
            if (!selectedTerm) return;
            try {
              await downloadTemplateFile(selectedTerm, selectedClass);
            } catch (error: any) {
              showMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to download template' });
            }
          }}
          message={message}
          onMessage={showMessage}
          onImported={handleImported}
        />
      )}

      {activeTab === 'entry' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-semibold">Student Results</h2>
              {sheetData && statusStyle && (
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: statusStyle.bg, color: statusStyle.color }}
                  >
                    {statusStyle.label}
                  </span>
                  <span className="text-sm text-gray-600">
                    {sheetData.class?.name || ''} · {examTypeLabel(sheetData.examType) || sheetData.examType || 'Default'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!selectedClass || !selectedTerm) return;
                  if (confirm('This will calculate grades and points for all results in this class and verify the sheet. Continue?')) {
                    verifyMutation.mutate();
                  }
                }}
                disabled={!selectedClass || !selectedTerm || isLocked || verifyMutation.isPending || !sheetData?.id}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                title="Calculate grades and points for all results"
              >
                {verifyMutation.isPending ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Calculating...
                  </>
                ) : (
                  <>
                    📊 Calculate All Grades
                  </>
                )}
              </button>
              <button
                onClick={async () => {
                  if (!selectedTerm) return;
                  try {
                    await downloadTemplateFile(selectedTerm, selectedClass);
                  } catch (error: any) {
                    showMessage({ type: 'error', text: error.response?.data?.message || error.message || 'Failed to download template' });
                  }
                }}
                disabled={!selectedTerm}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Download Template
              </button>
            </div>
          </div>

          {sheetLoading || studentsLoading ? (
            <div className="text-center py-12">Loading results...</div>
          ) : !selectedClass || !selectedTerm ? (
            <div className="text-center py-12 text-gray-500">Select a class and term to view results</div>
          ) : !sheetData ? (
            <div className="text-center py-12 text-gray-500">
              No result sheet found for this selection. Try the Upload Results tab or select an exam type.
            </div>
          ) : studentRows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No students found. {isLocked ? 'Results are locked.' : 'You can upload results from Excel above.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[190px]">
                      Student
                    </th>
                    {subjectColumns.map((subject) => (
                      <th key={subject.id} title={subject.name} className="text-center py-3 px-2 font-medium text-gray-700 min-w-[92px]">
                        {getSubjectShortcut(subject.name)}
                      </th>
                    ))}
                    <th className="text-center py-3 px-3 font-medium text-gray-700">Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((row) => {
                    const totalPoints = [...row.cells.values()].reduce((sum: number, r: any) => {
                      const sc = r.score ?? r.finalPercentage ?? null;
                      if (r.points != null) return sum + r.points;
                      if (sc == null) return sum;
                      if (sc >= 75) return sum + 1;
                      if (sc >= 65) return sum + 2;
                      if (sc >= 50) return sum + 3;
                      if (sc >= 40) return sum + 4;
                      return sum + 5;
                    }, 0);
                    return (
                      <tr key={row.student?.id} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-4 font-medium sticky left-0 bg-white z-10">
                          {row.student?.firstName} {row.student?.lastName}
                        </td>
                        {subjectColumns.map((subject) => {
                          const result = row.cells.get(subject.id);
                          const isEditingThis =
                            editingCell &&
                            editingCell.studentId === row.student?.id &&
                            editingCell.subjectId === subject.id;

                          if (!result) {
                            return (
                              <td key={subject.id} className="text-center py-2 px-2">
                                {canEdit ? (
                                  <button
                                    onClick={() =>
                                      setEditingCell({
                                        studentId: row.student?.id,
                                        subjectId: subject.id,
                                        resultId: null,
                                        score: null,
                                      })
                                    }
                                    className="text-gray-400 hover:text-blue-600 text-xs"
                                    title={`Add score for ${subject.name}`}
                                  >
                                    +
                                  </button>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            );
                          }

                          const isAbsent = result.isAbsent || (result.score == null && result.finalPercentage == null);
                          const score = result.score ?? result.finalPercentage ?? null;
                          const grade = result.grade ?? result.finalGrade ?? null;

                          if (isEditingThis) {
                            return (
                              <td key={subject.id} className="text-center py-2 px-2">
                                <div className="flex justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    autoFocus
                                    value={editingCell?.score ?? score ?? ''}
                                    onChange={(e) =>
                                      editingCell && setEditingCell({ ...editingCell, score: Number(e.target.value) })
                                    }
                                    className="w-16 px-1 py-0.5 border rounded text-center"
                                  />
                                  <button
                                    onClick={saveCellScore}
                                    className="px-1.5 py-0.5 bg-green-600 text-white rounded text-xs"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingCell(null)}
                                    className="px-1.5 py-0.5 border rounded text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td key={subject.id} className="text-center py-2 px-2">
                              <div className="flex flex-col items-center group">
                                {isAbsent ? (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                    ABSENT
                                  </span>
                                ) : (
                                  <span className={`font-mono font-semibold ${score >= 75 ? 'text-green-700' : score >= 60 ? 'text-blue-700' : score >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>
                                    {score != null ? Number(score).toFixed(1) : '-'}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {isAbsent ? '' : grade ? `Grade ${grade}` : ''}
                                </span>
                                {canEdit && (
                                  <span className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() =>
                                        setEditingCell({
                                          studentId: row.student?.id,
                                          subjectId: subject.id,
                                          resultId: result.id,
                                          score,
                                        })
                                      }
                                      className="text-blue-600 text-[10px] hover:underline"
                                    >
                                      edit
                                    </button>
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-center py-2 px-3 font-semibold">{totalPoints}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'review' && (
        <ReviewResultsTab
          sheetData={sheetData}
          students={students}
          subjectColumns={subjectColumns}
          summary={summary}
          isLoading={sheetLoading || studentsLoading}
          isLocked={isLocked}
          isVerifying={verifyMutation.isPending}
          onVerify={() => verifyMutation.mutate()}
          onRefresh={async () => {
            await refetchSheet();
            await refetchStudents();
            await refetchSubjects();
          }}
          onUnlock={() => unlockMutation.mutate()}
        />
      )}

      {activeTab === 'assessments' && (
        <AssessmentTypesTab
          selectedClass={selectedClass}
          selectedSubject={selectedSubject}
          selectedTerm={selectedTerm}
          isLocked={isLocked}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['result-sheet-subjects'] });
          }}
        />
      )}

      {activeTab === 'publish' && (
        <PublishTab
          classes={classes}
          terms={terms}
          sheetData={sheetData}
          summary={summary}
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          isPublishing={publishMutation.isPending}
          onPublish={() => publishMutation.mutate()}
          onUnlock={() => unlockMutation.mutate()}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsTab
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          sheetData={sheetData}
          onMessage={showMessage}
        />
      )}
    </div>
  );
}