'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { stampApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';

interface VerificationResult {
  documentId: string;
  documentType: string;
  school?: { id: string; name: string };
  schoolName?: string;
  stampUsed?: { id: string; name: string; type: string };
  status: 'verified' | 'invalid' | 'not_found' | 'tampered';
  verifiedAt: string;
  createdAt: string;
  metadata?: any;
}

export default function StampVerificationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [hash, setHash] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleVerify = async () => {
    if (!hash.trim()) {
      setError('Please enter a verification hash.');
      return;
    }
    try {
      setVerifying(true);
      setError('');
      setResult(null);
      const response = await stampApi.verifyDocument(hash.trim());
      setResult(response.data?.data || response.data || null);
    } catch (err: any) {
      console.error('Verification failed:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Verification failed. The document may not exist or the hash is invalid.';
      setError(msg);
      setResult(null);
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; color: string; icon: string; label: string }> = {
      verified: { bg: '#d1fae5', color: '#065f46', icon: 'fa-check-circle', label: 'Verified' },
      invalid: { bg: '#fef2f2', color: '#991b1b', icon: 'fa-times-circle', label: 'Invalid' },
      not_found: { bg: '#fef3c7', color: '#92400e', icon: 'fa-search', label: 'Not Found' },
      tampered: { bg: '#fef2f2', color: '#991b1b', icon: 'fa-exclamation-triangle', label: 'Tampered' },
    };
    const c = config[status] || { bg: '#f3f4f6', color: '#6b7280', icon: 'fa-question-circle', label: status };
    return (
      <span style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 600, borderRadius: '8px', background: c.bg, color: c.color, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <i className={`fa ${c.icon}`} style={{ fontSize: '12px' }}></i>
        {c.label}
      </span>
    );
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-check-circle"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .verify-card { transition: all 0.2s ease; }
        .verify-card:hover { box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-check-circle" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Document Verification
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Verify digital stamp authenticity on documents</p>
        </div>
      </div>

      {/* Verification Input */}
      <div className="verify-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-search" style={{ fontSize: '16px', color: '#10b981' }}></i>
            Enter Verification Hash
          </label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              value={hash}
              onChange={e => setHash(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="Paste the verification hash from the document..."
              style={{
                flex: 1,
                minWidth: '250px',
                padding: '14px 18px',
                borderRadius: '12px',
                border: '1px solid #e8ddd0',
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
                padding: '14px 32px',
                borderRadius: '12px',
                border: 'none',
                background: verifying ? '#9ca3af' : gradGreen,
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: verifying ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
              }}
            >
              {verifying ? (
                <>
                  <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                  Verifying...
                </>
              ) : (
                <>
                  <i className="fa fa-shield-alt"></i>
                  Verify Document
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
            <i className="fa fa-info-circle" style={{ marginRight: '4px' }}></i>
            Enter the unique verification hash found on the stamped document to verify its authenticity.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '20px', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <i className="fa fa-exclamation-circle" style={{ fontSize: '20px', color: '#ef4444', flexShrink: 0, marginTop: '2px' }}></i>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#991b1b', margin: '0 0 4px' }}>Verification Failed</p>
            <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{error}</p>
          </div>
        </div>
      )}

      {/* Verification Result */}
      {result && (
        <div className="verify-card" style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {/* Status Header */}
          <div style={{
            padding: '20px 24px',
            background: result.status === 'verified' ? '#f0fdf4' : result.status === 'not_found' ? '#fffbeb' : '#fef2f2',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: result.status === 'verified' ? gradGreen : result.status === 'not_found' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : gradRed,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <i className={`fa ${result.status === 'verified' ? 'fa-check-circle' : result.status === 'not_found' ? 'fa-search' : 'fa-exclamation-triangle'}`} style={{ fontSize: '22px', color: 'white' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Verification Result</div>
                <div style={{ marginTop: '4px' }}>{getStatusBadge(result.status)}</div>
              </div>
            </div>
            {result.verifiedAt && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                <i className="fa fa-clock" style={{ marginRight: '4px' }}></i>
                {formatDate(result.verifiedAt)}
              </span>
            )}
          </div>

          {/* Details */}
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <DetailField icon="fa-file" label="Document ID" value={result.documentId} />
              <DetailField icon="fa-tag" label="Document Type" value={result.documentType} />
              <DetailField icon="fa-building" label="School" value={result.school?.name || result.schoolName || '-'} />
              <DetailField icon="fa-stamp" label="Stamp Used" value={result.stampUsed?.name || '-'} />
              <DetailField icon="fa-tag" label="Stamp Type" value={result.stampUsed?.type || '-'} />
              <DetailField icon="fa-calendar" label="Created At" value={formatDate(result.createdAt)} />
              <DetailField icon="fa-clock" label="Verified At" value={formatDate(result.verifiedAt)} />
            </div>

            {result.metadata && Object.keys(result.metadata).length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f3f4f6' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa fa-info-circle" style={{ color: '#6b7280' }}></i>
                  Additional Metadata
                </h3>
                <pre style={{
                  background: '#f5efe8',
                  padding: '16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#374151',
                  overflowX: 'auto',
                  margin: 0,
                  fontFamily: 'monospace',
                  border: '1px solid #f3f4f6',
                }}>
                  {JSON.stringify(result.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !error && !verifying && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '48px', textAlign: 'center', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{
            width: '72px',
            height: '72px',
            background: '#f0fdf4',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <i className="fa fa-shield-alt" style={{ fontSize: '32px', color: '#10b981' }}></i>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 8px' }}>Document Verification Portal</h3>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, maxWidth: '480px', marginInline: 'auto' }}>
            Enter a verification hash above to verify the authenticity and integrity of a digitally stamped document.
          </p>
        </div>
      )}
    </div>
  );
}

function DetailField({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
      <i className={`fa ${icon}`} style={{ fontSize: '14px', color: '#10b981', marginTop: '2px', flexShrink: 0 }}></i>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
        <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: 500, marginTop: '2px', wordBreak: 'break-all' }}>{value}</div>
      </div>
    </div>
  );
}
