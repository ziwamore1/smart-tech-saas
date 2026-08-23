'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Public document verification portal — /v/{code}.
 * Institutional, professional, minimal data exposure:
 * document type, issuing institution, serial, issue date/time, statuses.
 * No confidential student information is ever exposed.
 */
export default function PublicVerifyPage() {
  const params = useParams();
  const code = (params?.code as string || '').trim().toUpperCase();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [verifiedAt, setVerifiedAt] = useState('');

  useEffect(() => {
    if (!code) { setError('No verification code provided.'); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/verification/${encodeURIComponent(code)}`, {
          headers: { Accept: 'application/json' },
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.message || 'This verification code could not be validated.');
        } else {
          setResult(body?.data ?? body);
          setVerifiedAt(new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
        }
      } catch {
        setError('Verification service is unreachable. Please try again later.');
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  const statusTheme = () => {
    switch (result?.status) {
      case 'VALID': return { grad: 'linear-gradient(135deg,#10b981,#059669)', label: 'Document Authenticity Verified', icon: 'check' };
      case 'SUPERSEDED': return { grad: 'linear-gradient(135deg,#f59e0b,#d97706)', label: 'Document Superseded', icon: 'warn' };
      case 'EXPIRED': return { grad: 'linear-gradient(135deg,#6b7280,#4b5563)', label: 'Validity Period Ended', icon: 'warn' };
      case 'REVOKED': return { grad: 'linear-gradient(135deg,#ef4444,#dc2626)', label: 'Document Revoked', icon: 'cross' };
      default: return { grad: 'linear-gradient(135deg,#10b981,#059669)', label: '', icon: 'check' };
    }
  };
  const theme = statusTheme();

  const Row = ({ k, v, mono }: { k: string; v?: string | number | null; mono?: boolean }) =>
    v ? (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{k}</span>
        <span style={{ fontSize: 14, color: '#111827', fontWeight: 500, textAlign: 'right', wordBreak: mono ? 'break-all' : undefined, fontFamily: mono ? 'ui-monospace, monospace' : undefined }}>{String(v)}</span>
      </div>
    ) : null;

  const StatusPill = ({ ok, label, note }: { ok: boolean; label: string; note?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: ok ? '#ecfdf5' : '#fef2f2', borderRadius: 8 }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: ok ? '#059669' : '#dc2626', color: 'white', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{ok ? '✓' : '✕'}</span>
      <span style={{ fontSize: 13, color: ok ? '#065f46' : '#991b1b' }}>{label}{note}</span>
    </div>
  );

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, color: '#64748b' }}>Verifying document…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  const valid = result?.status === 'VALID';

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* Header band */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 68, height: 68, background: error ? 'linear-gradient(135deg,#ef4444,#dc2626)' : theme.grad, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(37,99,235,0.15)' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {error || !valid
                ? theme.icon === 'cross'
                  ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                  : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>}
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {error ? 'Verification Failed' : valid ? theme.label : theme.label}
          </h1>
          {!error && result?.status === 'SUPERSEDED' && (
            <p style={{ fontSize: 13, color: '#92400e', marginTop: 6 }}>A newer revision replaces this document. It remains verifiable for audit purposes only.</p>
          )}
          {!error && result?.status === 'REVOKED' && (
            <p style={{ fontSize: 13, color: '#991b1b', marginTop: 6 }}>
              The issuing institution has withdrawn this document{result.revocationReason ? ` — ${result.revocationReason}` : ''}.
            </p>
          )}
          {!error && valid && (
            <p style={{ fontSize: 13, color: '#047857', marginTop: 6 }}>All security attributes verified successfully.</p>
          )}
        </div>

        {error ? (
          <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 24px rgba(15,23,42,0.06)', padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#334155' }}>{error}</p>
            <p className="mono" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#94a3b8', marginTop: 10 }}>{code}</p>
          </div>
        ) : (
          <>
            <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 24px rgba(15,23,42,0.06)', padding: 24, marginBottom: 14 }}>
              <Row k="Institution" v={result.institution} />
              <Row k="Document type" v={result.documentType} />
              <Row k="Serial number" v={result.serialNumber} mono />
              <Row k="Issued on" v={[result.issuedDate, result.issuedTime].filter(Boolean).join(' · ')} />
              <Row k="Hash algorithm" v={result.hashAlgorithm} />
              <Row k="Integrity reference" v={result.hashTruncated} mono />
              {result.disclaimer && (
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 14, lineHeight: 1.6 }}>{result.disclaimer}</p>
              )}
            </div>

            {/* Security attribute summary */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              <StatusPill ok={valid} label={`Document status: ${result.status}`} />
              <StatusPill ok={!valid || result.digitallySigned} label={`Cryptographic digital signature`} note={result.digitallySigned ? ' — applied' : valid ? ' — not present (stamp-only issuance)' : ''} />
              <StatusPill ok={Boolean(result.officialStampApplied)} label="Institutional stamp" note={result.officialStampApplied ? ' — applied' : ''} />
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
              <p style={{ fontSize: 12.5, color: '#1e40af', lineHeight: 1.65, margin: 0 }}>
                This verification confirms that the document was issued by the stated institution and has not been revoked or superseded.
                Verified {verifiedAt}. Verification of authenticity does not certify any altered photocopy of the document.
              </p>
            </div>

            <div style={{ background: 'white', borderRadius: 12, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#334155' }}>{code}</span>
              <span style={{ fontSize: 11, color: '#2563eb', background: '#dbeafe', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>{result.status}</span>
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 20 }}>
          SMART_TECH · Institutional Document Authenticity Platform
        </p>
      </div>
    </main>
  );
}
