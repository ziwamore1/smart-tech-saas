'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { financialDocumentsApi } from '@/lib/api';
import { Card, PageHeader, Loading, Empty, StatusBadge, formatMoney, formatDate, C } from './_shared';

interface DashboardData {
  quotations?: { total: number; monthly: number; byStatus: Record<string, number> };
  invoices?: { total: number; monthly: number; byStatus: Record<string, number>; billed: number; collected: number; outstanding: number; overdueCount: number; overdueAmount: number; overdue: any[] };
  payments?: { total: number; confirmedCount: number; monthly: number; byStatus: Record<string, number>; collected: number };
  receipts?: { total: number; monthly: number; byStatus: Record<string, number> };
  customers?: number;
  recent?: any[];
}

interface Readiness { ready: boolean; checks: Array<{ key: string; label: string; ok: boolean; message: string }> }

function Stat({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}1a`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
          <i className={`fa ${icon}`}></i>
        </div>
        <div>
          <div style={{ fontSize: '21px', fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{value}</div>
          <div style={{ fontSize: '13px', color: C.muted }}>{label}</div>
        </div>
      </div>
      {sub && <div style={{ fontSize: '12px', color: C.light, marginTop: '12px', borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>{sub}</div>}
    </Card>
  );
}

function Section({ to, icon, color, title, desc, stats }: { to: string; icon: string; color: string; title: string; desc: string; stats: Array<[string, string]> }) {
  return (
    <Card>
      <Link href={to} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}1a`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
            <i className={`fa ${icon}`}></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{title}</div>
            <div style={{ fontSize: '13px', color: C.muted }}>{desc}</div>
          </div>
          <i className="fa fa-chevron-right" style={{ color: C.light, fontSize: '13px' }}></i>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {stats.map(([k, v]) => (
            <div key={k} style={{ background: '#f5efe8', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{v}</div>
              <div style={{ fontSize: '12px', color: C.muted }}>{k}</div>
            </div>
          ))}
        </div>
      </Link>
    </Card>
  );
}

export default function FinancialDocumentsHubPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, rRes] = await Promise.all([
        financialDocumentsApi.dashboard(),
        financialDocumentsApi.readiness(),
      ]);
      setData((dRes as any).data || dRes);
      setReadiness((rRes as any).data || rRes);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load financial documents dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;

  const inv = data?.invoices;
  const qo = data?.quotations;
  const pay = data?.payments;
  const rec = data?.receipts;

  return (
    <div>
      <PageHeader
        title="Financial Documents"
        subtitle="Company invoicing, quotations, receipts and payment management for the platform."
        actions={<Link href="/super-admin/financial-documents/invoices" style={{ textDecoration: 'none' }}><button style={{ padding: '10px 16px', border: 'none', borderRadius: '10px', background: C.primary, color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}><i className="fa fa-file-invoice" style={{ marginRight: '8px' }}></i>Manage Invoices</button></Link>}
      />

      {error && (
        <div style={{ padding: '16px 18px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={load} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}><i className="fa fa-rotate-right"></i> Retry</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <Stat icon="fa-file-invoice" label="Billed (all invoices)" value={formatMoney(inv?.billed)} sub={`${inv?.total ?? 0} invoices · ${inv?.monthly ?? 0} this month`} color="#ea6645" />
        <Stat icon="fa-hand-holding-usd" label="Collected" value={formatMoney(inv?.collected)} sub={`${pay?.confirmedCount ?? 0} confirmed payments`} color="#059669" />
        <Stat icon="fa-clock" label="Outstanding" value={formatMoney(inv?.outstanding)} sub={`${inv?.overdueCount ?? 0} overdue · ${formatMoney(inv?.overdueAmount)}`} color="#d97706" />
        <Stat icon="fa-receipt" label="Receipts issued" value={String(rec?.total ?? 0)} sub={`${rec?.monthly ?? 0} this month`} color="#3b82f6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <Section to="/super-admin/financial-documents/invoices" icon="fa-file-invoice-dollar" color="#ea6645" title="Invoices" desc="Create, issue, send and manage invoices with PDFs." stats={[['Total', String(inv?.total ?? 0)], ['Outstanding', formatMoney(inv?.outstanding)], ['Draft', String(inv?.byStatus?.DRAFT ?? 0)], ['Paid', String(inv?.byStatus?.PAID ?? 0)]]} />
        <Section to="/super-admin/financial-documents/quotations" icon="fa-file-contract" color="#7c3aed" title="Quotations" desc="Prepare quotations and convert them to invoices." stats={[['Total', String(qo?.total ?? 0)], ['This month', String(qo?.monthly ?? 0)], ['Issued', String(qo?.byStatus?.ISSUED ?? 0)], ['Converted', String(qo?.byStatus?.CONVERTED_TO_INVOICE ?? 0)]]} />
        <Section to="/super-admin/financial-documents/payments" icon="fa-money-bill-wave" color="#059669" title="Payments" desc="Review and confirm payments received against invoices." stats={[['Total', String(pay?.total ?? 0)], ['Confirmed', String(pay?.confirmedCount ?? 0)], ['Collected', formatMoney(pay?.collected)], ['Pending', String(pay?.byStatus?.PENDING ?? 0)]]} />
        <Section to="/super-admin/financial-documents/receipts" icon="fa-receipt" color="#3b82f6" title="Receipts" desc="Issue and void payment receipts." stats={[['Total', String(rec?.total ?? 0)], ['This month', String(rec?.monthly ?? 0)], ['Issued', String(rec?.byStatus?.ISSUED ?? 0)], ['Void', String(rec?.byStatus?.VOID ?? 0)]]} />
        <Section to="/super-admin/financial-documents/customers" icon="fa-users" color="#0d9488" title="Customers" desc="Manage the businesses and clients you bill." stats={[['Active', String(data?.customers ?? 0)], ['', '']]} />
        <Section to="/super-admin/financial-documents/settings" icon="fa-cog" color="#64748b" title="Settings" desc="Company profile, tax, bank accounts, templates and numbering." stats={[['Ready', readiness ? (readiness.ready ? 'All checks pass' : `${readiness.checks.filter((c) => !c.ok).length} outstanding`) : '—'], ['', '']]} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <Card>
          <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700 }}>Recent Documents</h3>
          {!data?.recent?.length ? <Empty text="No documents yet." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: C.light, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Type</th>
                  <th style={{ padding: '8px 10px' }}>Number</th>
                  <th style={{ padding: '8px 10px' }}>Customer</th>
                  <th style={{ padding: '8px 10px' }}>Amount</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((d: any, i: number) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <i className={`fa ${d.type === 'INVOICE' ? 'fa-file-invoice' : d.type === 'QUOTATION' ? 'fa-file-contract' : 'fa-receipt'}`} style={{ color: C.primary }}></i>
                        {d.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{d.number}</td>
                    <td style={{ padding: '10px', color: C.muted }}>{d.customer || '—'}</td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{formatMoney(d.amount, d.currency)}</td>
                    <td style={{ padding: '10px' }}><StatusBadge status={d.status} /></td>
                    <td style={{ padding: '10px', color: C.muted }}>{formatDate(d.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700 }}>Setup Checklist</h3>
          {!readiness ? <Empty /> : readiness.checks.map((c) => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: c.ok ? '#059669' : '#dc2626', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                <i className={`fa ${c.ok ? 'fa-check' : 'fa-times'}`}></i>
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{c.label}</div>
                <div style={{ fontSize: '12px', color: c.ok ? '#059669' : '#b45309' }}>{c.message}</div>
              </div>
            </div>
          ))}
          <Link href="/super-admin/financial-documents/settings" style={{ display: 'block', textAlign: 'center', marginTop: '14px', fontSize: '13px', fontWeight: 600, color: C.primary, textDecoration: 'none' }}>
            Open settings <i className="fa fa-arrow-right" style={{ marginLeft: '4px', fontSize: '11px' }}></i>
          </Link>
        </Card>
      </div>
    </div>
  );
}