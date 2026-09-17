'use client';

import { useEffect, useState, useCallback } from 'react';
import { financialDocumentsApi } from '@/lib/api';
import {
  Card, PageHeader, Loading, Empty, ErrorBox, StatusBadge, Modal, Field,
  inputStyle, primaryBtn, ghostBtn, dangerBtn, C, CUSTOMER_TYPES,
} from '../_shared';

interface Customer { id: string; name?: string; legalName?: string; customerType?: string; email?: string; phone?: string; city?: string; country?: string; isActive?: boolean; createdAt?: string }

const emptyForm = () => ({ name: '', legalName: '', customerType: 'CORPORATE', email: '', phone: '', city: '', province: '', country: '', postalAddress: '', address: '', contactPerson: '', billingContact: '', customerReference: '', taxInformation: '', notes: '', isActive: true });

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string; form: ReturnType<typeof emptyForm> } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; run: () => Promise<any> } | null>(null);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, any> = { page: p, pageSize };
      if (s) params.search = s;
      const res: any = await financialDocumentsApi.listCustomers(params);
      const data = res.data || res;
      setRows(data.items || []); setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load customers.');
    } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true); setError(null);
    try {
      await fn(); await load();
      setModal(null); setConfirmAction(null);
      window.alert(okMsg);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Operation failed.');
    } finally { setBusy(false); }
  };

  const openEdit = async (c: Customer) => {
    try {
      const res: any = await financialDocumentsApi.getCustomer(c.id);
      const d = res.data || res;
      setModal({
        mode: 'edit', id: c.id,
        form: {
          name: d.name || '', legalName: d.legalName || '', customerType: d.customerType || 'CORPORATE',
          email: d.email || '', phone: d.phone || '', city: d.city || '', province: d.province || '',
          country: d.country || '', postalAddress: d.postalAddress || '', address: d.address || '',
          contactPerson: d.contactPerson || '', billingContact: d.billingContact || '',
          customerReference: d.customerReference || '', taxInformation: d.taxInformation || '',
          notes: d.notes || '', isActive: d.isActive !== false,
        },
      });
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load customer.'); }
  };

  const submit = async () => {
    if (!modal) return;
    if (!modal.form.name && !modal.form.legalName) { setError('Enter a customer name.'); return; }
    const payload = { ...modal.form, customerType: modal.form.customerType || 'OTHER' };
    if (modal.mode === 'create') await run(() => financialDocumentsApi.createCustomer(payload), 'Customer created.');
    else if (modal.id) await run(() => financialDocumentsApi.updateCustomer(modal.id, payload), 'Customer updated.');
  };

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${total} customer${total !== 1 ? 's' : ''}`} actions={
        <button style={primaryBtn} onClick={() => setModal({ mode: 'create', form: emptyForm() })}><i className="fa fa-plus"></i> Add Customer</button>
      } />

      <Card style={{ marginBottom: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, maxWidth: 260 }} placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1, search); } }} />
          <button style={ghostBtn} onClick={() => { setPage(1); load(1, search); }}><i className="fa fa-search"></i> Apply</button>
        </div>
      </Card>

      {error && <ErrorBox message={error} onRetry={() => load()} />}

      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <Empty text="No customers yet." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: C.light, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>Name</th>
                <th style={{ padding: '8px 10px' }}>Type</th>
                <th style={{ padding: '8px 10px' }}>Email</th>
                <th style={{ padding: '8px 10px' }}>Phone</th>
                <th style={{ padding: '8px 10px' }}>Location</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{c.name || c.legalName || c.id.slice(0, 8)}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{c.customerType ? c.customerType.replace(/_/g, ' ') : '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{c.email || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{c.phone || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
                  <td style={{ padding: '10px' }}><StatusBadge status={c.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button title="Edit" style={iconBtn} onClick={() => openEdit(c)}><i className="fa fa-edit"></i></button>
                      <button title="Delete" style={{ ...iconBtn, color: '#dc2626' }} onClick={() => setConfirmAction({ label: `Delete customer "${c.name || c.legalName}"?`, run: () => financialDocumentsApi.deleteCustomer(c.id) })}><i className="fa fa-trash"></i></button>
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

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Add Customer' : 'Edit Customer'} width={720}>
        {modal && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <Field label="Name *"><input style={inputStyle} value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} /></Field>
              <Field label="Legal name"><input style={inputStyle} value={modal.form.legalName} onChange={(e) => setModal({ ...modal, form: { ...modal.form, legalName: e.target.value } })} /></Field>
              <Field label="Type">
                <select style={inputStyle} value={modal.form.customerType} onChange={(e) => setModal({ ...modal, form: { ...modal.form, customerType: e.target.value } })}>
                  {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <Field label="Customer reference"><input style={inputStyle} value={modal.form.customerReference} onChange={(e) => setModal({ ...modal, form: { ...modal.form, customerReference: e.target.value } })} /></Field>
              <Field label="Email"><input style={inputStyle} value={modal.form.email} onChange={(e) => setModal({ ...modal, form: { ...modal.form, email: e.target.value } })} /></Field>
              <Field label="Phone"><input style={inputStyle} value={modal.form.phone} onChange={(e) => setModal({ ...modal, form: { ...modal.form, phone: e.target.value } })} /></Field>
              <Field label="Contact person"><input style={inputStyle} value={modal.form.contactPerson} onChange={(e) => setModal({ ...modal, form: { ...modal.form, contactPerson: e.target.value } })} /></Field>
              <Field label="Billing contact"><input style={inputStyle} value={modal.form.billingContact} onChange={(e) => setModal({ ...modal, form: { ...modal.form, billingContact: e.target.value } })} /></Field>
              <Field label="Address"><input style={inputStyle} value={modal.form.address} onChange={(e) => setModal({ ...modal, form: { ...modal.form, address: e.target.value } })} /></Field>
              <Field label="Postal address"><input style={inputStyle} value={modal.form.postalAddress} onChange={(e) => setModal({ ...modal, form: { ...modal.form, postalAddress: e.target.value } })} /></Field>
              <Field label="City"><input style={inputStyle} value={modal.form.city} onChange={(e) => setModal({ ...modal, form: { ...modal.form, city: e.target.value } })} /></Field>
              <Field label="Province"><input style={inputStyle} value={modal.form.province} onChange={(e) => setModal({ ...modal, form: { ...modal.form, province: e.target.value } })} /></Field>
              <Field label="Country"><input style={inputStyle} value={modal.form.country} onChange={(e) => setModal({ ...modal, form: { ...modal.form, country: e.target.value } })} /></Field>
              <Field label="Tax information"><input style={inputStyle} value={modal.form.taxInformation} onChange={(e) => setModal({ ...modal, form: { ...modal.form, taxInformation: e.target.value } })} /></Field>
            </div>
            <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={modal.form.notes} onChange={(e) => setModal({ ...modal, form: { ...modal.form, notes: e.target.value } })} /></Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: C.text, marginBottom: '14px' }}>
              <input type="checkbox" checked={modal.form.isActive} onChange={(e) => setModal({ ...modal, form: { ...modal.form, isActive: e.target.checked } })} />
              Active customer
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button style={ghostBtn} onClick={() => setModal(null)}>Cancel</button>
              <button style={primaryBtn} disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
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