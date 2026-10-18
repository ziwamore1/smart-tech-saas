'use client';

import { useCallback, useEffect, useState } from 'react';
import { financialDocumentsApi } from '@/lib/api';
import { Card, PageHeader, Loading, Empty, ErrorBox, StatusBadge, inputStyle, ghostBtn, formatDate, C } from '../_shared';

type AuditEvent = { id: string; action: string; entity: string; documentType?: string; documentId?: string; documentNumber?: string; userEmail?: string; oldValues?: any; newValues?: any; createdAt: string };

export default function FinancialAuditArchivePage() {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [documentType, setDocumentType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const pageSize = 25;

  const load = useCallback(async (targetPage = page) => {
    setLoading(true); setError(null);
    try {
      const res: any = await financialDocumentsApi.auditLogs({ page: targetPage, pageSize, documentType: documentType || undefined, action: action || undefined, from: from || undefined, to: to || undefined });
      const data = res.data || res;
      setRows(data.items || []); setTotal(data.total || 0); setPage(data.page || targetPage);
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load the financial audit archive.'); }
    finally { setLoading(false); }
  }, [page, documentType, action, from, to]);

  useEffect(() => { void load(1); }, [documentType, action, from, to]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return <div>
    <PageHeader title="Financial Audit Archive" subtitle="A traceable record of every financial document action across the platform." actions={<button style={ghostBtn} onClick={() => load()}><i className="fa fa-rotate-right"></i> Refresh</button>} />
    <Card style={{ marginBottom: 16, padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Document type<select style={{ ...inputStyle, marginTop: 5, minWidth: 180 }} value={documentType} onChange={e => setDocumentType(e.target.value)}><option value="">All documents</option><option value="QUOTATION">Quotation</option><option value="INVOICE">Invoice</option><option value="PAYMENT_RECEIPT">Payment receipt</option></select></label>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Action<select style={{ ...inputStyle, marginTop: 5, minWidth: 150 }} value={action} onChange={e => setAction(e.target.value)}><option value="">All actions</option>{['CREATE', 'UPDATE', 'ISSUE', 'SEND', 'CONVERT', 'PAYMENT', 'VOID', 'CANCEL'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>From<input type="date" style={{ ...inputStyle, marginTop: 5 }} value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>To<input type="date" style={{ ...inputStyle, marginTop: 5 }} value={to} onChange={e => setTo(e.target.value)} /></label>
        <button style={ghostBtn} onClick={() => { setDocumentType(''); setAction(''); setFrom(''); setTo(''); }}><i className="fa fa-times"></i> Clear</button>
      </div>
    </Card>
    {error && <div style={{ marginBottom: 16 }}><ErrorBox message={error} onRetry={() => load()} /></div>}
    <Card>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="No financial audit events match these filters." /> : <>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr style={{ color: C.light, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' }}><th style={th}>Timestamp</th><th style={th}>Action</th><th style={th}>Document</th><th style={th}>Number</th><th style={th}>Actor</th><th style={{ ...th, textAlign: 'right' }}>Details</th></tr></thead><tbody>{rows.map(event => <tr key={event.id} style={{ borderTop: `1px solid ${C.border}` }}><td style={td}>{formatDate(event.createdAt)}<div style={{ color: C.light, fontSize: 11 }}>{new Date(event.createdAt).toLocaleTimeString()}</div></td><td style={td}><StatusBadge status={event.action} /></td><td style={td}>{event.documentType?.replace(/_/g, ' ') || event.entity}</td><td style={{ ...td, fontWeight: 700 }}>{event.documentNumber || '—'}</td><td style={{ ...td, color: C.muted }}>{event.userEmail || 'System'}</td><td style={{ ...td, textAlign: 'right' }}><button style={{ ...ghostBtn, padding: '6px 10px', fontSize: 12 }} onClick={() => setSelected(event)}>Inspect</button></td></tr>)}</tbody></table></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}><button style={ghostBtn} disabled={page <= 1} onClick={() => load(page - 1)}><i className="fa fa-chevron-left"></i></button><span style={{ color: C.muted, fontSize: 13 }}>Page {page} of {pageCount} · {total} events</span><button style={ghostBtn} disabled={page >= pageCount} onClick={() => load(page + 1)}><i className="fa fa-chevron-right"></i></button></div>
      </>}
    </Card>
    {selected && <div style={overlay} onClick={() => setSelected(null)}><div style={modal} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div><h3 style={{ margin: 0, color: C.text }}>Audit event</h3><p style={{ margin: '4px 0 0', color: C.muted, fontSize: 12 }}>{selected.action} · {selected.documentNumber || selected.entity}</p></div><button style={closeBtn} onClick={() => setSelected(null)}>×</button></div><pre style={{ margin: 0, padding: 14, background: '#f8fafc', borderRadius: 10, overflow: 'auto', fontSize: 12, color: C.text }}>{JSON.stringify({ oldValues: selected.oldValues, newValues: selected.newValues }, null, 2)}</pre></div></div>}
  </div>;
}

const th: React.CSSProperties = { padding: '8px 10px', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 10px', whiteSpace: 'nowrap' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 48 };
const modal: React.CSSProperties = { background: '#fff', borderRadius: 16, width: 'min(720px, 100%)', padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.22)' };
const closeBtn: React.CSSProperties = { border: 0, borderRadius: 8, width: 32, height: 32, fontSize: 22, color: C.muted, cursor: 'pointer' };
