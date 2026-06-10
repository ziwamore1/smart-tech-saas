'use client';

import { useEffect, useState } from 'react';
import { stampApi } from '@/lib/api';

const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';
const gradOrange = 'linear-gradient(135deg, #f59e0b, #d97706)';

export default function PublicVerifyPage() {
  const [hash, setHash] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!hash.trim()) {
      setError('Please enter a verification code.');
      return;
    }
    try {
      setVerifying(true);
      setError('');
      setResult(null);
      const response = await stampApi.verifyDocument(hash.trim());
      setResult(response.data?.data || response.data || null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Verification failed. The document may not exist or the code is invalid.';
      setError(msg);
      setResult(null);
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', padding: '20px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', background: gradGreen, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fa fa-shield-alt" style={{ fontSize: '28px', color: 'white' }}></i>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>Document Verification</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Verify the authenticity of digitally stamped documents</p>
        </div>

        {/* Input Card */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e8ddd0' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '10px' }}>Verification Code</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              value={hash}
              onChange={e => setHash(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="Paste verification code..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                fontFamily: 'monospace',
                outline: 'none',
                background: '#f5efe8',
              }}
            />
            <button
              onClick={handleVerify}
              disabled={verifying}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                border: 'none',
                background: verifying ? '#9ca3af' : gradGreen,
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                cursor: verifying ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: '16px', background: '#fef2f2', borderRadius: '12px', padding: '16px', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <i className="fa fa-exclamation-circle" style={{ fontSize: '18px', color: '#ef4444', flexShrink: 0, marginTop: '1px' }}></i>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#991b1b', margin: '0 0 2px' }}>Verification Failed</p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{error}</p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ marginTop: '16px', background: '#fefcf9', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{
              padding: '20px 24px',
              background: result.status === 'verified' ? '#f0fdf4' : result.status === 'not_found' ? '#fffbeb' : '#fef2f2',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: result.status === 'verified' ? gradGreen : result.status === 'not_found' ? gradOrange : gradRed,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={`fa ${result.status === 'verified' ? 'fa-check-circle' : result.status === 'not_found' ? 'fa-search' : 'fa-exclamation-triangle'}`} style={{ fontSize: '20px', color: 'white' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Verification Result</div>
                <div style={{ fontSize: '13px', color: result.status === 'verified' ? '#065f46' : result.status === 'not_found' ? '#92400e' : '#991b1b', fontWeight: 600, marginTop: '2px' }}>
                  {result.status === 'verified' ? 'AUTHENTIC' : result.status === 'not_found' ? 'NOT FOUND' : 'INVALID'}
                </div>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                {result.documentId && <Field label="Document ID" value={result.documentId} />}
                {result.documentType && <Field label="Document Type" value={result.documentType} />}
                {(result.schoolName || result.school?.name) && <Field label="School" value={result.schoolName || result.school?.name} />}
                {result.verifiedAt && <Field label="Verified At" value={formatDate(result.verifiedAt)} />}
                {result.createdAt && <Field label="Issued At" value={formatDate(result.createdAt)} />}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '24px' }}>
          Powered by SmartTech Digital Stamp System
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f5efe8', borderRadius: '8px', gap: '12px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
