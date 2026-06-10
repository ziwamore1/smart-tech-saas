'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';

interface Signature {
  id: string;
  name: string;
  title?: string;
  email?: string;
  isDefault: boolean;
  createdAt: string;
  school?: { id: string; name: string };
  schoolName?: string;
}

export default function SignaturesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSignatures();
    }
  }, [isAuthenticated]);

  const loadSignatures = async () => {
    try {
      setLoading(true);
      const response = await templateBuilderApi.getSignatures();
      setSignatures(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load signatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the signature "${name}"?`)) return;
    try {
      await templateBuilderApi.deleteSignature(id);
      loadSignatures();
    } catch (error) {
      console.error('Failed to delete signature:', error);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradTeal, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-pen"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#0d9488', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .sig-row { transition: all 0.2s ease; }
        .sig-row:hover { background: #f5efe8; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradTeal, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-pen" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Digital Signatures
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage all digital signatures across schools</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Signatures</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{signatures.length}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Default Signatures</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{signatures.filter(s => s.isDefault).length}</p>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #f5efe8, #f3f4f6)', borderBottom: '1px solid #e8ddd0' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Default</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {signatures.map((sig) => (
                <tr key={sig.id} className="sig-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'linear-gradient(135deg, #ccfbf1, #99f6e4)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <i className="fa fa-pen" style={{ fontSize: '16px', color: '#0d9488' }}></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{sig.name}</div>
                        {sig.school && (
                          <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa fa-building" style={{ fontSize: '10px' }}></i>
                            {sig.school.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>{sig.title || '-'}</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>{sig.email || '-'}</span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {sig.isDefault ? (
                      <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', background: '#d1fae5', color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa fa-check-circle" style={{ fontSize: '10px' }}></i>
                        Default
                      </span>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#9ca3af' }}>No</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>
                      {sig.createdAt ? new Date(sig.createdAt).toLocaleDateString() : '-'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleDelete(sig.id, sig.name)}
                        style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <i className="fa fa-trash" style={{ fontSize: '10px' }}></i>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {signatures.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <i className="fa fa-pen" style={{ fontSize: '32px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No digital signatures found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
