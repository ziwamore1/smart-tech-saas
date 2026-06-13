'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/v1\/?$/, '');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

export default function SignaturesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadSignatures();
  }, [isAuthenticated]);

  const loadSignatures = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/signing/document/all`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      setSignatures(data?.data?.signatures || data?.signatures || []);
    } catch (error) {
      console.error('Failed to load signatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (token: string) => {
    if (!confirm('Are you sure you want to revoke this signature?')) return;
    try {
      await fetch(`${API_BASE}/api/v1/signing/revoke/${token}`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
      });
      loadSignatures();
    } catch (error) {
      console.error('Failed to revoke:', error);
    }
  };

  const filtered = signatures.filter((sig) => {
    const matchesFilter = filter === 'all' || (filter === 'valid' ? sig.isValid : !sig.isValid);
    const matchesSearch = !search || sig.documentType?.toLowerCase().includes(search.toLowerCase()) || sig.verificationToken?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (isLoading || loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa fa-pen-fancy" style={{ color: '#3b82f6' }}></i> Document Signatures
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Manage cryptographic signatures for educational documents</p>
        </div>
        <Link href="/super-admin/verification" style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
          <i className="fa fa-arrow-left"></i> Back to Verification
        </Link>
      </div>

      {/* Filters */}
      <div style={{ background: '#fefcf9', borderRadius: '12px', padding: '16px', border: '1px solid #f3f4f6', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search signatures..."
          style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '14px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'valid', 'revoked'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: filter === f ? '#3b82f6' : '#f3f4f6',
                color: filter === f ? 'white' : '#6b7280',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5efe8', borderBottom: '1px solid #e8ddd0' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Document</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Token</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Signer</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Signed At</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sig) => (
                <tr key={sig.id} style={{ borderBottom: '1px solid #f3f4f6' }} className="table-row">
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{sig.documentType}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{sig.documentId?.substring(0, 8)}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>{sig.verificationToken?.substring(0, 12)}...</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', color: '#1f2937' }}>{sig.signerRole}</div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280' }}>{new Date(sig.signedAt).toLocaleDateString()}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                      background: sig.isValid ? '#d1fae5' : '#fef2f2',
                      color: sig.isValid ? '#059669' : '#dc2626',
                    }}>
                      {sig.isValid ? 'Valid' : 'Revoked'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {sig.isValid && (
                      <button onClick={() => handleRevoke(sig.verificationToken)} style={{
                        padding: '6px 12px', borderRadius: '6px', border: 'none',
                        background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      }}>
                        <i className="fa fa-ban"></i> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No signatures found</div>
        )}
      </div>
    </div>
  );
}
