'use client';

import { useEffect, useState, useCallback } from 'react';
import { financialDocumentsApi } from '@/lib/api';
import {
  Card, PageHeader, Loading, Empty, ErrorBox, StatusBadge, Modal, Field,
  inputStyle, primaryBtn, ghostBtn, dangerBtn,
  formatMoney, formatDate, C, INVOICE_STATUSES, PAYMENT_METHODS, CURRENCIES,
} from '../_shared';

interface ItemRow {
  id?: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

interface Invoice {
  id: string;
  invoiceNumber?: string;
  status: string;
  effectiveStatus?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  orderReference?: string;
  purchaseReference?: string;
  notes?: string;
  customer?: any;
  items?: any[];
  payments?: any[];
  receipts?: any[];
  taxConfig?: any;
  bankAccount?: any;
  quotation?: any;
  createdAt?: string;
}

const emptyForm = () => ({
  customerId: '',
  invoiceDate: '',
  dueDate: '',
  currency: 'ZMW',
  orderReference: '',
  purchaseReference: '',
  taxConfigurationId: '',
  bankAccountId: '',
  paymentTerms: '',
  notes: '',
  items: [] as ItemRow[],
});

const emptyItem = (): ItemRow => ({ itemName: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 });

export default function InvoicesPage() {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [customers, setCustomers] = useState<any[]>([]);
  const [taxConfigs, setTaxConfigs] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [payModal, setPayModal] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; run: () => Promise<any>; note?: string } | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [payForm, setPayForm] = useState({ amount: 0, paymentDate: '', method: 'BANK_TRANSFER', transactionReference: '', bankReference: '', notes: '' });

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async (p = page, s = search, st = status) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page: p, pageSize };
      if (s) params.search = s;
      if (st) params.status = st;
      const res: any = await financialDocumentsApi.listInvoices(params);
      const data = res.data || res;
      setRows(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const loadOptions = useCallback(async () => {
    try {
      const [cRes, tRes, bRes] = await Promise.all([
        financialDocumentsApi.listCustomers({ pageSize: 100 }),
        financialDocumentsApi.listTaxConfigs(),
        financialDocumentsApi.listBankAccounts(),
      ]);
      setCustomers((cRes as any).data?.items || (cRes as any).data || []);
      setTaxConfigs((tRes as any).data || []);
      setBankAccounts((bRes as any).data || []);
    } catch { /* options are optional */ }
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  const run = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      setConfirmAction(null);
      setNewOpen(false);
      setPayModal(null);
      setDetail(null);
      // eslint-disable-next-line no-alert
      window.alert(okMsg);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => {
    setForm(emptyForm());
    setNewOpen(true);
  };

  const openDetail = async (id: string) => {
    setError(null);
    try {
      const res: any = await financialDocumentsApi.getInvoice(id);
      setDetail(res.data || res);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load invoice.');
    }
  };

  const submitForm = async () => {
    if (!form.customerId) { setError('Select a customer.'); return; }
    if (!form.items.length) { setError('Add at least one line item.'); return; }
    if (form.items.some((it) => !it.itemName || it.quantity <= 0 || it.unitPrice < 0)) { setError('Each line item needs a name, positive quantity and price.'); return; }
    const payload: any = {
      customerId: form.customerId,
      currency: form.currency,
      invoiceDate: form.invoiceDate || undefined,
      dueDate: form.dueDate || undefined,
      orderReference: form.orderReference || undefined,
      purchaseReference: form.purchaseReference || undefined,
      paymentTerms: form.paymentTerms || undefined,
      notes: form.notes || undefined,
      items: form.items.map((it) => ({
        itemName: it.itemName, description: it.description || undefined, unit: it.unit || undefined,
        quantity: Number(it.quantity), unitPrice: Number(it.unitPrice),
        discount: it.discount ? Number(it.discount) : undefined, taxRate: it.taxRate ? Number(it.taxRate) : undefined,
      })),
    };
    if (form.taxConfigurationId) payload.taxConfigurationId = form.taxConfigurationId;
    if (form.bankAccountId) payload.bankAccountId = form.bankAccountId;
    await run(() => financialDocumentsApi.createInvoice(payload), 'Invoice created.');
  };

  const updateItem = (idx: number, key: keyof ItemRow, value: any) => {
    setForm((f) => {
      const items = f.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
      return { ...f, items };
    });
  };

  const itemTotals = (it: ItemRow) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    const disc = Number(it.discount) || 0;
    const rate = Number(it.taxRate) || 0;
    const line = qty * price;
    const discounted = line - disc;
    const tax = discounted * (rate / 100);
    return { line, discounted, tax, total: discounted + tax };
  };

  const grandTotal = form.items.reduce((acc, it) => acc + itemTotals(it).total, 0);

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${total} invoice${total !== 1 ? 's' : ''}`}
        actions={
          <button style={primaryBtn} onClick={openNew}><i className="fa fa-plus"></i> New Invoice</button>
        }
      />

      <Card style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, maxWidth: 260 }}
            placeholder="Search invoice no., reference, customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1, search, status); } }}
          />
          <select style={{ ...inputStyle, maxWidth: 190 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); load(1, search, e.target.value); }}>
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button style={ghostBtn} onClick={() => { setPage(1); load(1, search, status); }}><i className="fa fa-search"></i> Apply</button>
          <button style={{ ...ghostBtn, marginLeft: 'auto' }} onClick={() => { setSearch(''); setStatus(''); setPage(1); load(1, '', ''); }}><i className="fa fa-times"></i> Clear</button>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={() => load()} />}

      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No invoices found." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: C.light, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Invoice</th>
                <th style={{ padding: '8px 10px' }}>Customer</th>
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px' }}>Due</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const st = inv.effectiveStatus || inv.status;
                const canEdit = inv.status === 'DRAFT';
                const canIssue = inv.status === 'DRAFT';
                const canSend = ['ISSUED'].includes(inv.status);
                const canCancel = ['DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID'].includes(inv.status);
                const canVoid = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'].includes(inv.status);
                return (
                  <tr key={inv.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{inv.invoiceNumber || '(draft)'}</td>
                    <td style={{ padding: '10px', color: C.muted }}>{inv.customer?.name || '—'}</td>
                    <td style={{ padding: '10px', color: C.muted }}>{formatDate(inv.invoiceDate)}</td>
                    <td style={{ padding: '10px', color: C.muted }}>{formatDate(inv.dueDate)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(inv.totalAmount, inv.currency)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: Number(inv.balanceDue) > 0 ? '#dc2626' : '#059669' }}>{formatMoney(inv.balanceDue, inv.currency)}</td>
                    <td style={{ padding: '10px' }}><StatusBadge status={st} /></td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button title="View" style={iconBtn} onClick={() => openDetail(inv.id)}><i className="fa fa-eye"></i></button>
                        {canEdit && <button title="Delete draft" style={{ ...iconBtn, color: '#dc2626' }} onClick={() => setConfirmAction({ label: 'Delete this draft invoice?', run: () => financialDocumentsApi.deleteInvoice(inv.id) })}><i className="fa fa-trash"></i></button>}
                        {canIssue && <button title="Issue" style={iconBtn} onClick={() => setConfirmAction({ label: 'Issue this invoice?', run: () => financialDocumentsApi.issueInvoice(inv.id) })}><i className="fa fa-bolt"></i></button>}
                        {canSend && <button title="Mark sent" style={iconBtn} onClick={() => setConfirmAction({ label: 'Mark this invoice as sent?', run: () => financialDocumentsApi.sendInvoice(inv.id) })}><i className="fa fa-paper-plane"></i></button>}
                        {(canCancel || canVoid) && <button title="Cancel / Void" style={iconBtn} onClick={() => {
                          const q = canCancel ? 'Cancel this invoice?' : 'Void this invoice?';
                          const fn = canCancel ? () => financialDocumentsApi.cancelInvoice(inv.id, 'Cancelled from platform') : () => financialDocumentsApi.voidInvoice(inv.id, 'Voided from platform');
                          setConfirmAction({ label: q, run: fn });
                        }}><i className="fa fa-ban"></i></button>}
                        {['SENT', 'ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status) && <button title="Record payment" style={iconBtn} onClick={() => { setPayForm({ amount: 0, paymentDate: '', method: 'BANK_TRANSFER', transactionReference: '', bankReference: '', notes: '' }); setPayModal({ invoice: inv }); }}><i className="fa fa-hand-holding-usd"></i></button>}
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

      {/* New invoice modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New Invoice" width={860}>
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
          <Field label="Invoice date"><input type="date" style={inputStyle} value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></Field>
          <Field label="Due date"><input type="date" style={inputStyle} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Order reference"><input style={inputStyle} value={form.orderReference} onChange={(e) => setForm({ ...form, orderReference: e.target.value })} /></Field>
          <Field label="Purchase reference"><input style={inputStyle} value={form.purchaseReference} onChange={(e) => setForm({ ...form, purchaseReference: e.target.value })} /></Field>
          <Field label="Tax configuration">
            <select style={inputStyle} value={form.taxConfigurationId} onChange={(e) => setForm({ ...form, taxConfigurationId: e.target.value })}>
              <option value="">Use default</option>
              {taxConfigs.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.taxRate}%)</option>)}
            </select>
          </Field>
          <Field label="Bank account">
            <select style={inputStyle} value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
              <option value="">Use default</option>
              {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber}</option>)}
            </select>
          </Field>
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
          <button style={primaryBtn} disabled={busy} onClick={submitForm}>{busy ? 'Saving…' : 'Create Invoice'}</button>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Invoice ${detail?.invoiceNumber || ''}`.trim() || 'Invoice'} width={820}>
        {detail && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <StatusBadge status={detail.effectiveStatus || detail.status} />
              <a href={financialDocumentsApi.invoicePdfUrl(detail.id)} target="_blank" rel="noreferrer" style={{ ...primaryBtn, textDecoration: 'none' }}>
                <i className="fa fa-file-pdf"></i> View PDF
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '14px' }}>
              <DetailItem label="Customer" value={`${detail.customer?.name || ''}${detail.customer?.email ? ` · ${detail.customer.email}` : ''}`} />
              <DetailItem label="Invoice date" value={formatDate(detail.invoiceDate)} />
              <DetailItem label="Due date" value={formatDate(detail.dueDate)} />
              <DetailItem label="Currency" value={detail.currency || 'ZMW'} />
              <DetailItem label="Order reference" value={detail.orderReference} />
              <DetailItem label="Purchase reference" value={detail.purchaseReference} />
              <DetailItem label="Tax configuration" value={detail.taxConfig ? `${detail.taxConfig.name} (${detail.taxConfig.taxRate}%)` : '—'} />
              <DetailItem label="Bank account" value={detail.bankAccount ? `${detail.bankAccount.bankName} ${detail.bankAccount.accountNumber || ''}` : '—'} />
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
                    <td style={{ padding: '10px' }}><div style={{ fontWeight: 600 }}>{it.itemName}</div>{it.description && <div style={{ fontSize: '12px', color: C.light }}>{it.description}</div>}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{it.quantity}{it.unit ? ` ${it.unit}` : ''}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(it.unitPrice)}</td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>{it.taxRate ? `${it.taxRate}%` : '—'}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(it.lineAmount ?? it.totalAmount ?? (it.unitPrice * it.quantity), detail.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '13px', lineHeight: 1.9 }}>
              <div>Subtotal: <strong>{formatMoney(detail.subtotal, detail.currency)}</strong></div>
              {Number(detail.taxAmount) > 0 && <div>Tax: <strong>{formatMoney(detail.taxAmount, detail.currency)}</strong></div>}
              <div style={{ fontSize: '16px' }}>Total: <strong>{formatMoney(detail.totalAmount, detail.currency)}</strong></div>
              <div style={{ color: Number(detail.balanceDue) > 0 ? '#dc2626' : '#059669' }}>Balance due: <strong>{formatMoney(detail.balanceDue, detail.currency)}</strong></div>
            </div>

            {(detail.payments && detail.payments.length > 0) && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Payments</div>
                {detail.payments.map((p: any) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                    <span>{p.paymentNumber || p.id.slice(0, 8)} · {p.method || '—'}{p.transactionReference ? ` · ${p.transactionReference}` : ''}</span>
                    <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <strong>{formatMoney(p.amount, detail.currency)}</strong>
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              {['SENT', 'ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(detail.status) && (
                <button style={primaryBtn} onClick={() => { setPayForm({ amount: Number(detail.balanceDue) || 0, paymentDate: '', method: 'BANK_TRANSFER', transactionReference: '', bankReference: '', notes: '' }); setPayModal({ invoice: detail }); }}>
                  <i className="fa fa-hand-holding-usd"></i> Record payment
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Record payment modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Payment">
        {payModal && (
          <div>
            <p style={{ fontSize: '13px', color: C.muted, marginTop: 0 }}>Invoice {payModal.invoice.invoiceNumber} · Outstanding {formatMoney(payModal.invoice.balanceDue, payModal.invoice.currency)}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Amount *"><input type="number" style={inputStyle} value={payForm.amount} min={0} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
              <Field label="Payment date"><input type="date" style={inputStyle} value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} /></Field>
              <Field label="Method">
                <select style={inputStyle} value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <Field label="Transaction reference"><input style={inputStyle} value={payForm.transactionReference} onChange={(e) => setPayForm({ ...payForm, transactionReference: e.target.value })} /></Field>
              <Field label="Bank reference"><input style={inputStyle} value={payForm.bankReference} onChange={(e) => setPayForm({ ...payForm, bankReference: e.target.value })} /></Field>
              <Field label="Notes"><input style={inputStyle} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button style={ghostBtn} onClick={() => setPayModal(null)}>Cancel</button>
              <button style={primaryBtn} disabled={busy || !payForm.amount} onClick={() => run(
                () => financialDocumentsApi.recordPayment(payModal.invoice.id, {
                  amount: Number(payForm.amount),
                  paymentDate: payForm.paymentDate || undefined,
                  method: payForm.method,
                  transactionReference: payForm.transactionReference || undefined,
                  bankReference: payForm.bankReference || undefined,
                  notes: payForm.notes || undefined,
                }),
                'Payment recorded.'
              )}>{busy ? 'Saving…' : 'Record Payment'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm modal */}
      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title="Confirm" width={420}>
        <p style={{ fontSize: '14px', color: C.text }}>{confirmAction?.label}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button style={ghostBtn} onClick={() => setConfirmAction(null)}>Cancel</button>
          <button style={dangerBtn} disabled={busy} onClick={() => confirmAction && run(confirmAction.run, 'Done.')}>
            {busy ? 'Working…' : 'Confirm'}
          </button>
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

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: C.light, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value || '—'}</div>
    </div>
  );
}