'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function VerifyLanding() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) router.push(`/v/${encodeURIComponent(clean)}`);
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <div style={{ width: 68, height: 68, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 8px 24px rgba(37,99,235,0.2)' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Document Verification</h1>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 26px' }}>
          Enter the verification code printed on your SMART_TECH document,
          or scan the QR code with your phone camera.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', gap: 10 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="e.g. WZL9XHP9Z6"
            aria-label="Verification code"
            style={{
              flex: 1, padding: '13px 16px', fontSize: 15, borderRadius: 12,
              border: '1px solid #cbd5e1', outline: 'none', textTransform: 'uppercase',
              fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '13px 22px', fontSize: 15, fontWeight: 600, color: 'white',
              background: '#2563eb', border: 'none', borderRadius: 12, cursor: 'pointer',
            }}
          >
            Verify
          </button>
        </form>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 28 }}>
          SMART_TECH · Institutional Document Authenticity Platform
        </p>
      </div>
    </main>
  );
}
