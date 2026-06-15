'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

export default function BulkUploadPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExamType, setSelectedExamType] = useState('Exam');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

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

  const examTypes = ['Exam', 'Mid-Term', 'CAT', 'Assignment', 'Project', 'Practical', 'Mock'];

  const downloadTemplate = useCallback(async () => {
    if (!selectedTerm) {
      toast.error('Please select a term first');
      return;
    }
    try {
      const token = localStorage.getItem('auth_token');
      let url = `/api/v1/results/template/${selectedTerm}`;
      if (selectedClass) url += `?classId=${selectedClass}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to download template');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'results-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success('Template downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download template');
    }
  }, [selectedTerm, selectedClass]);

  const parseFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('termId', selectedTerm);
    if (selectedClass) formData.append('classId', selectedClass);
    try {
      const r = await api.post('/results-management/sheets/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = r.data?.data || r.data;
      setPreviewData(d.entries || d.rows || []);
      setValidationErrors(d.errors || []);
      if (d.errors?.length > 0) {
        toast.warning(`${d.errors.length} validation issue(s) found`);
      } else {
        toast.success('File parsed successfully');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to parse file');
    }
  }, [selectedTerm, selectedClass]);

  const handleFileChange = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    setSelectedFile(file);
    setPreviewData(null);
    setValidationErrors([]);
    parseFile(file);
  }, [parseFile]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('termId', selectedTerm);
      if (selectedClass) formData.append('classId', selectedClass);
      if (selectedExamType) formData.append('examType', selectedExamType);
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
      queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
      toast.success(`Import complete: ${data.created || data.entriesCreated || 0} created, ${data.errors || 0} errors, ${data.skipped || 0} skipped`);
      setSelectedFile(null);
      setPreviewData(null);
      setValidationErrors([]);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Import failed');
    },
  });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Bulk Upload</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
          Import student results from Excel spreadsheets
        </p>
      </div>

      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '24px', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', marginBottom: '24px' }}>
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
              <option value="">All Classes</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term *</label>
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
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Exam Type</label>
            <select
              value={selectedExamType}
              onChange={e => setSelectedExamType(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', fontSize: '14px',
                border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
              }}
            >
              {examTypes.map(et => (
                <option key={et} value={et}>{et}</option>
              ))}
            </select>
          </div>
          <div>
            <button
              onClick={downloadTemplate}
              disabled={!selectedTerm}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px', fontSize: '14px', fontWeight: 600,
                color: '#3b82f6', background: '#eff6ff', border: '1px solid #93c5fd',
                borderRadius: '8px', cursor: !selectedTerm ? 'not-allowed' : 'pointer', opacity: !selectedTerm ? 0.5 : 1
              }}
            >
              <i className="fa fa-download"></i>
              Download Template
            </button>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFileChange(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragOver ? '#ea6645' : '#e8ddd0'}`,
            borderRadius: '12px', padding: '48px', textAlign: 'center',
            background: dragOver ? '#fff5f3' : '#fefcf9',
            transition: 'all 0.2s', cursor: 'pointer', marginBottom: '20px'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => handleFileChange(e.target.files?.[0] || null)}
          />
          <i className="fa fa-file-excel" style={{ fontSize: '48px', color: dragOver ? '#ea6645' : '#9ca3af', marginBottom: '16px' }}></i>
          {selectedFile ? (
            <div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>{selectedFile.name}</p>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>{(selectedFile.size / 1024).toFixed(1)} KB</p>
              <button
                onClick={e => { e.stopPropagation(); setSelectedFile(null); setPreviewData(null); setValidationErrors([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                style={{ marginTop: '8px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}
              >
                <i className="fa fa-times" style={{ marginRight: '4px' }}></i>Remove
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Drag & drop your Excel file here, or click to browse
              </p>
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>Supports .xlsx and .xls files</p>
            </div>
          )}
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div style={{
            background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px',
            padding: '16px', marginBottom: '20px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', margin: '0 0 8px' }}>
              <i className="fa fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
              Validation Issues ({validationErrors.length})
            </h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {validationErrors.map((err: any, i: number) => (
                <p key={i} style={{ fontSize: '13px', color: '#b45309', margin: '4px 0' }}>
                  Row {err.row || err.rowNumber || i + 1}: {err.message || err.error || 'Unknown error'}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Preview table */}
        {previewData && previewData.length > 0 && (
          <div style={{
            background: '#fefcf9', border: '1px solid #e8ddd0', borderRadius: '10px',
            overflow: 'hidden', marginBottom: '20px'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ddd0', background: '#f5efe8' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>
                <i className="fa fa-eye" style={{ marginRight: '8px' }}></i>
                Preview ({previewData.length} rows)
              </h4>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#faf7f4', position: 'sticky', top: 0 }}>
                    {Object.keys(previewData[0]).map(key => (
                      <th key={key} style={{
                        textAlign: 'left', padding: '10px 14px', fontWeight: 600,
                        color: '#6b7280', fontSize: '12px', textTransform: 'uppercase',
                        borderBottom: '1px solid #e8ddd0', whiteSpace: 'nowrap'
                      }}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e8ddd0' }}>
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} style={{ padding: '8px 14px', color: '#374151' }}>
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

        {/* Import button */}
        {previewData && previewData.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e8ddd0', borderRadius: '4px' }}>
                  <div style={{
                    width: `${uploadProgress}%`, height: '100%',
                    background: '#ea6645', borderRadius: '4px',
                    transition: 'width 0.3s'
                  }}></div>
                </div>
              </div>
            )}
            <button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || validationErrors.length > 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 32px', fontSize: '14px', fontWeight: 600, color: 'white',
                background: importMutation.isPending || validationErrors.length > 0 ? '#d1d5db' : '#059669',
                border: 'none', borderRadius: '8px', cursor: importMutation.isPending || validationErrors.length > 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {importMutation.isPending ? (
                <><i className="fa fa-spinner fa-spin"></i> Importing...</>
              ) : (
                <><i className="fa fa-upload"></i> Import Results</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '24px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
          <i className="fa fa-info-circle" style={{ color: '#ea6645', marginRight: '8px' }}></i>
          Instructions
        </h3>
        <ol style={{ margin: 0, paddingLeft: '20px', color: '#6b7280', fontSize: '14px', lineHeight: '2' }}>
          <li>Select the class, term, and exam type for the results you want to upload</li>
          <li>Click <strong>"Download Template"</strong> to get the Excel file with student data pre-filled</li>
          <li>Fill in the scores for each student and subject (values between 0 and 100)</li>
          <li>Save the file and upload it using the drop zone above</li>
          <li>Review the preview data and validation errors before importing</li>
          <li>Click <strong>"Import Results"</strong> to finalize the upload</li>
        </ol>
      </div>
    </div>
  );
}
