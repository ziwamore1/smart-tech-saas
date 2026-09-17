'use client';

import { useEffect, useState, useCallback } from 'react';
import { financialDocumentsApi } from '@/lib/api';
import {
  Card, PageHeader, Loading, Empty, ErrorBox, StatusBadge, Modal, Field,
  inputStyle, primaryBtn, ghostBtn, dangerBtn,
  formatMoney, formatDate, C, PAYMENT_STATUSES,
} from '../_shared';

interface Payment { id: string; paymentNumber?: string; amount?: number; currency?: string; method?: string; transactionReference?: string; status: string; paymentDate?: string; invoice?: any; customer?: any; createdAt?: string }

export default function PaymentsPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusModal, setStatusModal] = useState<{ payment: Payment; status: string; reason: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; run: () => Promise<any> } | null>(null);
  const [detail, setDetail] = useState<Payment | null>(null);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async (p = page, st = status) => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = { page: p, pageSize };
      if (st) params.status = st;
      const res: any = await financialDocumentsApi.listPayments(params);
      const data = res.data || res;
      setRows(data.items || []); setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load payments.');
    } finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true); setError(null);
    try {
      await fn(); await load();
      setStatusModal(null); setConfirmAction(null); setDetail(null);
      window.alert(okMsg);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Operation failed.');
    } finally { setBusy(false); }
  };

  const openDetail = async (id: string) => {
    try {
      const res: any = await financialDocumentsApi.getPayment(id);
      setDetail(res.data || res);
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load payment.'); }
  };

  return (
    <div>
      <PageHeader title="Payments" subtitle={`${total} payment${total !== 1 ? 's' : ''}`} />

      <Card style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select style={{ ...inputStyle, maxWidth: 190 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); load(1, e.target.value); }}>
            <option value="">All statuses</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button style={ghostBtn} onClick={() => { setStatus(''); setPage(1); load(1, ''); }}><i className="fa fa-times"></i> Clear</button>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={() => load()} />}

      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No payments recorded." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: C.light, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Payment</th>
                <th style={{ padding: '8px 10px' }}>Invoice</th>
                <th style={{ padding: '8px 10px' }}>Customer</th>
                <th style={{ padding: '8px 10px' }}>Method</th>
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{p.paymentNumber || p.id.slice(0, 8)}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{p.invoice?.invoiceNumber || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{p.customer?.name || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{p.method ? p.method.replace(/_/g, ' ') : '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{formatDate(p.paymentDate)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(p.amount, p.currency)}</td>
                  <td style={{ padding: '10px' }}><StatusBadge status={p.status} /></td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button title="View" style={iconBtn} onClick={() => openDetail(p.id)}><i className="fa fa-eye"></i></button>
                      {!['REVERSED'].includes(p.status) && (
                        <button title="Update status" style={iconBtn} onClick={() => setStatusModal({ payment: p, status: 'CONFIRMED', reason: '' })}><i className="fa fa-edit"></i></button>
                      )}
                      <button title="Delete" style={{ ...iconBtn, color: '#dc2626' }} onClick={() => setConfirmAction({ label: 'Delete this payment? This may require re-issuing the invoice balance.', run: () => financialDocumentsApi.deletePayment(p.id) })}><i className="fa fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pageCount > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${C.border}` }}>
            <button style={ghostBtn} disabled={page <= 1 || loading} onClick={() => { setPage(page - 1); load(page - 1); }}><i className="fa fa-chevron-left"></i></button>
            <span style={{ fontSize: '13px', color: C.muted }}>Page {page} of {pageCount}</span>
            <button style={ghostBtn} disabled={page >= pageCount || loading} onClick={() => { setPage(page + 1); load(page + 1); }}><i className="fa fa-chevron-right"></i></button>
          </div>
        )}
      </Card>

      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Update Payment Status" width={460}>
        {statusModal && (
          <div>
            <p style={{ fontSize: '13px', color: C.muted, marginTop: 0 }}>{statusModal.payment.paymentNumber} · {formatMoney(statusModal.payment.amount, statusModal.payment.currency)}</p>
            <Field label="Status">
              <select style={inputStyle} value={statusModal.status} onChange={(e) => setStatusModal({ ...statusModal, status: e.target.value })}>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Reason (optional)"><input style={inputStyle} value={statusModal.reason} onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })} /></Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button style={ghostBtn} onClick={() => setStatusModal(null)}>Cancel</button>
              <button style={primaryBtn} disabled={busy} onClick={() => run(() => financialDocumentsApi.updatePaymentStatus(statusModal.payment.id, statusModal.status, statusModal.reason || undefined), 'Payment status updated.')}>
                {busy ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Payment ${detail?.paymentNumber || ''}`.trim() || 'Payment'} width={520}>
        {detail && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
            <div><div style={{ fontSize: '12px', color: C.light }}>Status</div><div><StatusBadge status={detail.status} /></div></div>
            <div><div style={{ fontSize: '12px', color: C.light }}>Amount</div><div style={{ fontWeight: 700 }}>{formatMoney(detail.amount, detail.currency)}</div></div>
            <div><div style={{ fontSize: '12px', color: C.light }}>Invoice</div><div style={{ fontWeight: 600 }}>{detail.invoice?.invoiceNumber || '—'}</div></div>
            <div><div style={{ fontSize: '12px', color: C.light }}>Method</div><div style={{ fontWeight: 600 }}>{detail.method ? detail.method.replace(/_/g, ' ') : '—'}</div></div>
            <div><div style={{ fontSize: '12px', color: C.light }}>Date</div><div style={{ fontWeight: 600 }}>{formatDate(detail.paymentDate)}</div></div>
            <div><div style={{ fontSize: '12px', color: C.light }}>Reference</div><div style={{ fontWeight: 600 }}>{detail.transactionReference || detail.bankReference || '—'}</div></div>
            {detail.notes && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: '12px', color: C.light }}>Notes</div><div style={{ fontWeight: 600 }}>{detail.notes}</div></div>}
          </div>
        )}
      </Modal>

      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title="Confirm" width={420}>
        <p style={{ fontSize: '14px', color: C.text }}>{confirmAction?.label}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button style={ghostBtn} onClick={() => setConfirmAction(null)}>Cancel</button>
          <button style={dangerBtn} disabled={busy} onClick={() => confirmAction && run(confirmAction.run, 'Done.')}>{busy ? 'Working…' : 'Confirm'}</button>
        </div>
      </Modal>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: '30px', height: '30px', border: `1px solid ${C.border}`, background: '#fff',
  borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: C.muted,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};