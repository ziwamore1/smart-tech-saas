'use client';

import { useEffect, useState, useCallback } from 'react';
import { financialDocumentsApi } from '@/lib/api';
import {
  Card, PageHeader, Loading, Empty, ErrorBox, StatusBadge, Modal, Field,
  inputStyle, primaryBtn, ghostBtn, dangerBtn,
  formatMoney, formatDate, C,
} from '../_shared';

interface Receipt { id: string; receiptNumber?: string; status: string; receiptDate?: string; amountReceived?: number; currency?: string; customer?: any; payment?: any; invoice?: any; createdAt?: string }

export default function ReceiptsPage() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedPayment, setSelectedPayment] = useState('');
  const [detail, setDetail] = useState<Receipt | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; run: () => Promise<any> } | null>(null);
  const [reason, setReason] = useState('');

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async (p = page, st = status) => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = { page: p, pageSize };
      if (st) params.status = st;
      const res: any = await financialDocumentsApi.listReceipts(params);
      const data = res.data || res;
      setRows(data.items || []); setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load receipts.');
    } finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const loadPayments = async () => {
    try {
      const res: any = await financialDocumentsApi.listPayments({ pageSize: 100 });
      const data = res.data || res;
      setPayments((data.items || []).filter((p: any) => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CONFIRMED'].includes(p.status)));
      setSelectedPayment('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load payments.');
    }
  };

  const openIssue = () => { loadPayments(); setIssueOpen(true); };

  const run = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true); setError(null);
    try {
      await fn(); await load();
      setIssueOpen(false); setConfirmAction(null); setDetail(null); setReason('');
      window.alert(okMsg);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Operation failed.');
    } finally { setBusy(false); }
  };

  const openDetail = async (id: string) => {
    try {
      const res: any = await financialDocumentsApi.getReceipt(id);
      setDetail(res.data || res);
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load receipt.'); }
  };

  return (
    <div>
      <PageHeader title="Receipts" subtitle={`${total} receipt${total !== 1 ? 's' : ''}`} actions={
        <button style={primaryBtn} onClick={openIssue}><i className="fa fa-plus"></i> Issue Receipt</button>
      } />

      <Card style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select style={{ ...inputStyle, maxWidth: 190 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); load(1, e.target.value); }}>
            <option value="">All statuses</option>
            <option value="ISSUED">Issued</option>
            <option value="VOID">Void</option>
          </select>
          <button style={ghostBtn} onClick={() => { setStatus(''); setPage(1); load(1, ''); }}><i className="fa fa-times"></i> Clear</button>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={() => load()} />}

      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No receipts issued yet." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: C.light, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Receipt</th>
                <th style={{ padding: '8px 10px' }}>Customer</th>
                <th style={{ padding: '8px 10px' }}>Payment</th>
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{r.receiptNumber || r.id.slice(0, 8)}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.customer?.name || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.payment?.paymentNumber || (r.invoice?.invoiceNumber ? `Inv ${r.invoice.invoiceNumber}` : '—')}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{formatDate(r.receiptDate)}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(r.amountReceived, r.currency)}</td>
                  <td style={{ padding: '10px' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button title="View" style={iconBtn} onClick={() => openDetail(r.id)}><i className="fa fa-eye"></i></button>
                      <a title="PDF" href={financialDocumentsApi.receiptPdfUrl(r.id)} target="_blank" rel="noreferrer" style={{ ...iconBtn, textDecoration: 'none' }}><i className="fa fa-file-pdf"></i></a>
                      {r.status === 'ISSUED' && <button title="Void" style={{ ...iconBtn, color: '#dc2626' }} onClick={() => { setReason(''); setConfirmAction({ label: 'Void this receipt?', run: () => financialDocumentsApi.voidReceipt(r.id, reason || 'Voided from platform') }); }}><i className="fa fa-ban"></i></button>}
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

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Issue Receipt" width={520}>
        <Field label="Payment *" hint="Receipts are issued against a recorded payment. A receipt can only be issued once per payment.">
          <select style={inputStyle} value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value)}>
            <option value="">Select payment…</option>
            {payments.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.paymentNumber || p.id.slice(0, 8)} · {p.customer?.name || '—'} · {formatMoney(p.amount, p.currency)} · {p.method || p.status}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button style={ghostBtn} onClick={() => setIssueOpen(false)}>Cancel</button>
          <button style={primaryBtn} disabled={busy || !selectedPayment} onClick={() => run(() => financialDocumentsApi.issueReceipt(selectedPayment), 'Receipt issued.')}>
            {busy ? 'Issuing…' : 'Issue Receipt'}
          </button>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Receipt ${detail?.receiptNumber || ''}`.trim() || 'Receipt'} width={560}>
        {detail && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <StatusBadge status={detail.status} />
              <a href={financialDocumentsApi.receiptPdfUrl(detail.id)} target="_blank" rel="noreferrer" style={{ ...primaryBtn, textDecoration: 'none' }}><i className="fa fa-file-pdf"></i> View PDF</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
              <div><div style={{ fontSize: '12px', color: C.light }}>Customer</div><div style={{ fontWeight: 600 }}>{detail.customer?.name || '—'}</div></div>
              <div><div style={{ fontSize: '12px', color: C.light }}>Date</div><div style={{ fontWeight: 600 }}>{formatDate(detail.receiptDate)}</div></div>
              <div><div style={{ fontSize: '12px', color: C.light }}>Payment</div><div style={{ fontWeight: 600 }}>{detail.payment?.paymentNumber || (detail.invoice?.invoiceNumber || '—')}</div></div>
              <div><div style={{ fontSize: '12px', color: C.light }}>Amount</div><div style={{ fontWeight: 700, fontSize: '15px' }}>{formatMoney(detail.amountReceived, detail.currency)}</div></div>
            </div>
            {detail.status === 'ISSUED' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button style={dangerBtn} onClick={() => { setDetail(null); setReason(''); setConfirmAction({ label: 'Void this receipt?', run: () => financialDocumentsApi.voidReceipt(detail.id, reason || 'Voided from platform') }); }}>
                  <i className="fa fa-ban"></i> Void Receipt
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title="Confirm" width={420}>
        <p style={{ fontSize: '14px', color: C.text }}>{confirmAction?.label}</p>
        <Field label="Reason (optional)"><input style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
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