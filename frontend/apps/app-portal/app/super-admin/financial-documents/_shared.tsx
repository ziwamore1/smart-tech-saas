'use client';

import { ReactNode } from 'react';

export const C = {
  bg: '#f5efe8',
  card: '#fdfaf7',
  border: '#e8ddd0',
  primary: '#ea6645',
  text: '#1f2937',
  muted: '#6b7280',
  light: '#9ca3af',
};

export function formatMoney(n: number | string | null | undefined, currency?: string | null): string {
  const value = typeof n === 'string' ? parseFloat(n) : Number(n ?? 0);
  if (Number.isNaN(value)) return `0 ${currency || 'ZMW'}`;
  try {
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'ZMW'}`;
  } catch {
    return `${value.toFixed(2)} ${currency || 'ZMW'}`;
  }
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  try {
    const d = typeof input === 'string' ? new Date(input) : input;
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return '—';
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusColor(status: string | null | undefined): string {
  const s = (status || '').toLowerCase();
  if (['paid', 'confirmed', 'issued', 'accepted', 'active', 'completed'].includes(s)) return '#059669';
  if (['void', 'cancelled', 'rejected', 'expired', 'reversed', 'inactive'].includes(s)) return '#dc2626';
  if (['partial', 'partially_paid', 'overdue', 'under_review', 'submitted', 'sent'].includes(s)) return '#d97706';
  if (s === 'draft') return '#6b7280';
  return '#3b82f6';
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = titleCase(status);
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.2px',
      background: `${statusColor(status)}1a`,
      color: statusColor(status),
      whiteSpace: 'nowrap',
    }}>
      {s}
    </span>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '16px',
      padding: '20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', color: C.muted, fontSize: '14px' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: '10px',
  fontSize: '14px',
  background: '#fff',
  color: C.text,
  outline: 'none',
  boxSizing: 'border-box',
};

export const primaryBtn: React.CSSProperties = {
  padding: '10px 16px',
  border: 'none',
  borderRadius: '10px',
  background: C.primary,
  color: '#fff',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
};

export const ghostBtn: React.CSSProperties = {
  padding: '10px 16px',
  border: `1px solid ${C.border}`,
  borderRadius: '10px',
  background: '#fff',
  color: C.muted,
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
};

export const dangerBtn: React.CSSProperties = {
  padding: '10px 16px',
  border: '1px solid #fecaca',
  borderRadius: '10px',
  background: '#fef2f2',
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
};

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: '14px' }}>
      <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '12px', color: C.light, marginTop: '4px' }}>{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, width = 720 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '48px 16px', overflowY: 'auto',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: width,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={{ width: '34px', height: '34px', borderRadius: '8px', border: 'none', background: '#f3f4f6', color: C.muted, cursor: 'pointer', fontSize: '14px' }}>
            <i className="fa fa-times"></i>
          </button>
        </div>
        <div style={{ padding: '22px', maxHeight: '72vh', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', color: C.light }}>
      <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px', marginRight: '10px' }}></i>
      Loading…
    </div>
  );
}

export function Empty({ text }: { text?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: C.light, fontSize: '14px' }}>
      <i className="fa fa-inbox" style={{ fontSize: '28px', marginBottom: '10px', display: 'block' }}></i>
      {text || 'Nothing here yet.'}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca',
      color: '#dc2626', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    }}>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ ...ghostBtn, padding: '8px 14px', background: '#fff' }}>
          <i className="fa fa-rotate-right"></i> Retry
        </button>
      )}
    </div>
  );
}

export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID'];
export const QUOTATION_STATUSES = ['DRAFT', 'ISSUED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONVERTED_TO_INVOICE'];
export const PAYMENT_STATUSES = ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'CONFIRMED', 'REJECTED', 'REVERSED'];
export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'USSD', 'OTHER'];
export const CUSTOMER_TYPES = ['SCHOOL', 'GOVERNMENT', 'NGO', 'CORPORATE', 'INDIVIDUAL', 'OTHER'];
export const RESET_POLICIES = ['NEVER', 'ANNUAL', 'MANUAL'];
export const CURRENCIES = ['ZMW', 'USD', 'EUR', 'KES', 'NGN', 'ZAR', 'GBP'];
export const TAX_PRICING_MODES = ['INCLUSIVE', 'EXCLUSIVE'];