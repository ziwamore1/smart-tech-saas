'use client';

import { useEffect, useState, useCallback } from 'react';
import { financialDocumentsApi } from '@/lib/api';
import {
  Card, PageHeader, Loading, ErrorBox, StatusBadge, Modal, Field,
  inputStyle, primaryBtn, ghostBtn, dangerBtn, formatDate, C,
  CURRENCIES, RESET_POLICIES, TAX_PRICING_MODES,
} from '../_shared';

type Tab = 'profile' | 'bank' | 'tax' | 'templates' | 'numbering';
const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'profile', label: 'Company Profile', icon: 'fa-building' },
  { key: 'bank', label: 'Bank Accounts', icon: 'fa-university' },
  { key: 'tax', label: 'Tax Configurations', icon: 'fa-percent' },
  { key: 'templates', label: 'Templates', icon: 'fa-file-alt' },
  { key: 'numbering', label: 'Numbering', icon: 'fa-hashtag' },
];

export default function FinancialSettingsPage() {
  return (
    <div>
      <PageHeader title="Financial Documents Settings" subtitle="Company identity, banking, tax, templates and document numbering" />
      <SettingsTabs />
    </div>
  );
}

function SettingsTabs() {
  const [tab, setTab] = useState<Tab>('profile');
  const [ready, setReady] = useState<{ ready: boolean; checks: any[] } | null>(null);

  useEffect(() => {
    financialDocumentsApi.readiness().then((res: any) => setReady(res.data || res)).catch(() => {});
  }, [tab]);

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 16px', borderRadius: '10px', border: `1px solid ${C.border}`, cursor: 'pointer',
            background: tab === t.key ? C.primary : '#fff', color: tab === t.key ? '#fff' : C.muted,
            fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}>
            <i className={`fa ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>

      {ready && !ready.ready && tab !== 'numbering' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {ready.checks.filter((c) => !c.ok).map((c) => (
            <span key={c.key} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '999px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              <i className="fa fa-circle-exclamation" style={{ marginRight: '6px' }}></i>{c.label}
            </span>
          ))}
        </div>
      )}

      {tab === 'profile' && <CompanyProfileTab />}
      {tab === 'bank' && <BankAccountsTab />}
      {tab === 'tax' && <TaxConfigsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'numbering' && <NumberingTab />}
    </div>
  );
}

// ─── Company profile ───────────────────────────────────────────────────────
function CompanyProfileTab() {
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res: any = await financialDocumentsApi.getCompanyProfile();
      const d = res.data || res || {};
      setForm({
        legalName: d.legalName || '', tradingName: d.tradingName || '', logoUrl: d.logoUrl || '',
        companyRegistrationNumber: d.companyRegistrationNumber || '', tpin: d.tpin || '', zraIdentityNumber: d.zraIdentityNumber || '',
        physicalAddress: d.physicalAddress || '', postalAddress: d.postalAddress || '', city: d.city || '',
        province: d.province || '', country: d.country || '', phone: d.phone || '', email: d.email || '', website: d.website || '',
        businessDescription: d.businessDescription || '', authorizedContactName: d.authorizedContactName || '',
        authorizedContactRole: d.authorizedContactRole || '', authorizedContactEmail: d.authorizedContactEmail || '',
        authorizedContactPhone: d.authorizedContactPhone || '', authorizedSignatoryName: d.authorizedSignatoryName || '',
        authorizedSignatoryRole: d.authorizedSignatoryRole || '', primaryColor: d.primaryColor || '#ea6645', secondaryColor: d.secondaryColor || '#f59e0b',
        watermarkText: d.watermarkText || '', defaultTerms: d.defaultTerms || '', defaultPaymentTerms: d.defaultPaymentTerms || '', defaultNotes: d.defaultNotes || '',
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load company profile.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await financialDocumentsApi.updateCompanyProfile(form);
      window.alert('Company profile saved.');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to save company profile.');
    } finally { setSaving(false); }
  };

  const upload = async (kind: 'logo' | 'signature' | 'stamp', file?: File) => {
    if (!file) return;
    setUploading(kind);
    try {
      const res: any = await financialDocumentsApi.uploadCompanyMedia(file, kind);
      const result = res.data || res;
      const url = result?.url || result?.[kind + 'Url'] || '';
      setForm((f: any) => ({ ...f, [kind + 'Url']: url }));
      window.alert(`${kind} uploaded.`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Upload failed.');
    } finally { setUploading(null); }
  };

  if (loading) return <Loading />;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Card>
      {error && <div style={{ marginBottom: '14px' }}><ErrorBox message={error} onRetry={load} /></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '6px' }}>
        {(['logo', 'signature', 'stamp'] as const).map((kind) => (
          <div key={kind} style={{ border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'capitalize', marginBottom: '10px' }}>{kind}</div>
            {form?.[kind + 'Url'] ? (
              <img src={form[kind + 'Url']} alt={kind} style={{ maxHeight: 70, maxWidth: '100%', objectFit: 'contain', marginBottom: '10px' }} />
            ) : (
              <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.light, fontSize: '28px', marginBottom: '6px' }}>
                <i className={`fa ${kind === 'logo' ? 'fa-image' : kind === 'signature' ? 'fa-pen' : 'fa-stamp'}`}></i>
              </div>
            )}
            <label style={{ ...ghostBtn, fontSize: '12px', padding: '8px 12px', cursor: 'pointer', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
              {uploading === kind ? 'Uploading…' : 'Upload'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => upload(kind, e.target.files?.[0])} />
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Field label="Legal name"><input style={inputStyle} value={form.legalName} onChange={(e) => set('legalName', e.target.value)} /></Field>
        <Field label="Trading name"><input style={inputStyle} value={form.tradingName} onChange={(e) => set('tradingName', e.target.value)} /></Field>
        <Field label="Company registration number"><input style={inputStyle} value={form.companyRegistrationNumber} onChange={(e) => set('companyRegistrationNumber', e.target.value)} /></Field>
        <Field label="TPIN"><input style={inputStyle} value={form.tpin} onChange={(e) => set('tpin', e.target.value)} /></Field>
        <Field label="ZRA identity number"><input style={inputStyle} value={form.zraIdentityNumber} onChange={(e) => set('zraIdentityNumber', e.target.value)} /></Field>
        <Field label="Business description"><input style={inputStyle} value={form.businessDescription} onChange={(e) => set('businessDescription', e.target.value)} /></Field>
        <Field label="Physical address"><input style={inputStyle} value={form.physicalAddress} onChange={(e) => set('physicalAddress', e.target.value)} /></Field>
        <Field label="Postal address"><input style={inputStyle} value={form.postalAddress} onChange={(e) => set('postalAddress', e.target.value)} /></Field>
        <Field label="City"><input style={inputStyle} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Province"><input style={inputStyle} value={form.province} onChange={(e) => set('province', e.target.value)} /></Field>
        <Field label="Country"><input style={inputStyle} value={form.country} onChange={(e) => set('country', e.target.value)} /></Field>
        <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Website"><input style={inputStyle} value={form.website} onChange={(e) => set('website', e.target.value)} /></Field>
        <Field label="Authorized contact name"><input style={inputStyle} value={form.authorizedContactName} onChange={(e) => set('authorizedContactName', e.target.value)} /></Field>
        <Field label="Authorized contact role"><input style={inputStyle} value={form.authorizedContactRole} onChange={(e) => set('authorizedContactRole', e.target.value)} /></Field>
        <Field label="Authorized contact email"><input style={inputStyle} value={form.authorizedContactEmail} onChange={(e) => set('authorizedContactEmail', e.target.value)} /></Field>
        <Field label="Authorized contact phone"><input style={inputStyle} value={form.authorizedContactPhone} onChange={(e) => set('authorizedContactPhone', e.target.value)} /></Field>
        <Field label="Authorized signatory name"><input style={inputStyle} value={form.authorizedSignatoryName} onChange={(e) => set('authorizedSignatoryName', e.target.value)} /></Field>
        <Field label="Authorized signatory role"><input style={inputStyle} value={form.authorizedSignatoryRole} onChange={(e) => set('authorizedSignatoryRole', e.target.value)} /></Field>
        <Field label="Primary color"><input type="color" style={{ ...inputStyle, height: 42, padding: 6 }} value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} /></Field>
        <Field label="Secondary color"><input type="color" style={{ ...inputStyle, height: 42, padding: 6 }} value={form.secondaryColor} onChange={(e) => set('secondaryColor', e.target.value)} /></Field>
        <Field label="Watermark text"><input style={inputStyle} value={form.watermarkText} onChange={(e) => set('watermarkText', e.target.value)} /></Field>
      </div>
      <Field label="Default terms"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.defaultTerms} onChange={(e) => set('defaultTerms', e.target.value)} /></Field>
      <Field label="Default payment terms"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.defaultPaymentTerms} onChange={(e) => set('defaultPaymentTerms', e.target.value)} /></Field>
      <Field label="Default notes"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.defaultNotes} onChange={(e) => set('defaultNotes', e.target.value)} /></Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={primaryBtn} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save Company Profile'}</button>
      </div>
    </Card>
  );
}

// ─── Bank accounts ─────────────────────────────────────────────────────────
function BankAccountsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [form, setForm] = useState<any>({});
  const [del, setDel] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res: any = await financialDocumentsApi.listBankAccounts(); setRows(res.data || []); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load bank accounts.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ bankName: '', accountName: '', accountNumber: '', branch: '', branchCode: '', swiftCode: '', currency: 'ZMW', accountType: '', isActive: true, isDefault: false, notes: '' }); setModal({ mode: 'create' }); };
  const openEdit = async (r: any) => { setForm({ bankName: r.bankName || '', accountName: r.accountName || '', accountNumber: r.accountNumber || '', branch: r.branch || '', branchCode: r.branchCode || '', swiftCode: r.swiftCode || '', currency: r.currency || 'ZMW', accountType: r.accountType || '', isActive: r.isActive !== false, isDefault: !!r.isDefault, notes: r.notes || '' }); setModal({ mode: 'edit', id: r.id }); };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (modal?.mode === 'create') await financialDocumentsApi.createBankAccount(form);
      else if (modal?.id) await financialDocumentsApi.updateBankAccount(modal.id, form);
      window.alert(modal?.mode === 'create' ? 'Bank account added.' : 'Bank account updated.');
      setModal(null); await load();
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: C.muted }}>Bank accounts appear on issued invoices and quotations.</span>
        <button style={primaryBtn} onClick={openCreate}><i className="fa fa-plus"></i> Add Bank Account</button>
      </Card>
      {error && <div style={{ marginBottom: '14px' }}><ErrorBox message={error} onRetry={load} /></div>}
      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: C.light }}>No bank accounts configured yet.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>{['Bank', 'Account', 'Branch', 'Currency', 'Type', 'Status', ''].map((h) => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.light, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>)}</thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{r.bankName}{r.isDefault && <span style={{ marginLeft: 6, fontSize: 11, background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 999 }}>Default</span>}</td>
                  <td style={{ padding: '10px' }}>{r.accountName}<div style={{ color: C.light, fontSize: 12 }}>{r.accountNumber}</div></td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.branch || '—'}</td>
                  <td style={{ padding: '10px' }}>{r.currency || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.accountType || '—'}</td>
                  <td style={{ padding: '10px' }}><StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button title="Edit" style={iconBtn} onClick={() => openEdit(r)}><i className="fa fa-edit"></i></button>
                    <button title="Delete" style={{ ...iconBtn, color: '#dc2626', marginLeft: 6 }} onClick={() => setDel(r)}><i className="fa fa-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Add Bank Account' : 'Edit Bank Account'} width={620}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Bank name"><input style={inputStyle} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></Field>
          <Field label="Account name"><input style={inputStyle} value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></Field>
          <Field label="Account number"><input style={inputStyle} value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Field>
          <Field label="Account type"><input style={inputStyle} value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })} /></Field>
          <Field label="Branch"><input style={inputStyle} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></Field>
          <Field label="Branch code"><input style={inputStyle} value={form.branchCode} onChange={(e) => setForm({ ...form, branchCode: e.target.value })} /></Field>
          <Field label="SWIFT code"><input style={inputStyle} value={form.swiftCode} onChange={(e) => setForm({ ...form, swiftCode: e.target.value })} /></Field>
          <Field label="Currency">
            <select style={inputStyle} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div style={{ display: 'flex', gap: '18px', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button style={ghostBtn} onClick={() => setModal(null)}>Cancel</button>
          <button style={primaryBtn} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete bank account" width={420}>
        <p style={{ fontSize: 14 }}>Delete {del?.bankName} {del?.accountNumber}?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={ghostBtn} onClick={() => setDel(null)}>Cancel</button>
          <button style={dangerBtn} onClick={async () => { try { await financialDocumentsApi.deleteBankAccount(del.id); setDel(null); await load(); } catch (e: any) { setError(e?.response?.data?.message || 'Delete failed.'); } }}>Delete</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Tax configurations ────────────────────────────────────────────────────
function TaxConfigsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [form, setForm] = useState<any>({});
  const [del, setDel] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res: any = await financialDocumentsApi.listTaxConfigs(); setRows(res.data || []); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load tax configurations.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ name: '', taxRate: 16, registrationNumber: '', description: '', pricingMode: 'INCLUSIVE', isActive: true, isDefault: false, effectiveFrom: '', effectiveTo: '' }); setModal({ mode: 'create' }); };
  const openEdit = (r: any) => { setForm({ name: r.name || '', taxRate: r.taxRate ?? 0, registrationNumber: r.registrationNumber || '', description: r.description || '', pricingMode: r.pricingMode || 'INCLUSIVE', isActive: r.isActive !== false, isDefault: !!r.isDefault, effectiveFrom: r.effectiveFrom ? String(r.effectiveFrom).slice(0, 10) : '', effectiveTo: r.effectiveTo ? String(r.effectiveTo).slice(0, 10) : '' }); setModal({ mode: 'edit', id: r.id }); };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const payload = { ...form, effectiveFrom: form.effectiveFrom || undefined, effectiveTo: form.effectiveTo || undefined };
      if (modal?.mode === 'create') await financialDocumentsApi.createTaxConfig(payload);
      else if (modal?.id) await financialDocumentsApi.updateTaxConfig(modal.id, payload);
      setModal(null); await load();
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: C.muted }}>Tax rates applied to line items and totals.</span>
        <button style={primaryBtn} onClick={openCreate}><i className="fa fa-plus"></i> Add Tax Configuration</button>
      </Card>
      {error && <div style={{ marginBottom: '14px' }}><ErrorBox message={error} onRetry={load} /></div>}
      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: C.light }}>No tax configurations yet.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>{['Name', 'Rate', 'Pricing', 'Registration', 'Effective', 'Status', ''].map((h) => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.light, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>)}</thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{r.name}{r.isDefault && <span style={{ marginLeft: 6, fontSize: 11, background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 999 }}>Default</span>}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{r.taxRate}%</td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.pricingMode || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.registrationNumber || '—'}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{formatDate(r.effectiveFrom)}{r.effectiveTo ? ` — ${formatDate(r.effectiveTo)}` : ''}</td>
                  <td style={{ padding: '10px' }}><StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button title="Edit" style={iconBtn} onClick={() => openEdit(r)}><i className="fa fa-edit"></i></button>
                    <button title="Delete" style={{ ...iconBtn, color: '#dc2626', marginLeft: 6 }} onClick={() => setDel(r)}><i className="fa fa-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Add Tax Configuration' : 'Edit Tax Configuration'} width={620}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Tax rate (%)"><input type="number" style={inputStyle} value={form.taxRate} min={0} max={100} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></Field>
          <Field label="Pricing mode">
            <select style={inputStyle} value={form.pricingMode} onChange={(e) => setForm({ ...form, pricingMode: e.target.value })}>
              {TAX_PRICING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Registration number"><input style={inputStyle} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></Field>
          <Field label="Effective from"><input type="date" style={inputStyle} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></Field>
          <Field label="Effective to"><input type="date" style={inputStyle} value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} /></Field>
        </div>
        <Field label="Description"><input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div style={{ display: 'flex', gap: '18px', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button style={ghostBtn} onClick={() => setModal(null)}>Cancel</button>
          <button style={primaryBtn} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete tax configuration" width={420}>
        <p style={{ fontSize: 14 }}>Delete {del?.name} ({del?.taxRate}%)?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={ghostBtn} onClick={() => setDel(null)}>Cancel</button>
          <button style={dangerBtn} onClick={async () => { try { await financialDocumentsApi.deleteTaxConfig(del.id); setDel(null); await load(); } catch (e: any) { setError(e?.response?.data?.message || 'Delete failed.'); } }}>Delete</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Templates ─────────────────────────────────────────────────────────────
function TemplatesTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [docType, setDocType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null);
  const [form, setForm] = useState<any>({});
  const [del, setDel] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const res: any = await financialDocumentsApi.listTemplates(docType || undefined); setRows(res.data || []); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load templates.'); }
    finally { setLoading(false); }
  }, [docType]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ name: '', docType: docType || 'INVOICE', description: '', isDefault: false, isActive: true }); setModal({ mode: 'create' }); };
  const openEdit = (r: any) => { setForm({ name: r.name || '', docType: r.docType || 'INVOICE', description: r.description || '', isDefault: !!r.isDefault, isActive: r.isActive !== false }); setModal({ mode: 'edit', id: r.id }); };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (modal?.mode === 'create') await financialDocumentsApi.createTemplate(form);
      else if (modal?.id) await financialDocumentsApi.updateTemplate(modal.id, form);
      setModal(null); await load();
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...inputStyle, maxWidth: 240 }} value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="">All document types</option>
          {['QUOTATION', 'INVOICE', 'PAYMENT_RECEIPT'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <button style={primaryBtn} onClick={openCreate}><i className="fa fa-plus"></i> Add Template</button>
      </Card>
      {error && <div style={{ marginBottom: '14px' }}><ErrorBox message={error} onRetry={load} /></div>}
      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: C.light }}>No templates for this filter yet.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>{['Name', 'Type', 'Description', 'Status', ''].map((h) => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.light, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>)}</thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{r.name}{r.isDefault && <span style={{ marginLeft: 6, fontSize: 11, background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 999 }}>Default</span>}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.docType?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{r.description || '—'}</td>
                  <td style={{ padding: '10px' }}><StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button title="Duplicate" style={iconBtn} onClick={async () => { try { await financialDocumentsApi.duplicateTemplate(r.id); await load(); } catch (e: any) { setError(e?.response?.data?.message || 'Duplicate failed.'); } }}><i className="fa fa-copy"></i></button>
                    <button title="Edit" style={{ ...iconBtn, marginLeft: 6 }} onClick={() => openEdit(r)}><i className="fa fa-edit"></i></button>
                    <button title="Delete" style={{ ...iconBtn, color: '#dc2626', marginLeft: 6 }} onClick={() => setDel(r)}><i className="fa fa-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'create' ? 'Add Template' : 'Edit Template'} width={560}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Name"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Document type">
            <select style={inputStyle} value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
              {['QUOTATION', 'INVOICE', 'PAYMENT_RECEIPT'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description"><input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div style={{ display: 'flex', gap: '18px', marginBottom: '16px' }}>
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button style={ghostBtn} onClick={() => setModal(null)}>Cancel</button>
          <button style={primaryBtn} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete template" width={420}>
        <p style={{ fontSize: 14 }}>Delete template {del?.name}?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={ghostBtn} onClick={() => setDel(null)}>Cancel</button>
          <button style={dangerBtn} onClick={async () => { try { await financialDocumentsApi.deleteTemplate(del.id); setDel(null); await load(); } catch (e: any) { setError(e?.response?.data?.message || 'Delete failed.'); } }}>Delete</button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Numbering & sequences ─────────────────────────────────────────────────
function NumberingTab() {
  const [defaults, setDefaults] = useState<any>(null);
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editModal, setEditModal] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [dRes, sRes] = await Promise.all([financialDocumentsApi.getNumberingDefaults(), financialDocumentsApi.listSequences()]);
      setDefaults(dRes.data || dRes);
      setSequences((sRes.data || []));
    } catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Failed to load numbering.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveDefaults = async () => {
    setBusy(true); setError(null);
    try { await financialDocumentsApi.setNumberingDefaults(defaults); await load(); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  const openEdit = (s: any) => {
    setEditForm({ prefix: s.prefix || '', sequenceLength: s.sequenceLength ?? 5, separator: s.separator || '-', startNumber: s.startNumber ?? 1, pattern: s.pattern || '{PREFIX}{SEPARATOR}{YEAR}{SEPARATOR}{SEQ}', resetPolicy: s.resetPolicy || 'ANNUAL' });
    setEditModal(s);
  };

  const saveSequence = async () => {
    setBusy(true); setError(null);
    try { await financialDocumentsApi.updateSequenceSettings(editModal.documentType, editForm); setEditModal(null); await load(); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Save failed.'); }
    finally { setBusy(false); }
  };

  const resetSequence = async (s: any) => {
    setBusy(true); setError(null);
    try { await financialDocumentsApi.resetSequence(s.documentType, { prefix: s.prefix, year: s.year }); await load(); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Reset failed.'); }
    finally { setBusy(false); }
  };

  if (loading) return <Loading />;

  const setDefault = (k: string, v: any) => setDefaults((d: any) => ({ ...d, [k]: v }));

  return (
    <div>
      <Card style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>Default Numbering</h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: C.muted }}>Defaults applied when a new document number is first generated.</p>
        {defaults && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <Field label="Quotation prefix"><input style={inputStyle} value={defaults.prefixQuotation} onChange={(e) => setDefault('prefixQuotation', e.target.value)} /></Field>
            <Field label="Invoice prefix"><input style={inputStyle} value={defaults.prefixInvoice} onChange={(e) => setDefault('prefixInvoice', e.target.value)} /></Field>
            <Field label="Receipt prefix"><input style={inputStyle} value={defaults.prefixReceipt} onChange={(e) => setDefault('prefixReceipt', e.target.value)} /></Field>
            <Field label="Sequence length"><input type="number" style={inputStyle} value={defaults.sequenceLength} min={3} max={12} onChange={(e) => setDefault('sequenceLength', e.target.value)} /></Field>
            <Field label="Separator"><input style={inputStyle} value={defaults.separator} onChange={(e) => setDefault('separator', e.target.value)} /></Field>
            <Field label="Reset policy">
              <select style={inputStyle} value={defaults.resetPolicy} onChange={(e) => setDefault('resetPolicy', e.target.value)}>
                {RESET_POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button style={primaryBtn} disabled={busy} onClick={saveDefaults}>{busy ? 'Saving…' : 'Save Defaults'}</button>
        </div>
      </Card>

      {error && <div style={{ marginBottom: '14px' }}><ErrorBox message={error} onRetry={load} /></div>}

      <Card>
        <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700 }}>Numbering Sequences</h3>
        {sequences.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: C.light }}>No sequences initialized yet. They auto-initialize on first issue.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>{['Type', 'Prefix', 'Year', 'Next', 'Length', 'Separator', 'Policy', ''].map((h) => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.light, fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>)}</thead>
            <tbody>
              {sequences.map((s) => (
                <tr key={`${s.documentType}-${s.prefix}-${s.year}`} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{s.documentType?.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px' }}>{s.prefix}</td>
                  <td style={{ padding: '10px' }}>{s.year || '—'}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{(s.sequence ?? 0) + 1}</td>
                  <td style={{ padding: '10px', color: C.muted }}>{s.sequenceLength}</td>
                  <td style={{ padding: '10px', color: C.muted }}>"{s.separator}"</td>
                  <td style={{ padding: '10px' }}>{s.resetPolicy}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button title="Edit" style={iconBtn} onClick={() => openEdit(s)}><i className="fa fa-edit"></i></button>
                    <button title="Reset to start" style={{ ...iconBtn, marginLeft: 6 }} onClick={async () => { if (window.confirm('Reset this sequence counter?')) await resetSequence(s); }}><i className="fa fa-rotate-left"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Edit ${editModal?.documentType?.replace(/_/g, ' ') || ''} sequence`} width={560}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <Field label="Prefix"><input style={inputStyle} value={editForm.prefix} onChange={(e) => setEditForm({ ...editForm, prefix: e.target.value })} /></Field>
          <Field label="Sequence length (3–12)"><input type="number" style={inputStyle} value={editForm.sequenceLength} min={3} max={12} onChange={(e) => setEditForm({ ...editForm, sequenceLength: e.target.value })} /></Field>
          <Field label="Separator"><input style={inputStyle} value={editForm.separator} onChange={(e) => setEditForm({ ...editForm, separator: e.target.value })} /></Field>
          <Field label="Start number"><input type="number" style={inputStyle} value={editForm.startNumber} min={1} onChange={(e) => setEditForm({ ...editForm, startNumber: e.target.value })} /></Field>
          <Field label="Pattern" hint="Tokens: {PREFIX} {SEPARATOR} {YEAR} {SEQ}"><input style={inputStyle} value={editForm.pattern} onChange={(e) => setEditForm({ ...editForm, pattern: e.target.value })} /></Field>
          <Field label="Reset policy">
            <select style={inputStyle} value={editForm.resetPolicy} onChange={(e) => setEditForm({ ...editForm, resetPolicy: e.target.value })}>
              {RESET_POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button style={ghostBtn} onClick={() => setEditModal(null)}>Cancel</button>
          <button style={primaryBtn} disabled={busy} onClick={saveSequence}>{busy ? 'Saving…' : 'Save'}</button>
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