'use client';

import { useEffect, useState, useCallback } from 'react';
import { financialDocumentsApi } from '@/lib/api';
import {
  Card, PageHeader, Loading, Empty, ErrorBox, StatusBadge, Modal, Field,
  inputStyle, primaryBtn, ghostBtn, dangerBtn,
  formatMoney, formatDate, C, QUOTATION_STATUSES, CURRENCIES,
} from '../_shared';

interface ItemRow { itemName: string; description?: string; quantity: number; unit?: string; unitPrice: number; discount?: number; taxRate?: number }
interface Quotation { id: string; quotationNumber?: string; status: string; effectiveStatus?: string; quotationDate?: string; validUntil?: string; currency?: string; subtotal?: number; taxAmount?: number; totalAmount?: number; customer?: any; items?: any[]; payments?: any[]; invoice?: any; quotationValidity?: string; paymentTerms?: string; notes?: string; createdAt?: string }

const emptyForm = () => ({ customerId: '', quotationDate: '', validUntil: '', currency: 'ZMW', reference: '', customerReference: '', paymentTerms: '', notes: '', items: [] as ItemRow[] });
const emptyItem = (): ItemRow => ({ itemName: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 });

export default function QuotationsPage() {
  const [rows, setRows] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<Quotation | null>(null);
  const [convertDue, setConvertDue] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ label: string; run: () => Promise<any> } | null>(null);
  const [detail, setDetail] = useState<Quotation | null>(null);
  const [form, setForm] = useState(emptyForm());

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async (p = page, s = search, st = status) => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = { page: p, pageSize };
      if (s) params.search = s;
      if (st) params.status = st;
      const res: any = await financialDocumentsApi.listQuotations(params);
      const data = res.data || res;
      setRows(data.items || []); setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load quotations.');
    } finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    financialDocumentsApi.listCustomers({ pageSize: 100 })
      .then((res: any) => setCustomers(res.data?.items || res.data || []))
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true); setError(null);
    try {
      await fn(); await load();
      setConfirmAction(null); setNewOpen(false); setDetail(null); setConvertTarget(null); setPayModal(null);
      window.alert(okMsg);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Operation failed.');
    } finally { setBusy(false); }
  };

  const openDetail = async (id: string) => {
    try {
      const res: any = await financialDocumentsApi.getQuotation(id);
      setDetail(res.data || res);
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load quotation.'); }
  };

  const submitForm = async () => {
    if (!form.customerId) { setError('Select a customer.'); return; }
    if (!form.items.length) { setError('Add at least one line item.'); return; }
    if (form.items.some((it) => !it.itemName || it.quantity <= 0 || it.unitPrice < 0)) { setError('Each line item needs a name, positive quantity and price.'); return; }
    await run(() => financialDocumentsApi.createQuotation({
      customerId: form.customerId,
      currency: form.currency,
      quotationDate: form.quotationDate || undefined,
      validUntil: form.validUntil || undefined,
      reference: form.reference || undefined,
      customerReference: form.customerReference || undefined,
      paymentTerms: form.paymentTerms || undefined,
      notes: form.notes || undefined,
      items: form.items.map((it) => ({
        itemName: it.itemName, description: it.description || undefined, unit: it.unit || undefined,
        quantity: Number(it.quantity), unitPrice: Number(it.unitPrice),
        discount: it.discount ? Number(it.discount) : undefined, taxRate: it.taxRate ? Number(it.taxRate) : undefined,
      })),
    }), 'Quotation created.');
  };

  const updateItem = (idx: number, key: keyof ItemRow, value: any) => setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)) }));

  const itemTotals = (it: ItemRow) => {
    const qty = Number(it.quantity) || 0, price = Number(it.unitPrice) || 0;
    const disc = Number(it.discount) || 0, rate = Number(it.taxRate) || 0;
    const line = qty * price, discounted = line - disc, tax = discounted * (rate / 100);
    return { line, discounted, tax, total: discounted + tax };
  };
  const grandTotal = form.items.reduce((acc, it) => acc + itemTotals(it).total, 0);

  return (
    <div>
      <PageHeader title="Quotations" subtitle={`${total} quotation${total !== 1 ? 's' : ''}`} actions={
        <button style={primaryBtn} onClick={() => { setForm(emptyForm()); setNewOpen(true); }}><i className="fa fa-plus"></i> New Quotation</button>
      } />

      <Card style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, maxWidth: 260 }} placeholder="Search number, reference, customer…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1, search, status); } }} />
          <select style={{ ...inputStyle, maxWidth: 190 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); load(1, search, e.target.value); }}>
            <option value="">All statuses</option>
            {QUOTATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button style={ghostBtn} onClick={() => { setPage(1); load(1, search, status); }}><i className="fa fa-search"></i> Apply</button>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={() => load()} />}

      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No quotations found." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: C.light, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Quotation</th>
                <th style={{ padding: '8px 10px' }}>Customer</th>
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px' }}>Valid until</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const st = q.effectiveStatus || q.status;
                const canConvert = ['SENT', 'ACCEPTED'].includes(q.status);
                const canIssue = q.status === 'DRAFT';
                const canSend = q.status === 'ISSUED';
                const canTransition = !['DRAFT', 'CANCELLED', 'CONVERTED_TO_INVOICE', 'EXPIRED', 'REJECTED'].includes(q.status);
                return (
                  <tr key={q.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{q.quotationNumber || '(draft)'}</td>
                    <td style={{ padding: '10px', color: C.muted }}>{q.customer?.name || '—'}</td>
                    <td style={{ padding: '10px', color: C.muted }}>{formatDate(q.quotationDate)}</td>
                    <td style={{ padding: '10px', color: C.muted }}>{formatDate(q.validUntil)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(q.totalAmount, q.currency)}</td>
                    <td style={{ padding: '10px' }}><StatusBadge status={st} /></td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button title="View" style={iconBtn} onClick={() => openDetail(q.id)}><i className="fa fa-eye"></i></button>
                        {q.status === 'DRAFT' && <button title="Delete draft" style={{ ...iconBtn, color: '#dc2626' }} onClick={() => setConfirmAction({ label: 'Delete this draft quotation?', run: () => financialDocumentsApi.deleteQuotation(q.id) })}><i className="fa fa-trash"></i></button>}
                        {canIssue && <button title="Issue" style={iconBtn} onClick={() => setConfirmAction({ label: 'Issue this quotation?', run: () => financialDocumentsApi.issueQuotation(q.id) })}><i className="fa fa-bolt"></i></button>}
                        {canSend && <button title="Mark sent" style={iconBtn} onClick={() => setConfirmAction({ label: 'Mark quotation as sent?', run: () => financialDocumentsApi.sendQuotation(q.id) })}><i className="fa fa-paper-plane"></i></button>}
                        {canConvert && <button title="Convert to invoice" style={iconBtn} onClick={() => { setConvertDue(''); setConvertTarget(q); }}><i className="fa fa-file-invoice"></i></button>}
                        {canTransition && <button title="Reject / Cancel" style={iconBtn} onClick={() => setConfirmAction({ label: 'Reject this quotation?', run: () => financialDocumentsApi.transitionQuotation(q.id, 'REJECTED', 'Rejected from platform') })}><i className="fa fa-ban"></i></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* New quotation */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Quotation" width={860}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Customer *">
            <select style={inputStyle} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select customer…</option>
              {customers.filter((c) => c.isActive !== false).map((c) => <option key={c.id} value={c.id}>{c.name || c.legalName}</option>)}
            </select>
          </Field>
          <Field label="Currency">
            <select style={inputStyle} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Quotation date"><input type="date" style={inputStyle} value={form.quotationDate} onChange={(e) => setForm({ ...form, quotationDate: e.target.value })} /></Field>
          <Field label="Valid until"><input type="date" style={inputStyle} value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
          <Field label="Reference"><input style={inputStyle} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          <Field label="Customer reference"><input style={inputStyle} value={form.customerReference} onChange={(e) => setForm({ ...form, customerReference: e.target.value })} /></Field>
        </div>
        <Field label="Payment terms"><input style={inputStyle} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
        <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

        <div style={{ fontSize: '14px', fontWeight: 700, margin: '8px 0 10px' }}>Line Items</div>
        {form.items.map((it, idx) => {
          const t = itemTotals(it);
          return (
            <div key={idx} style={{ border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input style={inputStyle} placeholder="Item name *" value={it.itemName} onChange={(e) => updateItem(idx, 'itemName', e.target.value)} />
                <input style={inputStyle} placeholder="Unit" value={it.unit || ''} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                <input style={inputStyle} type="number" placeholder="Qty *" value={it.quantity} min={0} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                <input style={inputStyle} type="number" placeholder="Unit price *" value={it.unitPrice} min={0} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '8px', alignItems: 'center' }}>
                <input style={inputStyle} placeholder="Description" value={it.description || ''} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                <input style={inputStyle} type="number" placeholder="Discount" value={it.discount || 0} min={0} onChange={(e) => updateItem(idx, 'discount', e.target.value)} />
                <input style={inputStyle} type="number" placeholder="Tax %" value={it.taxRate || 0} min={0} max={100} onChange={(e) => updateItem(idx, 'taxRate', e.target.value)} />
                <span style={{ fontSize: '12px', color: C.muted, whiteSpace: 'nowrap' }}>{formatMoney(t.total)}</span>
                <button style={{ ...iconBtn, color: '#dc2626' }} onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}><i className="fa fa-trash"></i></button>
              </div>
            </div>
          );
        })}
        <button style={ghostBtn} onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))}><i className="fa fa-plus"></i> Add item</button>
        <div style={{ textAlign: 'right', marginTop: '14px', fontSize: '16px', fontWeight: 700 }}>Total: {formatMoney(grandTotal, form.currency)}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
          <button style={ghostBtn} onClick={() => setNewOpen(false)}>Cancel</button>
          <button style={primaryBtn} disabled={busy} onClick={submitForm}>{busy ? 'Saving…' : 'Create Quotation'}</button>
        </div>
      </Modal>

      {/* Convert modal */}
      <Modal open={!!convertTarget} onClose={() => setConvertTarget(null)} title="Convert to Invoice" width={460}>
        <p style={{ fontSize: '13px', color: C.muted, marginTop: 0 }}>
          This will create an invoice from quotation {convertTarget?.quotationNumber} for <strong>{convertTarget?.customer?.name}</strong> ({formatMoney(convertTarget?.totalAmount, convertTarget?.currency)}). The quotation will be marked as converted.
        </p>
        <Field label="Invoice due date (optional)"><input type="date" style={inputStyle} value={convertDue} onChange={(e) => setConvertDue(e.target.value)} /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button style={ghostBtn} onClick={() => setConvertTarget(null)}>Cancel</button>
          <button style={primaryBtn} disabled={busy} onClick={() => convertTarget && run(
            () => financialDocumentsApi.convertQuotation(convertTarget.id, convertDue ? { dueDate: convertDue } : undefined),
            'Quotation converted to invoice.'
          )}>{busy ? 'Converting…' : 'Convert'}</button>
        </div>
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Quotation ${detail?.quotationNumber || ''}`.trim() || 'Quotation'} width={800}>
        {detail && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <StatusBadge status={detail.effectiveStatus || detail.status} />
              <a href={financialDocumentsApi.quotationPdfUrl(detail.id)} target="_blank" rel="noreferrer" style={{ ...primaryBtn, textDecoration: 'none' }}>
                <i className="fa fa-file-pdf"></i> View PDF
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '14px' }}>
              <div><div style={{ fontSize: '12px', color: C.light }}>Customer</div><div style={{ fontWeight: 600 }}>{detail.customer?.name || '—'}</div></div>
              <div><div style={{ fontSize: '12px', color: C.light }}>Quotation date</div><div style={{ fontWeight: 600 }}>{formatDate(detail.quotationDate)}</div></div>
              <div><div style={{ fontSize: '12px', color: C.light }}>Valid until</div><div style={{ fontWeight: 600 }}>{formatDate(detail.validUntil)}</div></div>
              <div><div style={{ fontSize: '12px', color: C.light }}>Currency</div><div style={{ fontWeight: 600 }}>{detail.currency || 'ZMW'}</div></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f5efe8', textAlign: 'left', color: C.muted }}>
                  <th style={{ padding: '8px 10px' }}>Item</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tax</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items || []).map((it: any, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px' }}>{it.itemName}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{it.quantity}{it.unit ? ` ${it.unit}` : ''}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(it.unitPrice)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{it.taxRate ? `${it.taxRate}%` : '—'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(it.lineAmount ?? it.totalAmount ?? (it.unitPrice * it.quantity), detail.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '13px' }}>
              <div>Subtotal: <strong>{formatMoney(detail.subtotal, detail.currency)}</strong></div>
              {Number(detail.taxAmount) > 0 && <div>Tax: <strong>{formatMoney(detail.taxAmount, detail.currency)}</strong></div>}
              <div style={{ fontSize: '16px' }}>Total: <strong>{formatMoney(detail.totalAmount, detail.currency)}</strong></div>
            </div>
            {detail.invoice && (
              <div style={{ marginTop: '14px', padding: '12px', background: '#f0fdf4', borderRadius: '10px', fontSize: '13px' }}>
                <i className="fa fa-check-circle" style={{ color: '#059669', marginRight: '8px' }}></i>
                Converted to <strong>{detail.invoice.invoiceNumber}</strong>
              </div>
            )}
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