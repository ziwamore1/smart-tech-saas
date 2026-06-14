'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

const statuses = ['All', 'Delivered', 'Failed', 'Pending'] as const;
const messageTypes = ['All', 'Email', 'SMS', 'WhatsApp', 'Push'] as const;

interface LogEntry {
  id: number;
  type: string;
  provider: string;
  recipient: string;
  status: 'Delivered' | 'Failed' | 'Pending';
  timestamp: string;
  messageId: string;
  error?: string;
  retryCount?: number;
}

const fallbackLogs: LogEntry[] = [
  { id: 1, type: 'Email', provider: 'Zoho Mail', recipient: 'head@lusakaprimary.sch.zm', status: 'Delivered', timestamp: '2026-06-14T13:45:00Z', messageId: 'MSG-20260614-001', retryCount: 0 },
  { id: 2, type: 'Email', provider: 'Zoho Mail', recipient: 'admin@ndolagirls.sch.zm', status: 'Failed', timestamp: '2026-06-14T13:40:00Z', messageId: 'MSG-20260614-002', error: '550 Mailbox not found', retryCount: 2 },
  { id: 3, type: 'SMS', provider: 'Beem Africa', recipient: '+260977123456', status: 'Delivered', timestamp: '2026-06-14T13:35:00Z', messageId: 'MSG-20260614-003', retryCount: 0 },
  { id: 4, type: 'SMS', provider: 'Beem Africa', recipient: '+260977789012', status: 'Pending', timestamp: '2026-06-14T13:30:00Z', messageId: 'MSG-20260614-004', retryCount: 1 },
  { id: 5, type: 'WhatsApp', provider: 'Beem WhatsApp', recipient: '+260977345678', status: 'Delivered', timestamp: '2026-06-14T13:25:00Z', messageId: 'MSG-20260614-005', retryCount: 0 },
  { id: 6, type: 'Email', provider: 'SendGrid', recipient: 'parent@example.com', status: 'Failed', timestamp: '2026-06-14T13:20:00Z', messageId: 'MSG-20260614-006', error: 'Connection timed out', retryCount: 3 },
  { id: 7, type: 'Push', provider: 'Firebase', recipient: 'Device-Token-A1B2C3', status: 'Delivered', timestamp: '2026-06-14T13:15:00Z', messageId: 'MSG-20260614-007', retryCount: 0 },
  { id: 8, type: 'SMS', provider: 'Zamtel', recipient: '+260977654321', status: 'Failed', timestamp: '2026-06-14T13:10:00Z', messageId: 'MSG-20260614-008', error: 'Provider rejected - insufficient balance', retryCount: 0 },
  { id: 9, type: 'Email', provider: 'Gmail SMTP', recipient: 'director@kitweboy.sch.zm', status: 'Delivered', timestamp: '2026-06-14T13:05:00Z', messageId: 'MSG-20260614-009', retryCount: 0 },
  { id: 10, type: 'WhatsApp', provider: 'Meta Cloud API', recipient: '+260977987654', status: 'Failed', timestamp: '2026-06-14T13:00:00Z', messageId: 'MSG-20260614-010', error: 'Recipient opted out', retryCount: 0 },
  { id: 11, type: 'SMS', provider: 'Airtel', recipient: '+260977111222', status: 'Pending', timestamp: '2026-06-14T12:55:00Z', messageId: 'MSG-20260614-011', retryCount: 2 },
  { id: 12, type: 'Push', provider: 'Firebase', recipient: 'Device-Token-D4E5F6', status: 'Delivered', timestamp: '2026-06-14T12:50:00Z', messageId: 'MSG-20260614-012', retryCount: 0 },
];

const typeIconMap: Record<string, string> = {
  Email: 'fa-envelope',
  SMS: 'fa-comment-dots',
  WhatsApp: 'fa-whatsapp',
  Push: 'fa-bell',
};

const typeColorMap: Record<string, string> = {
  Email: '#2563eb',
  SMS: '#d97706',
  WhatsApp: '#059669',
  Push: '#8b5cf6',
};

const typeBgMap: Record<string, string> = {
  Email: '#dbeafe',
  SMS: '#fef3c7',
  WhatsApp: '#d1fae5',
  Push: '#f5f3ff',
};

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    Delivered: { bg: '#d1fae5', color: '#059669' },
    Failed: { bg: '#fee2e2', color: '#dc2626' },
    Pending: { bg: '#fef3c7', color: '#d97706' },
  };
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

const ITEMS_PER_PAGE = 6;

export default function DeliveryLogsPage() {
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>(fallbackLogs);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page, limit: ITEMS_PER_PAGE };
        if (typeFilter !== 'All') params.type = typeFilter;
        if (statusFilter !== 'All') params.status = statusFilter;
        if (search) params.search = search;
        const res = await systemCommunicationApi.getDeliveryLogs(params);
        const body = res.data?.statusCode ? res.data.data : res.data;
        setLogs(body || []);
      } catch {
        setLogs(fallbackLogs);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [typeFilter, statusFilter, search, page]);

  const filtered = logs.filter((log) => {
    if (typeFilter !== 'All' && log.type !== typeFilter) return false;
    if (statusFilter !== 'All' && log.status !== statusFilter) return false;
    if (search && !log.recipient.toLowerCase().includes(search.toLowerCase()) && !log.provider.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .log-row { transition: all 0.2s ease; cursor: pointer; }
        .log-row:hover { background: #f5efe8; }
        .log-detail { animation: slideDown 0.2s ease; }
        @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 200px; } }
        .filter-btn { transition: all 0.2s ease; cursor: pointer; }
        .filter-btn:hover { opacity: 0.85; }
        .page-btn { transition: all 0.15s ease; cursor: pointer; }
        .page-btn:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-clipboard-list" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Delivery Logs
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Monitor message delivery status across all providers</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>Message Type</label>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', background: '#fefcf9' }}>
            {messageTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>Status</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', background: '#fefcf9' }}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>Search Recipient / Provider</label>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search..." style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5efe8', borderBottom: '1px solid #e8ddd0' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Provider</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recipient</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((log) => {
                const sb = statusBadge(log.status);
                const expanded = expandedId === log.id;
                return (
                  <>
                    <tr key={log.id} className="log-row" onClick={() => setExpandedId(expanded ? null : log.id)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', background: typeBgMap[log.type] || '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className={`fa ${typeIconMap[log.type] || 'fa-cog'}`} style={{ fontSize: '14px', color: typeColorMap[log.type] || '#6b7280' }}></i>
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{log.type}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#374151' }}>{log.provider}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#374151', fontFamily: 'monospace' }}>{log.recipient}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: sb.bg, color: sb.color }}>{log.status}</span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9ca3af' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                    {expanded && (
                      <tr key={`${log.id}-detail`} className="log-detail">
                        <td colSpan={5} style={{ padding: '0 20px 16px 76px', background: '#faf7f3' }}>
                          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '12px', background: '#fefcf9', borderRadius: '10px', border: '1px solid #e8ddd0' }}>
                            <div>
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Message ID</span>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', fontFamily: 'monospace' }}>{log.messageId}</div>
                            </div>
                            {log.error && (
                              <div>
                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Error</span>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>{log.error}</div>
                              </div>
                            )}
                            <div>
                              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Retry Count</span>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{log.retryCount ?? 0}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <i className="fa fa-spinner fa-spin" style={{ fontSize: '28px', display: 'block', marginBottom: '12px' }}></i>
            Loading delivery logs...
          </div>
        ) : filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <i className="fa fa-inbox" style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}></i>
            No delivery logs match your filters
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <button className="page-btn" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fefcf9', fontSize: '13px', color: page === 1 ? '#d1d5db' : '#374151', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
            <i className="fa fa-chevron-left"></i>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className="page-btn"
              style={{
                padding: '8px 14px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600,
                background: p === page ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#fefcf9',
                color: p === page ? 'white' : '#374151',
                boxShadow: p === page ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
          <button className="page-btn" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fefcf9', fontSize: '13px', color: page === totalPages ? '#d1d5db' : '#374151', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
            <i className="fa fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}
