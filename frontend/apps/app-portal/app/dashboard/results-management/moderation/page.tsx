'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

type ModerationTab = 'pending' | 'verified' | 'all';

export default function ModerationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ModerationTab>('pending');
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string; title: string } | null>(null);

  const isDirector = user?.roles?.includes('Director');
  const isHOD = user?.roles?.includes('HOD');
  const isTeacher = user?.roles?.includes('Teacher') || user?.roles?.includes('ClassTeacher');

  const { data: sheetsData, isLoading } = useQuery({
    queryKey: ['result-sheets', 'all'],
    queryFn: async () => {
      const r = await api.get('/results-management/sheets');
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const allSheets = useMemo(() => Array.isArray(sheetsData) ? sheetsData : [], [sheetsData]);

  const pendingSubmission = useMemo(() =>
    allSheets.filter((s: any) => s.status === 'DRAFT'),
  [allSheets]);

  const pendingVerification = useMemo(() =>
    allSheets.filter((s: any) => s.status === 'SUBMITTED'),
  [allSheets]);

  const verifiedSheets = useMemo(() =>
    allSheets.filter((s: any) => s.status === 'VERIFIED' || s.status === 'PUBLISHED' || s.status === 'LOCKED'),
  [allSheets]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.post(`/results-management/sheets/${id}/${action}`),
    onSuccess: (r: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['result-sheets'] });
      setConfirmAction(null);
      toast.success(`Sheet ${variables.action}ed successfully`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Action failed');
    },
  });

  const handleAction = (id: string, action: string) => {
    const actionTitle = action === 'submit' ? 'Submit' : action === 'verify' ? 'Verify' : action === 'lock' ? 'Lock' : action;
    setConfirmAction({ id, action, title: actionTitle });
  };

  const getStatusTimeline = (status: string) => {
    const steps = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'PUBLISHED', 'LOCKED'];
    const currentIdx = steps.indexOf(status);
    return steps.map((step, idx) => ({
      step,
      active: idx <= currentIdx,
      isCurrent: idx === currentIdx,
    }));
  };

  const renderSheetCard = (sheet: any, showActions: boolean) => {
    const timeline = getStatusTimeline(sheet.status);
    return (
      <div key={sheet.id} style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '20px', marginBottom: '16px',
        transition: 'all 0.2s'
      }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                {sheet.class?.name || 'Unknown Class'}
              </h3>
              <span style={{
                padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                background: sheet.status === 'DRAFT' ? '#f3f4f6' :
                  sheet.status === 'SUBMITTED' ? '#dbeafe' :
                  sheet.status === 'VERIFIED' ? '#d1fae5' :
                  sheet.status === 'PUBLISHED' ? '#f3e8ff' : '#fee2e2',
                color: sheet.status === 'DRAFT' ? '#6b7280' :
                  sheet.status === 'SUBMITTED' ? '#2563eb' :
                  sheet.status === 'VERIFIED' ? '#059669' :
                  sheet.status === 'PUBLISHED' ? '#7c3aed' : '#dc2626'
              }}>
                {sheet.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px', color: '#6b7280' }}>
              <span><i className="fa fa-calendar" style={{ marginRight: '6px' }}></i>{sheet.term?.name || 'N/A'}</span>
              <span><i className="fa fa-file-signature" style={{ marginRight: '6px' }}></i>{sheet.examType || 'N/A'}</span>
              <span><i className="fa fa-users" style={{ marginRight: '6px' }}></i>{sheet.studentCount || 0} students</span>
              <span><i className="fa fa-check-circle" style={{ marginRight: '6px' }}></i>{sheet.entriesCount || 0} entries</span>
              {sheet.submittedBy && <span><i className="fa fa-user" style={{ marginRight: '6px' }}></i>By: {sheet.submittedBy}</span>}
            </div>
          </div>

          {showActions && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {sheet.status === 'DRAFT' && (
                <button
                  onClick={() => handleAction(sheet.id, 'submit')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                    color: 'white', background: '#2563eb', border: 'none', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <i className="fa fa-paper-plane"></i> Submit
                </button>
              )}
              {sheet.status === 'SUBMITTED' && (isDirector || isHOD) && (
                <button
                  onClick={() => handleAction(sheet.id, 'verify')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                    color: 'white', background: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  <i className="fa fa-check-circle"></i> Verify
                </button>
              )}
              {sheet.status === 'VERIFIED' && isDirector && (
                <>
                  <button
                    onClick={() => handleAction(sheet.id, 'publish')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                      color: 'white', background: '#7c3aed', border: 'none', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    <i className="fa fa-globe"></i> Publish
                  </button>
                  <button
                    onClick={() => handleAction(sheet.id, 'lock')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                      color: 'white', background: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer'
                    }}
                  >
                    <i className="fa fa-lock"></i> Lock
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status Timeline */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {timeline.map((step, idx) => (
              <div key={step.step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px', borderRadius: '20px',
                  background: step.isCurrent ? (step.step === 'DRAFT' ? '#f3f4f6' :
                    step.step === 'SUBMITTED' ? '#dbeafe' :
                    step.step === 'VERIFIED' ? '#d1fae5' :
                    step.step === 'PUBLISHED' ? '#f3e8ff' : '#fee2e2') : step.active ? '#f5efe8' : '#f9fafb',
                  border: step.isCurrent ? `2px solid ${step.step === 'DRAFT' ? '#6b7280' :
                    step.step === 'SUBMITTED' ? '#2563eb' :
                    step.step === 'VERIFIED' ? '#059669' :
                    step.step === 'PUBLISHED' ? '#7c3aed' : '#dc2626'}` : '1px solid #e8ddd0',
                  fontSize: '11px', fontWeight: 600,
                  color: step.active ? '#374151' : '#d1d5db',
                  whiteSpace: 'nowrap'
                }}>
                  {step.step === 'SUBMITTED' ? <i className="fa fa-paper-plane"></i> :
                    step.step === 'VERIFIED' ? <i className="fa fa-check-circle"></i> :
                    step.step === 'PUBLISHED' ? <i className="fa fa-globe"></i> :
                    step.step === 'LOCKED' ? <i className="fa fa-lock"></i> :
                    <i className="fa fa-file"></i>}
                  {step.step}
                </div>
                {idx < timeline.length - 1 && (
                  <div style={{
                    flex: 1, height: '2px',
                    background: step.active ? '#ea6645' : '#e8ddd0',
                    margin: '0 4px'
                  }}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { key: 'pending' as ModerationTab, label: 'Pending Submission', count: pendingSubmission.length, icon: 'fa-clock' },
    { key: 'pending-verify' as ModerationTab, label: 'Pending Verification', count: pendingVerification.length, icon: 'fa-check-circle' },
    { key: 'verified' as ModerationTab, label: 'Verified / Published', count: verifiedSheets.length, icon: 'fa-check-double' },
  ];

  const currentSheets = activeTab === 'pending' ? pendingSubmission :
    activeTab === 'pending-verify' ? pendingVerification : verifiedSheets;

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Moderation</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
          Review, verify, and publish result sheets through the workflow
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        background: '#f5efe8', padding: '4px', borderRadius: '12px',
        flexWrap: 'wrap'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', fontSize: '14px', fontWeight: 600,
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              background: activeTab === tab.key ? '#fdfaf7' : 'transparent',
              color: activeTab === tab.key ? '#ea6645' : '#6b7280',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            <i className={`fa ${tab.icon}`}></i>
            {tab.label}
            <span style={{
              padding: '2px 10px', borderRadius: '9999px', fontSize: '12px',
              background: activeTab === tab.key ? '#ea6645' : '#e8ddd0',
              color: activeTab === tab.key ? 'white' : '#6b7280'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Sheet Cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#ea6645' }}></i>
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Loading sheets...</p>
        </div>
      ) : currentSheets.length === 0 ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <i className="fa fa-check-circle" style={{ fontSize: '48px', color: '#d1fae5' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '16px 0 8px' }}>
            {activeTab === 'pending' ? 'No Pending Submissions' :
             activeTab === 'pending-verify' ? 'No Pending Verifications' : 'No Verified Sheets'}
          </h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            {activeTab === 'pending' ? 'All results have been submitted for review.' :
             activeTab === 'pending-verify' ? 'All submitted results have been verified.' : 'No sheets have been verified yet.'}
          </p>
        </div>
      ) : (
        <div>
          {currentSheets.map((sheet: any) => renderSheetCard(sheet, true))}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)'
        }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmAction(null); }}
        >
          <div style={{
            background: '#fdfaf7', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.2)', textAlign: 'center'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: confirmAction.action === 'lock' ? '#fee2e2' : '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: '28px',
              color: confirmAction.action === 'lock' ? '#dc2626' : '#2563eb'
            }}>
              <i className={`fa fa-${confirmAction.action === 'lock' ? 'lock' : confirmAction.action === 'verify' ? 'check-circle' : confirmAction.action === 'publish' ? 'globe' : 'paper-plane'}`}></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>
              {confirmAction.title} Result Sheet?
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>
              Are you sure you want to {confirmAction.action} this result sheet? This action will change the status and may affect access.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  padding: '10px 20px', fontSize: '14px', color: '#374151',
                  background: '#f5efe8', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatusMutation.mutate({ id: confirmAction.id, action: confirmAction.action })}
                disabled={updateStatusMutation.isPending}
                style={{
                  padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white',
                  background: updateStatusMutation.isPending ? '#d1d5db' :
                    confirmAction.action === 'lock' ? '#dc2626' :
                    confirmAction.action === 'verify' ? '#059669' :
                    confirmAction.action === 'publish' ? '#7c3aed' : '#2563eb',
                  border: 'none', borderRadius: '8px', cursor: updateStatusMutation.isPending ? 'not-allowed' : 'pointer'
                }}
              >
                {updateStatusMutation.isPending ? 'Processing...' : `Yes, ${confirmAction.title}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
