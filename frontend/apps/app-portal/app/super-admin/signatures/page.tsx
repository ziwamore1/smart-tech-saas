'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi } from '@/lib/api';

const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradIndigo = 'linear-gradient(135deg, #6366f1, #4f46e5)';

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: '#10b981' },
  REVOKED: { label: 'Revoked', color: '#ef4444' },
  SUSPENDED: { label: 'Suspended', color: '#f59e0b' },
  ARCHIVED: { label: 'Archived', color: '#6b7280' },
};

interface Signature {
  id: string;
  name: string;
  title?: string;
  email?: string;
  isDefault: boolean;
  scope?: string;
  status?: string;
  revokedReason?: string;
  createdAt: string;
  school?: { id: string; name: string };
  schoolName?: string;
}

export default function SignaturesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSignatures();
    }
  }, [isAuthenticated, filterScope, filterStatus]);

  const loadSignatures = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filterScope) params.scope = filterScope;
      if (filterStatus) params.status = filterStatus;
      if (search.trim()) params.search = search.trim();
      const response = await templateBuilderApi.getSignatures(Object.keys(params).length ? params : undefined);
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

  const handleRevoke = async (signature: Signature) => {
    const reason = window.prompt(`Reason for revoking "${signature.name}"?`, 'No longer valid');
    if (reason === null) return;
    try {
      await templateBuilderApi.setSignatureStatus(signature.id, 'REVOKED', reason);
      loadSignatures();
    } catch (error) {
      console.error('Failed to revoke signature:', error);
      alert('Failed to revoke signature.');
    }
  };

  const handleRestore = async (signature: Signature) => {
    if (!window.confirm(`Restore the signature "${signature.name}" to Active?`)) return;
    try {
      await templateBuilderApi.setSignatureStatus(signature.id, 'ACTIVE');
      loadSignatures();
    } catch (error) {
      console.error('Failed to restore signature:', error);
      alert('Failed to restore signature.');
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

  const normalized = signatures.map(s => ({ ...s, status: s.status || 'ACTIVE', scope: s.scope || 'SCHOOL' }));
  const filtered = normalized
    .filter(s => (filterScope ? s.scope === filterScope : true))
    .filter(s => (filterStatus ? s.status === filterStatus : true));
  const platformCount = normalized.filter(s => s.scope === 'PLATFORM').length;
  const revokedCount = normalized.filter(s => s.status === 'REVOKED').length;
  const defaultCount = normalized.filter(s => s.isDefault).length;

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
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage all digital signatures across schools and the platform</p>
        </div>
        <button
          onClick={() => router.push('/super-admin/signatures/designer')}
          style={{ padding: '12px 20px', background: gradIndigo, color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
        >
          <i className="fa fa-paint-brush"></i>
          Platform Designer
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Signatures</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{normalized.length}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Platform Signatures</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#6d28d9', margin: 0 }}>{platformCount}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Default Signatures</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{defaultCount}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Revoked</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444', margin: 0 }}>{revokedCount}</p>
        </div>
      </div>

      {/* Toolbar: search + filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <i className="fa fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#9ca3af' }}></i>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') loadSignatures(); }}
            onBlur={() => loadSignatures()}
            placeholder="Search signatures…"
            style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={filterScope}
            onChange={e => setFilterScope(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '13px', background: '#fefcf9', outline: 'none' }}
          >
            <option value="">All Scopes</option>
            <option value="SCHOOL">School</option>
            <option value="PLATFORM">Platform</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '13px', background: '#fefcf9', outline: 'none' }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="REVOKED">Revoked</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
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
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scope / Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Default</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sig) => {
                const status = STATUS_META[sig.status] || { label: sig.status, color: '#6b7280' };
                return (
                  <tr key={sig.id} className="sig-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          background: sig.scope === 'PLATFORM' ? 'linear-gradient(135deg, #ede9fe, #ddd6fe)' : 'linear-gradient(135deg, #ccfbf1, #99f6e4)',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <i className="fa fa-pen" style={{ fontSize: '16px', color: sig.scope === 'PLATFORM' ? '#6d28d9' : '#0d9488' }}></i>
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{sig.name}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa fa-building" style={{ fontSize: '10px' }}></i>
                            {sig.scope === 'PLATFORM' ? 'Platform (all schools)' : sig.school?.name || (sig as any).schoolName || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{sig.title || '-'}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', background: sig.scope === 'PLATFORM' ? '#ede9fe' : '#f3f4f6', color: sig.scope === 'PLATFORM' ? '#6d28d9' : '#6b7280' }}>
                          {sig.scope === 'PLATFORM' ? 'Platform' : 'School'}
                        </span>
                        <span style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', background: status.color + '15', color: status.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.color }}></span>
                          {status.label}
                        </span>
                      </div>
                      {sig.revokedReason && (
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                          <i className="fa fa-info-circle" style={{ fontSize: '9px', marginRight: '3px' }}></i>
                          {sig.revokedReason}
                        </div>
                      )}
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
                        {sig.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleRevoke(sig)}
                            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: '#fef2f2', color: '#dc2626', borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <i className="fa fa-ban" style={{ fontSize: '10px' }}></i>
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestore(sig)}
                            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, background: '#d1fae5', color: '#065f46', borderRadius: '8px', border: '1px solid #a7f3d0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <i className="fa fa-undo" style={{ fontSize: '10px' }}></i>
                            Restore
                          </button>
                        )}
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
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <i className="fa fa-pen" style={{ fontSize: '32px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No digital signatures found</p>
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0 0' }}>Adjust your filters or create a platform signature in the Designer</p>
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