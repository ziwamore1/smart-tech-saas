'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: '#f3f4f6', color: '#6b7280' },
  SUBMITTED: { bg: '#dbeafe', color: '#2563eb' },
  VERIFIED: { bg: '#d1fae5', color: '#059669' },
  PUBLISHED: { bg: '#f3e8ff', color: '#7c3aed' },
  LOCKED: { bg: '#fee2e2', color: '#dc2626' },
};

export default function ResultsManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filterClass, setFilterClass] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [filterExamType, setFilterExamType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ classId: '', termId: '', examType: 'Exam', academicYearId: '', title: '' });
  const [actionMenu, setActionMenu] = useState<string | null>(null);

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

  const { data: currentTermData } = useQuery({
    queryKey: ['current-term'],
    queryFn: async () => {
      const r = await termApi.getCurrent();
      return r.data?.data || r.data;
    },
  });

  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const r = await api.get('/academic-year');
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const academicYears = useMemo(() => Array.isArray(academicYearsData) ? academicYearsData : [], [academicYearsData]);

  const { data: sheetsData, isLoading: sheetsLoading } = useQuery({
    queryKey: ['result-sheets', filterClass, filterTerm, filterExamType, filterStatus, searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterClass) params.classId = filterClass;
      if (filterTerm) params.termId = filterTerm;
      if (filterExamType) params.examType = filterExamType;
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;
      const r = await api.get('/results-management/sheets', { params });
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const sheets = useMemo(() => Array.isArray(sheetsData) ? sheetsData : [], [sheetsData]);

  const createSheetMutation = useMutation({
    mutationFn: (data: any) => api.post('/results-management/sheets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
      queryClient.refetchQueries({ queryKey: ['result-sheets'] });
      setShowCreateModal(false);
      setCreateForm({ classId: '', termId: '', examType: 'Exam', academicYearId: '', title: '' });
      toast.success('Result sheet created successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create sheet');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/results-management/sheets/${id}/${action}`),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
      setActionMenu(null);
      toast.success(r.data?.message || 'Status updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const currentAcYear = useMemo(() => {
    if (createForm.academicYearId) return academicYears.find((y: any) => y.id === createForm.academicYearId);
    return academicYears.find((y: any) => y.isCurrent);
  }, [createForm.academicYearId, academicYears]);

  const filteredTerms = useMemo(() => {
    if (!currentAcYear) return terms;
    return terms.filter((t: any) => t.academicYearId === currentAcYear.id);
  }, [currentAcYear, terms]);

  const examTypes = ['Exam', 'Mid-Term', 'CAT', 'Assignment', 'Project', 'Practical', 'Mock'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Result Sheets</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            Manage all result sheets, create new entries, and track status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href="/dashboard/results-management/view-results"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', background: '#5f4b3a', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', textDecoration: 'none'
            }}
          >
            <i className="fa fa-eye"></i>
            View Results
          </a>
          <button
            onClick={() => {
              const currentYear = academicYears?.find((y: any) => y.isCurrent);
              setCreateForm(prev => ({ ...prev, academicYearId: currentYear?.id || '' }));
              setShowCreateModal(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', background: '#ea6645', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#d55a3d'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ea6645'; }}
          >
            <i className="fa fa-plus"></i>
            Create Sheet
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Class</label>
          <select
            value={filterClass}
            onChange={e => setFilterClass(e.target.value)}
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
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term</label>
          <select
            value={filterTerm}
            onChange={e => setFilterTerm(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">All Terms</option>
            {terms.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Exam Type</label>
          <select
            value={filterExamType}
            onChange={e => setFilterExamType(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">All Types</option>
            {examTypes.map(et => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_STYLES).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Search</label>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title or class..."
            style={{
              width: '100%', padding: '10px 14px', fontSize: '14px',
              border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
            }}
          />
        </div>
      </div>

      {/* Sheets Table */}
      {sheetsLoading ? (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', padding: '40px' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              display: 'flex', gap: '16px', padding: '16px 0',
              borderBottom: i < 5 ? '1px solid #e8ddd0' : 'none',
              animation: 'pulse 1.5s infinite'
            }}>
              <div style={{ flex: 2, height: '16px', background: '#e8ddd0', borderRadius: '4px' }}></div>
              <div style={{ flex: 1, height: '16px', background: '#e8ddd0', borderRadius: '4px' }}></div>
              <div style={{ flex: 1, height: '16px', background: '#e8ddd0', borderRadius: '4px' }}></div>
              <div style={{ flex: 1, height: '16px', background: '#e8ddd0', borderRadius: '4px' }}></div>
              <div style={{ flex: 1, height: '16px', background: '#e8ddd0', borderRadius: '4px' }}></div>
            </div>
          ))}
        </div>
      ) : sheets.length === 0 ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px 40px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', color: '#e8ddd0', marginBottom: '16px' }}>
            <i className="fa fa-file-alt"></i>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Result Sheets Yet</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>
            Create your first result sheet to start managing student results
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '12px 24px', background: '#ea6645', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            <i className="fa fa-plus" style={{ marginRight: '8px' }}></i>
            Create Result Sheet
          </button>
        </div>
      ) : (
        <div style={{ background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5efe8', borderBottom: '2px solid #e8ddd0' }}>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Title</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Class</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Term</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Exam Type</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Students</th>
                  <th style={{ textAlign: 'center', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Entered</th>
                  <th style={{ textAlign: 'right', padding: '14px 20px', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet: any) => {
                  const statusStyle = STATUS_STYLES[sheet.status] || STATUS_STYLES.DRAFT;
                  return (
                    <tr key={sheet.id} style={{ borderBottom: '1px solid #e8ddd0', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#faf7f4'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: '#1f2937' }}>{sheet.title || `${sheet.class?.name || ''} ${sheet.examType || ''}`}</td>
                      <td style={{ padding: '14px 20px', color: '#374151' }}>{sheet.class?.name || '-'}</td>
                      <td style={{ padding: '14px 20px', color: '#374151' }}>{sheet.term?.name || '-'}</td>
                      <td style={{ padding: '14px 20px', color: '#374151' }}>{sheet.examType || '-'}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 12px',
                          borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                          background: statusStyle.bg, color: statusStyle.color
                        }}>
                          {sheet.status || 'DRAFT'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', color: '#374151' }}>{sheet.studentCount || 0}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', color: '#374151' }}>{sheet.entriesCount || 0}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', position: 'relative' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <a
                            href={`/dashboard/results-management/view-results?classId=${sheet.classId}&termId=${sheet.termId}`}
                            style={{
                              padding: '6px 12px', fontSize: '12px', color: '#059669',
                              background: '#d1fae5', border: 'none', borderRadius: '6px',
                              textDecoration: 'none', fontWeight: 500
                            }}
                          >
                            <i className="fa fa-eye" style={{ marginRight: '4px' }}></i>View
                          </a>
                          <a
                            href={`/dashboard/results-management/result-entry?sheetId=${sheet.id}`}
                            style={{
                              padding: '6px 12px', fontSize: '12px', color: '#3b82f6',
                              background: '#eff6ff', border: 'none', borderRadius: '6px',
                              textDecoration: 'none', fontWeight: 500
                            }}
                          >
                            <i className="fa fa-edit" style={{ marginRight: '4px' }}></i>Enter
                          </a>
                          <button
                            onClick={() => setActionMenu(actionMenu === sheet.id ? null : sheet.id)}
                            style={{
                              padding: '6px 12px', fontSize: '12px', color: '#374151',
                              background: '#f5efe8', border: 'none', borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            <i className="fa fa-ellipsis-v"></i>
                          </button>
                          {actionMenu === sheet.id && (
                            <div style={{
                              position: 'absolute', top: '100%', right: '0', zIndex: 50,
                              background: '#fdfaf7', border: '1px solid #e8ddd0',
                              borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                              minWidth: '160px', padding: '4px', marginTop: '4px'
                            }}>
                              {sheet.status === 'DRAFT' && (
                                <button
                                  onClick={() => updateStatusMutation.mutate({ id: sheet.id, action: 'submit' })}
                                  style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <i className="fa fa-paper-plane" style={{ marginRight: '8px', width: '16px' }}></i>Submit
                                </button>
                              )}
                              {sheet.status === 'SUBMITTED' && (
                                <button
                                  onClick={() => updateStatusMutation.mutate({ id: sheet.id, action: 'verify' })}
                                  style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#059669', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <i className="fa fa-check-circle" style={{ marginRight: '8px', width: '16px' }}></i>Verify
                                </button>
                              )}
                              {sheet.status === 'VERIFIED' && (
                                <>
                                  <button
                                    onClick={() => updateStatusMutation.mutate({ id: sheet.id, action: 'publish' })}
                                    style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <i className="fa fa-globe" style={{ marginRight: '8px', width: '16px' }}></i>Publish
                                  </button>
                                  <button
                                    onClick={() => updateStatusMutation.mutate({ id: sheet.id, action: 'lock' })}
                                    style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <i className="fa fa-lock" style={{ marginRight: '8px', width: '16px' }}></i>Lock
                                  </button>
                                </>
                              )}
                              {sheet.status === 'LOCKED' && (
                                <button
                                  onClick={() => updateStatusMutation.mutate({ id: sheet.id, action: 'unlock' })}
                                  style={{ display: 'block', width: '100%', padding: '10px 16px', fontSize: '13px', color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <i className="fa fa-unlock" style={{ marginRight: '8px', width: '16px' }}></i>Unlock
                                </button>
                              )}
                              <a
                                href={`/dashboard/results-management/analysis?sheetId=${sheet.id}`}
                                style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', fontSize: '13px', color: '#374151', textDecoration: 'none', borderRadius: '6px' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <i className="fa fa-chart-bar" style={{ marginRight: '8px', width: '16px' }}></i>Analysis
                              </a>
                              <a
                                href={`/dashboard/results-management/ranking?sheetId=${sheet.id}`}
                                style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', fontSize: '13px', color: '#374151', textDecoration: 'none', borderRadius: '6px' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f5efe8'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                <i className="fa fa-trophy" style={{ marginRight: '8px', width: '16px' }}></i>Rankings
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)'
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div style={{
            background: '#fdfaf7', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Create Result Sheet</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Class *</label>
                <select
                  value={createForm.classId}
                  onChange={e => setCreateForm({ ...createForm, classId: e.target.value })}
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

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Academic Year</label>
                <select
                  value={createForm.academicYearId}
                  onChange={e => setCreateForm({ ...createForm, academicYearId: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: '14px',
                    border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
                  }}
                >
                  <option value="">Select Year</option>
                  {academicYears.map((y: any) => (
                    <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Term *</label>
                <select
                  value={createForm.termId}
                  onChange={e => setCreateForm({ ...createForm, termId: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: '14px',
                    border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
                  }}
                >
                  <option value="">Select Term</option>
                  {filteredTerms.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} {t.isCurrent ? '(Current)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Exam Type *</label>
                <select
                  value={createForm.examType}
                  onChange={e => setCreateForm({ ...createForm, examType: e.target.value })}
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Title (optional)</label>
                <input
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g., End of Term Exam 2025"
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: '14px',
                    border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '10px 20px', fontSize: '14px', color: '#374151',
                  background: '#f5efe8', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => createSheetMutation.mutate(createForm)}
                disabled={!createForm.classId || !createForm.termId || createSheetMutation.isPending}
                style={{
                  padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white',
                  background: !createForm.classId || !createForm.termId ? '#d1d5db' : '#ea6645',
                  border: 'none', borderRadius: '8px', cursor: !createForm.classId || !createForm.termId ? 'not-allowed' : 'pointer'
                }}
              >
                {createSheetMutation.isPending ? 'Creating...' : 'Create Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
