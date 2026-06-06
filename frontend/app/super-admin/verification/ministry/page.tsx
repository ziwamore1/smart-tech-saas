'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function MinistryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadVerifications();
  }, [isAuthenticated]);

  const loadVerifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/ministry/school/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setVerifications(data.verifications || []);
    } catch (error) {
      console.error('Failed to load ministry verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return { bg: '#d1fae5', text: '#059669' };
      case 'pending': return { bg: '#fef3c7', text: '#d97706' };
      case 'error': return { bg: '#fef2f2', text: '#dc2626' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const filtered = verifications.filter((v) => {
    if (filter === 'all') return true;
    return v.verificationStatus === filter;
  });

  if (isLoading || loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa fa-building" style={{ color: '#10b981' }}></i> Ministry Verifications
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Track ministry API verification status</p>
        </div>
        <Link href="/super-admin/verification" style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
          <i className="fa fa-arrow-left"></i> Back
        </Link>
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'verified', 'error'].map((f) => {
          const colors = f !== 'all' ? getStatusColor(f) : null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: filter === f ? '#10b981' : colors ? colors.bg : '#f3f4f6',
                color: filter === f ? 'white' : colors ? colors.text : '#6b7280',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5efe8', borderBottom: '1px solid #e8ddd0' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Document</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Ministry Reference</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Verified At</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Expires At</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const colors = getStatusColor(v.verificationStatus);
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }} className="table-row">
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{v.documentType}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>{v.documentId?.substring(0, 8)}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>{v.ministryReference || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: colors.bg, color: colors.text, textTransform: 'capitalize' }}>
                        {v.verificationStatus}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280' }}>{v.verifiedAt ? new Date(v.verifiedAt).toLocaleDateString() : '-'}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280' }}>{v.expiresAt ? new Date(v.expiresAt).toLocaleDateString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No ministry verifications found</div>
        )}
      </div>
    </div>
  );
}
