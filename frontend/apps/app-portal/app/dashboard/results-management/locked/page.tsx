'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

export default function LockedResultsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showUnlockModal, setShowUnlockModal] = useState<{ id: string; title: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const userRoles = user?.allRoles || user?.roles || [];
  const isDirector = userRoles.some((r: string) => ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head'].includes(r));

  const { data: sheetsData, isLoading } = useQuery({
    queryKey: ['result-sheets', 'locked'],
    queryFn: async () => {
      const r = await api.get('/results-management/sheets', { params: { status: 'LOCKED' } });
      const d = r.data?.data || r.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const lockedSheets = useMemo(() => Array.isArray(sheetsData) ? sheetsData : [], [sheetsData]);

  const unlockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/results-management/sheets/${id}/unlock`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['result-sheets', 'locked'] });
      setShowUnlockModal(null);
      setUnlockReason('');
      toast.success('Sheet unlocked successfully');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to unlock');
    },
  });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Locked Results</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
          View and manage locked result sheets. Only directors can unlock.
        </p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#ea6645' }}></i>
        </div>
      ) : lockedSheets.length === 0 ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%', background: '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '32px', color: '#9ca3af'
          }}>
            <i className="fa fa-unlock"></i>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Locked Results</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            All result sheets are currently unlocked and editable
          </p>
        </div>
      ) : (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '16px 20px', background: '#fef3c7', border: '1px solid #fcd34d',
            borderRadius: '12px', marginBottom: '20px'
          }}>
            <i className="fa fa-info-circle" style={{ color: '#d97706', fontSize: '18px' }}></i>
            <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
              {lockedSheets.length} sheet(s) are locked. Locked results cannot be edited by teachers.
              {isDirector ? ' You can unlock them below.' : ' Contact a director to unlock.'}
            </p>
          </div>

          {lockedSheets.map((sheet: any) => (
            <div key={sheet.id} style={{
              background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
              padding: '24px', marginBottom: '16px'
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '10px',
                      background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#dc2626', fontSize: '20px'
                    }}>
                      <i className="fa fa-lock"></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                        {sheet.class?.name || 'Unknown Class'}
                      </h3>
                      <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span>{sheet.term?.name || 'N/A'}</span>
                        <span>{sheet.examType || 'Exam'}</span>
                        <span>{sheet.studentCount || 0} students</span>
                      </div>
                    </div>
                  </div>

                  {/* Lock details */}
                  <div style={{
                    background: '#f5efe8', borderRadius: '8px', padding: '16px',
                    marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '24px'
                  }}>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Locked By</p>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>
                        {sheet.lockedBy || sheet.lockedByName || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Locked At</p>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>
                        {sheet.lockedAt ? new Date(sheet.lockedAt).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Status</p>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                        background: '#fee2e2', color: '#dc2626'
                      }}>
                        <i className="fa fa-lock" style={{ marginRight: '4px' }}></i>LOCKED
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Entries</p>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>
                        {sheet.entriesCount || 0} / {(sheet.studentCount || 0) * 5}
                      </p>
                    </div>
                  </div>

                  {/* Audit trail */}
                  {sheet.auditTrail && sheet.auditTrail.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>
                        <i className="fa fa-history" style={{ marginRight: '6px' }}></i>Audit Trail
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {sheet.auditTrail.slice(0, 5).map((entry: any, idx: number) => (
                          <div key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontSize: '13px', color: '#6b7280'
                          }}>
                            <span style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: entry.action === 'LOCKED' ? '#fee2e2' :
                                entry.action === 'PUBLISHED' ? '#f3e8ff' :
                                entry.action === 'VERIFIED' ? '#d1fae5' : '#f3f4f6',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px',
                              color: entry.action === 'LOCKED' ? '#dc2626' :
                                entry.action === 'PUBLISHED' ? '#7c3aed' :
                                entry.action === 'VERIFIED' ? '#059669' : '#6b7280'
                            }}>
                              <i className={`fa fa-${
                                entry.action === 'LOCKED' ? 'lock' :
                                entry.action === 'PUBLISHED' ? 'globe' :
                                entry.action === 'VERIFIED' ? 'check-circle' :
                                entry.action === 'SUBMITTED' ? 'paper-plane' : 'file'
                              }`}></i>
                            </span>
                            <span style={{ fontWeight: 500 }}>{entry.action}</span>
                            <span>by {entry.performedBy || entry.user || 'Unknown'}</span>
                            <span style={{ color: '#9ca3af' }}>
                              {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}
                            </span>
                          </div>
                        ))}
                        {sheet.auditTrail.length > 5 && (
                          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                            +{sheet.auditTrail.length - 5} more entries
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Unlock button - Director only */}
                {isDirector && (
                  <button
                    onClick={() => setShowUnlockModal({ id: sheet.id, title: `${sheet.class?.name || 'Unknown'} - ${sheet.examType || 'Exam'}` })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '10px 20px', fontSize: '13px', fontWeight: 600,
                      color: '#f59e0b', background: '#fef3c7', border: '1px solid #fcd34d',
                      borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    <i className="fa fa-unlock"></i> Unlock
                  </button>
                )}
              </div>

              {!isDirector && (
                <div style={{
                  marginTop: '16px', padding: '12px 16px',
                  background: '#f5efe8', borderRadius: '8px', fontSize: '13px', color: '#6b7280'
                }}>
                  <i className="fa fa-lock" style={{ marginRight: '8px' }}></i>
                  This sheet is locked. Only a Director can unlock it.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unlock Modal */}
      {showUnlockModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)'
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowUnlockModal(null); }}
        >
          <div style={{
            background: '#fdfaf7', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '440px',
            boxShadow: '0 25px 80px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: '28px', color: '#d97706'
            }}>
              <i className="fa fa-unlock"></i>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', textAlign: 'center' }}>
              Unlock Result Sheet
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', margin: '0 0 20px' }}>
              {showUnlockModal.title}
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>
                Reason for Unlocking *
              </label>
              <textarea
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="Please provide a reason for unlocking this result sheet..."
                rows={4}
                style={{
                  width: '100%', padding: '12px 14px', fontSize: '14px',
                  border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9',
                  resize: 'vertical', fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => { setShowUnlockModal(null); setUnlockReason(''); }}
                style={{
                  padding: '10px 20px', fontSize: '14px', color: '#374151',
                  background: '#f5efe8', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => unlockMutation.mutate({ id: showUnlockModal.id, reason: unlockReason })}
                disabled={!unlockReason.trim() || unlockMutation.isPending}
                style={{
                  padding: '10px 24px', fontSize: '14px', fontWeight: 600, color: 'white',
                  background: !unlockReason.trim() ? '#d1d5db' : '#f59e0b',
                  border: 'none', borderRadius: '8px',
                  cursor: !unlockReason.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {unlockMutation.isPending ? 'Unlocking...' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
