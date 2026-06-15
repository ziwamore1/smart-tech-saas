'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, classApi, termApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

const ACTION_ICONS: Record<string, string> = {
  CREATED: 'fa-plus-circle',
  SUBMITTED: 'fa-paper-plane',
  VERIFIED: 'fa-check-circle',
  PUBLISHED: 'fa-globe',
  LOCKED: 'fa-lock',
  UNLOCKED: 'fa-unlock',
  UPDATED: 'fa-edit',
  DELETED: 'fa-trash',
  IMPORTED: 'fa-upload',
};

const ACTION_COLORS: Record<string, string> = {
  CREATED: '#3b82f6',
  SUBMITTED: '#2563eb',
  VERIFIED: '#059669',
  PUBLISHED: '#7c3aed',
  LOCKED: '#dc2626',
  UNLOCKED: '#f59e0b',
  UPDATED: '#0891b2',
  DELETED: '#ef4444',
  IMPORTED: '#10b981',
};

const ACTION_BG: Record<string, string> = {
  CREATED: '#eff6ff',
  SUBMITTED: '#dbeafe',
  VERIFIED: '#d1fae5',
  PUBLISHED: '#f3e8ff',
  LOCKED: '#fee2e2',
  UNLOCKED: '#fef3c7',
  UPDATED: '#ecfeff',
  DELETED: '#fee2e2',
  IMPORTED: '#d1fae5',
};

export default function AuditTrailPage() {
  const { user } = useAuth();
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [page, setPage] = useState(1);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const pageSize = 20;

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['result-audit-logs', filterAction, filterEntityType, dateFrom, dateTo, searchUser, page],
    queryFn: async () => {
      const params: Record<string, any> = { page, limit: pageSize };
      if (filterAction) params.action = filterAction;
      if (filterEntityType) params.entityType = filterEntityType;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchUser) params.performedBy = searchUser;
      const r = await api.get('/results-management/audit-logs', { params });
      const d = r.data?.data || r.data;
      if (Array.isArray(d)) return { entries: d, total: d.length };
      return { entries: d.entries || d.logs || d.results || [], total: d.total || d.count || (d.entries || d.logs || []).length };
    },
  });

  const entries = useMemo(() => {
    const e = auditData?.entries || [];
    return Array.isArray(e) ? e : [];
  }, [auditData]);

  const totalCount = auditData?.total || entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const exportAuditLog = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/results-management/audit-logs/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Audit log exported');
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  }, []);

  const actionTypes = ['CREATED', 'SUBMITTED', 'VERIFIED', 'PUBLISHED', 'LOCKED', 'UNLOCKED', 'UPDATED', 'DELETED', 'IMPORTED'];
  const entityTypes = ['ResultSheet', 'ResultEntry', 'Result', 'Student'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Audit Trail</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
            Track all changes and actions performed on result sheets
          </p>
        </div>
        <button
          onClick={exportAuditLog}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', fontSize: '13px', fontWeight: 600,
            color: '#374151', background: '#f5efe8', border: '1px solid #e8ddd0',
            borderRadius: '8px', cursor: 'pointer'
          }}
        >
          <i className="fa fa-download"></i> Export Log
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
        padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Action</label>
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
          >
            <option value="">All Actions</option>
            {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Entity Type</label>
          <select
            value={filterEntityType}
            onChange={e => { setFilterEntityType(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
          >
            <option value="">All Types</option>
            {entityTypes.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            style={{ padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            style={{ padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
          />
        </div>
        <div style={{ flex: '1', minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6b7280', marginBottom: '6px' }}>Performed By</label>
          <input
            value={searchUser}
            onChange={e => { setSearchUser(e.target.value); setPage(1); }}
            placeholder="Search user..."
            style={{ width: '100%', padding: '10px 14px', fontSize: '14px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9' }}
          />
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '32px', color: '#ea6645' }}></i>
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Loading audit trail...</p>
        </div>
      ) : entries.length === 0 ? (
        <div style={{
          background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
          padding: '60px', textAlign: 'center'
        }}>
          <i className="fa fa-history" style={{ fontSize: '48px', color: '#e8ddd0', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>No Audit Entries</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>
            No changes have been recorded yet. Actions like creating, submitting, and verifying sheets will appear here.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute', left: '40px', top: '0', bottom: '0',
            width: '2px', background: '#e8ddd0', zIndex: 0
          }}></div>

          {entries.map((entry: any, idx: number) => {
            const action = entry.action || entry.type || 'UPDATED';
            const icon = ACTION_ICONS[action] || 'fa-circle';
            const color = ACTION_COLORS[action] || '#6b7280';
            const bg = ACTION_BG[action] || '#f3f4f6';
            const isExpanded = expandedEntry === entry.id || expandedEntry === `entry-${idx}`;

            return (
              <div key={entry.id || `entry-${idx}`} style={{
                position: 'relative', zIndex: 1,
                paddingLeft: '40px', marginBottom: '12px'
              }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute', left: '30px', top: '20px',
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: bg, border: `3px solid ${color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: color, fontSize: '11px', transform: 'translateX(-50%)'
                }}>
                  <i className={`fa ${icon}`}></i>
                </div>

                {/* Entry card */}
                <div style={{
                  background: '#fdfaf7', border: '1px solid #e8ddd0', borderRadius: '12px',
                  padding: '16px 20px', marginLeft: '20px',
                  transition: 'all 0.2s'
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                        background: bg, color: color, textTransform: 'uppercase'
                      }}>
                        {action}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                        {entry.entityType || entry.entity || 'Sheet'}
                      </span>
                      {entry.description && (
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>
                          - {entry.description}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#9ca3af' }}>
                      <span>
                        <i className="fa fa-user" style={{ marginRight: '4px' }}></i>
                        {entry.performedBy || entry.user || entry.userName || 'Unknown'}
                      </span>
                      <span>
                        <i className="fa fa-clock" style={{ marginRight: '4px' }}></i>
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Unknown'}
                      </span>
                      <button
                        onClick={() => setExpandedEntry(isExpanded ? null : (entry.id || `entry-${idx}`))}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
                      >
                        <i className={`fa fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{
                      marginTop: '12px', padding: '12px 16px',
                      background: '#f5efe8', borderRadius: '8px',
                      fontSize: '13px'
                    }}>
                      {entry.details || entry.changes || entry.metadata ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(entry.details || entry.changes || entry.metadata || {}).map(([key, val]: [string, any]) => (
                            <div key={key}>
                              <span style={{ fontWeight: 600, color: '#6b7280', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}: </span>
                              <span style={{ color: '#374151' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#9ca3af', margin: 0 }}>No additional details available</p>
                      )}
                      {entry.oldValue && entry.newValue && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            <p style={{ fontWeight: 600, color: '#dc2626', margin: '0 0 4px' }}>Old Value</p>
                            <pre style={{ margin: 0, fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap' }}>
                              {typeof entry.oldValue === 'object' ? JSON.stringify(entry.oldValue, null, 2) : entry.oldValue}
                            </pre>
                          </div>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            <p style={{ fontWeight: 600, color: '#059669', margin: '0 0 4px' }}>New Value</p>
                            <pre style={{ margin: 0, fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap' }}>
                              {typeof entry.newValue === 'object' ? JSON.stringify(entry.newValue, null, 2) : entry.newValue}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: '8px', marginTop: '24px', padding: '16px'
        }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 16px', fontSize: '13px',
              border: '1px solid #e8ddd0', borderRadius: '8px',
              background: page === 1 ? '#f5efe8' : '#fdfaf7',
              color: page === 1 ? '#d1d5db' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            <i className="fa fa-chevron-left"></i> Previous
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    border: page === pageNum ? '2px solid #ea6645' : '1px solid #e8ddd0',
                    background: page === pageNum ? '#fff5f3' : '#fdfaf7',
                    color: page === pageNum ? '#ea6645' : '#374151',
                    fontWeight: page === pageNum ? 700 : 500, cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              padding: '8px 16px', fontSize: '13px',
              border: '1px solid #e8ddd0', borderRadius: '8px',
              background: page === totalPages ? '#f5efe8' : '#fdfaf7',
              color: page === totalPages ? '#d1d5db' : '#374151', cursor: page === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next <i className="fa fa-chevron-right"></i>
          </button>
        </div>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <div style={{
          textAlign: 'center', padding: '16px', fontSize: '13px', color: '#9ca3af'
        }}>
          Showing {entries.length} of {totalCount} entries
        </div>
      )}
    </div>
  );
}
