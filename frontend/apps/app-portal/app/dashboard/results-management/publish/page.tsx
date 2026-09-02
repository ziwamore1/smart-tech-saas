'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { useSchoolSocket } from '@/lib/use-school-socket';

export default function PublishPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState<{ id: string; action: string; title: string; description: string } | null>(null);

  const userRoles = user?.allRoles || user?.roles || [];
  const isDirector = userRoles.some((r: string) => ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head'].includes(r));

  // Real-time: refresh when results are published elsewhere
  useSchoolSocket({
    'results:published': () => {
      queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
    },
  });

  const { data: sheetsData, isLoading } = useQuery({
    queryKey: ['result-sheets', 'publish'],
    queryFn: async () => {
      const r = await api.get('/results-management/sheets');
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const allSheets = useMemo(() => Array.isArray(sheetsData) ? sheetsData : [], [sheetsData]);

  const readyToPublish = useMemo(() =>
    allSheets.filter((s: any) => s.status === 'VERIFIED'),
  [allSheets]);

  const publishedSheets = useMemo(() =>
    allSheets.filter((s: any) => s.status === 'PUBLISHED' || s.status === 'LOCKED'),
  [allSheets]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/results-management/sheets/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
      setShowConfirm(null);
      toast.success('Status updated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Action failed');
    },
  });

  const confirmPublish = (id: string, action: string) => {
    if (action === 'publish') {
      setShowConfirm({
        id, action: 'publish',
        title: 'Publish Results',
        description: 'This will make results visible to students and parents. Are you sure?'
      });
    } else if (action === 'publish-to-parents') {
      setShowConfirm({
        id, action: 'publish',
        title: 'Publish to Parents',
        description: 'This will send notifications to parents about published results. Continue?'
      });
    } else if (action === 'lock') {
      setShowConfirm({
        id, action: 'lock',
        title: 'Lock Results',
        description: 'This will lock the results, preventing teachers from editing them. Students and parents will still see them. Are you sure?'
      });
    } else if (action === 'unlock') {
      setShowConfirm({
        id, action: 'unlock',
        title: 'Unlock Results',
        description: 'This will unlock the results, allowing teachers to edit them again. Are you sure?'
      });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Publish Results</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
          Publish verified results to students and parents
        </p>
      </div>

      {/* Ready to Publish */}
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
        <i className="fa fa-check-circle" style={{ color: '#059669', marginRight: '8px' }}></i>
        Ready to Publish ({readyToPublish.length})
      </h2>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px', color: '#ea6645' }}></i>
        </div>
      ) : readyToPublish.length === 0 ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '40px', textAlign: 'center', marginBottom: '32px'
        }}>
          <i className="fa fa-check-double" style={{ fontSize: '40px', color: '#d1fae5', marginBottom: '12px' }}></i>
          <p style={{ color: '#9ca3af', margin: 0 }}>No verified sheets ready for publishing</p>
        </div>
      ) : (
        <div style={{ marginBottom: '32px' }}>
          {readyToPublish.map((sheet: any) => (
            <div key={sheet.id} style={{
              background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
              padding: '20px', marginBottom: '12px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                    {sheet.class?.name || 'Unknown Class'}
                  </h4>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{sheet.examType || 'Exam'}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                    background: '#d1fae5', color: '#059669'
                  }}>
                    Verified
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span><i className="fa fa-calendar" style={{ marginRight: '4px' }}></i>{sheet.term?.name || 'N/A'}</span>
                  <span><i className="fa fa-users" style={{ marginRight: '4px' }}></i>{sheet.studentCount || 0} students</span>
                  {sheet.verifiedAt && (
                    <span><i className="fa fa-clock" style={{ marginRight: '4px' }}></i>Verified: {new Date(sheet.verifiedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => confirmPublish(sheet.id, 'publish')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 20px', fontSize: '13px', fontWeight: 600,
                    color: 'white', background: '#7c3aed', border: 'none', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <i className="fa fa-globe"></i> Publish to All
                </button>
                <button
                  onClick={() => confirmPublish(sheet.id, 'publish-to-parents')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 20px', fontSize: '13px', fontWeight: 600,
                    color: '#7c3aed', background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <i className="fa fa-bell"></i> Publish to Parents
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Published Sheets */}
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
        <i className="fa fa-globe" style={{ color: '#7c3aed', marginRight: '8px' }}></i>
        Published Results ({publishedSheets.length})
      </h2>

      {publishedSheets.length === 0 ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '40px', textAlign: 'center'
        }}>
          <i className="fa fa-globe" style={{ fontSize: '40px', color: '#e8ddd0', marginBottom: '12px' }}></i>
          <p style={{ color: '#9ca3af', margin: 0 }}>No published results yet</p>
        </div>
      ) : (
        <div>
          {publishedSheets.map((sheet: any) => (
            <div key={sheet.id} style={{
              background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
              padding: '20px', marginBottom: '12px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                    {sheet.class?.name || 'Unknown Class'}
                  </h4>
                  <span style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                    background: sheet.status === 'LOCKED' ? '#fee2e2' : '#f3e8ff',
                    color: sheet.status === 'LOCKED' ? '#dc2626' : '#7c3aed'
                  }}>
                    <i className={`fa ${sheet.status === 'LOCKED' ? 'fa-lock' : 'fa-globe'}`} style={{ marginRight: '4px' }}></i>
                    {sheet.status === 'LOCKED' ? 'Locked' : 'Published'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span><i className="fa fa-calendar" style={{ marginRight: '4px' }}></i>{sheet.term?.name || 'N/A'}</span>
                  <span><i className="fa fa-file-signature" style={{ marginRight: '4px' }}></i>{sheet.examType || 'Exam'}</span>
                  <span><i className="fa fa-users" style={{ marginRight: '4px' }}></i>{sheet.studentCount || 0} students</span>
                  {sheet.publishedAt && (
                    <span><i className="fa fa-clock" style={{ marginRight: '4px' }}></i>{new Date(sheet.publishedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              {isDirector && sheet.status === 'LOCKED' ? (
                <button
                  onClick={() => confirmPublish(sheet.id, 'unlock')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                    color: '#f59e0b', background: '#fef3c7', border: '1px solid #fcd34d',
                    borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <i className="fa fa-unlock"></i> Unlock
                </button>
              ) : isDirector && (
                <button
                  onClick={() => confirmPublish(sheet.id, 'lock')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                    color: '#7c3aed', background: '#f3e8ff', border: '1px solid #d8b4fe',
                    borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <i className="fa fa-lock"></i> Lock
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)'
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(null); }}
        >
          <div style={{
            background: '#fdfaf7', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.2)', textAlign: 'center'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: '28px', color: '#7c3aed'
            }}>
              <i className="fa fa-globe"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>
              {showConfirm.title}
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
              {showConfirm.description}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowConfirm(null)}
                style={{
                  padding: '10px 20px', fontSize: '14px', color: '#374151',
                  background: '#f5efe8', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatusMutation.mutate({ id: showConfirm.id, action: showConfirm.action })}
                disabled={updateStatusMutation.isPending}
                style={{
                  padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white',
                  background: updateStatusMutation.isPending ? '#d1d5db' :
                    showConfirm.action === 'unlock' ? '#f59e0b' : '#7c3aed',
                  border: 'none', borderRadius: '8px',
                  cursor: updateStatusMutation.isPending ? 'not-allowed' : 'pointer'
                }}
              >
                {updateStatusMutation.isPending ? 'Processing...' : `Yes, ${showConfirm.title}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
