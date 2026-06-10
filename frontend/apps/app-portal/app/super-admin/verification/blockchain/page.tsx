'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BlockchainPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadCertificates();
  }, [isAuthenticated]);

  const loadCertificates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/blockchain/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setCertificates(data.certificates || []);
    } catch (error) {
      console.error('Failed to load blockchain certs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNetworkColor = (network: string) => {
    switch (network?.toUpperCase()) {
      case 'POLYGON': return { bg: '#ede9fe', text: '#7c3aed' };
      case 'ETHEREUM': return { bg: '#dbeafe', text: '#2563eb' };
      case 'BINANCE_SMART_CHAIN': return { bg: '#fef3c7', text: '#d97706' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const filtered = certificates.filter((cert) => {
    if (filter === 'all') return true;
    return cert.blockchainNetwork?.toUpperCase() === filter.toUpperCase();
  });

  if (isLoading || loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa fa-link" style={{ color: '#8b5cf6' }}></i> Blockchain Certificates
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Immutable certificate records on the blockchain</p>
        </div>
        <Link href="/super-admin/verification" style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
          <i className="fa fa-arrow-left"></i> Back
        </Link>
      </div>

      {/* Network Filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['all', 'POLYGON', 'ETHEREUM', 'BINANCE_SMART_CHAIN'].map((f) => {
          const colors = f !== 'all' ? getNetworkColor(f) : null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: filter === f ? '#8b5cf6' : colors ? colors.bg : '#f3f4f6',
                color: filter === f ? 'white' : colors ? colors.text : '#6b7280',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'All Networks' : f.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {filtered.map((cert) => (
          <div key={cert.id} style={{
            background: '#fefcf9', borderRadius: '16px', padding: '20px',
            border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', background: '#ede9fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-cube" style={{ fontSize: '20px', color: '#8b5cf6' }}></i>
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{cert.blockchainNetwork?.replace(/_/g, ' ')}</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{new Date(cert.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '10px', background: '#f5efe8', borderRadius: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' }}>Transaction Hash</p>
                <p style={{ fontSize: '12px', color: '#1f2937', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>{cert.transactionHash}</p>
              </div>
              <div style={{ padding: '10px', background: '#f5efe8', borderRadius: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' }}>Certificate Hash</p>
                <p style={{ fontSize: '12px', color: '#1f2937', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>{cert.certificateHash}</p>
              </div>
              {cert.smartContract && (
                <div style={{ padding: '10px', background: '#f5efe8', borderRadius: '8px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase' }}>Smart Contract</p>
                  <p style={{ fontSize: '12px', color: '#1f2937', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>{cert.smartContract}</p>
                </div>
              )}
            </div>

            {cert.verificationUrl && (
              <a href={cert.verificationUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', marginTop: '16px', padding: '10px', background: '#ede9fe',
                borderRadius: '8px', textAlign: 'center', textDecoration: 'none',
                fontSize: '13px', fontWeight: 600, color: '#7c3aed',
              }}>
                <i className="fa fa-external-link-alt"></i> Verify on Explorer
              </a>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '40px', textAlign: 'center', border: '1px solid #f3f4f6' }}>
          <i className="fa fa-link" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px' }}></i>
          <p style={{ fontSize: '16px', color: '#9ca3af' }}>No blockchain certificates found</p>
        </div>
      )}
    </div>
  );
}
