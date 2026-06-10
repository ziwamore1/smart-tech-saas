'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { stampApi } from '@/lib/api';

const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';
const gradOrange = 'linear-gradient(135deg, #f59e0b, #d97706)';

export default function HashVerifyPage() {
  const params = useParams();
  const hash = params?.hash as string || '';
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hash) {
      setError('No verification code provided.');
      setVerifying(false);
      return;
    }
    const verify = async () => {
      try {
        const response = await stampApi.verifyDocument(hash);
        setResult(response.data?.data || response.data || null);
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || 'Verification failed.';
        setError(msg);
      } finally {
        setVerifying(false);
      }
    };
    verify();
  }, [hash]);

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  };

  if (verifying) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>Verifying document...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '64px', height: '64px', background: gradGreen, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <i className="fa fa-shield-alt" style={{ fontSize: '28px', color: 'white' }}></i>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>Document Verification</h1>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '20px', border: '1px solid #fecaca', textAlign: 'center' }}>
            <i className="fa fa-exclamation-triangle" style={{ fontSize: '32px', color: '#ef4444', marginBottom: '12px' }}></i>
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#991b1b', margin: '0 0 4px' }}>Verification Failed</p>
            <p style={{ fontSize: '14px', color: '#dc2626', margin: 0 }}>{error}</p>
            <a href="/verify" style={{ display: 'inline-block', marginTop: '16px', color: '#10b981', fontWeight: 600, fontSize: '14px', textDecoration: 'underline' }}>
              Try another code
            </a>
          </div>
        )}

        {result && (
          <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{
              padding: '24px',
              background: result.status === 'verified' ? '#f0fdf4' : result.status === 'not_found' ? '#fffbeb' : '#fef2f2',
              textAlign: 'center',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '16px',
                background: result.status === 'verified' ? gradGreen : result.status === 'not_found' ? gradOrange : gradRed,
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              }}>
                <i className={`fa ${result.status === 'verified' ? 'fa-check-circle' : result.status === 'not_found' ? 'fa-search' : 'fa-exclamation-triangle'}`} style={{ fontSize: '28px', color: 'white' }}></i>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: result.status === 'verified' ? '#065f46' : result.status === 'not_found' ? '#92400e' : '#991b1b' }}>
                {result.status === 'verified' ? 'DOCUMENT IS AUTHENTIC' : result.status === 'not_found' ? 'DOCUMENT NOT FOUND' : 'DOCUMENT IS INVALID'}
              </div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                {result.status === 'verified' ? 'This document has been digitally stamped and verified.' : ''}
              </p>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                {result.documentId && <Field label="Document ID" value={result.documentId} />}
                {result.documentType && <Field label="Type" value={result.documentType} />}
                {(result.schoolName || result.school?.name) && <Field label="School" value={result.schoolName || result.school?.name} />}
                {result.verifiedAt && <Field label="Verified At" value={formatDate(result.verifiedAt)} />}
                {result.createdAt && <Field label="Issued At" value={formatDate(result.createdAt)} />}
              </div>
            </div>
          </div>
        )}

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
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}
