'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { stampApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradPink = 'linear-gradient(135deg, #ec4899, #db2777)';
const gradAmber = 'linear-gradient(135deg, #f59e0b, #d97706)';
const gradIndigo = 'linear-gradient(135deg, #6366f1, #4f46e5)';

const STAMP_TYPES = [
  { value: '', label: 'All Types', color: '#6b7280' },
  { value: 'Official School', label: 'Official School', color: '#3b82f6' },
  { value: 'Principal', label: 'Principal', color: '#8b5cf6' },
  { value: 'Examination', label: 'Examination', color: '#ef4444' },
  { value: 'Registrar', label: 'Registrar', color: '#0d9488' },
  { value: 'Paid', label: 'Paid', color: '#10b981' },
  { value: 'Approved', label: 'Approved', color: '#059669' },
  { value: 'Verified', label: 'Verified', color: '#3b82f6' },
  { value: 'Confidential', label: 'Confidential', color: '#dc2626' },
  { value: 'Ministry', label: 'Ministry', color: '#1f2937' },
  { value: 'Department', label: 'Department', color: '#f59e0b' },
  { value: 'Custom', label: 'Custom', color: '#ec4899' },
];

const SHAPES = ['Circular', 'Rectangular', 'Square', 'Oval'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: '#10b981' },
  REVOKED: { label: 'Revoked', color: '#ef4444' },
  SUSPENDED: { label: 'Suspended', color: '#f59e0b' },
  ARCHIVED: { label: 'Archived', color: '#6b7280' },
};

interface Stamp {
  id: string;
  name: string;
  type: string;
  shape?: string;
  svgContent?: string;
  imageUrl?: string;
  opacity?: number;
  width?: number;
  height?: number;
  isDefault: boolean;
  isActive?: boolean;
  scope?: string;
  status?: string;
  revokedReason?: string;
  createdAt: string;
  school?: { id: string; name: string };
}

export default function StampsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'Official School',
    shape: 'Circular',
    opacity: 100,
    width: 120,
    height: 120,
    isDefault: false,
    svgContent: '',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStamps();
    }
  }, [isAuthenticated, filterType, filterScope, filterStatus]);

  const loadStamps = async () => {
    try {
      setLoading(true);
      setError('');
      const params: Record<string, string> = {};
      if (filterType) params.type = filterType;
      if (filterScope) params.scope = filterScope;
      if (filterStatus) params.status = filterStatus;
      const response = await stampApi.getStamps(Object.keys(params).length ? params : undefined);
      setStamps(response.data?.data || response.data || []);
    } catch (err) {
      console.error('Failed to load stamps:', err);
      setError('Failed to load stamps. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the stamp "${name}"?`)) return;
    try {
      await stampApi.deleteStamp(id);
      loadStamps();
    } catch (err) {
      console.error('Failed to delete stamp:', err);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await stampApi.duplicateStamp(id);
      loadStamps();
    } catch (err) {
      console.error('Failed to duplicate stamp:', err);
    }
  };

  const handleRevoke = async (stamp: Stamp) => {
    const reason = window.prompt(`Reason for revoking "${stamp.name}"?`, 'No longer valid');
    if (reason === null) return;
    try {
      await stampApi.setStampStatus(stamp.id, 'REVOKED', reason);
      loadStamps();
    } catch (err) {
      console.error('Failed to revoke stamp:', err);
      alert('Failed to revoke stamp.');
    }
  };

  const handleRestore = async (stamp: Stamp) => {
    if (!window.confirm(`Restore the stamp "${stamp.name}" to Active?`)) return;
    try {
      await stampApi.setStampStatus(stamp.id, 'ACTIVE');
      loadStamps();
    } catch (err) {
      console.error('Failed to restore stamp:', err);
      alert('Failed to restore stamp.');
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      alert('Please enter a stamp name.');
      return;
    }
    try {
      setCreating(true);
      await stampApi.createStamp({
        name: form.name,
        type: form.type,
        shape: form.shape,
        opacity: form.opacity / 100,
        width: form.width,
        height: form.height,
        isDefault: form.isDefault,
        svgContent: form.svgContent || undefined,
      });
      setShowCreateModal(false);
      setForm({
        name: '',
        type: 'Official School',
        shape: 'Circular',
        opacity: 100,
        width: 120,
        height: 120,
        isDefault: false,
        svgContent: '',
      });
      loadStamps();
    } catch (err) {
      console.error('Failed to create stamp:', err);
      alert('Failed to create stamp. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const typeInfo = (t: string) => STAMP_TYPES.find(s => s.value === t) || { color: '#6b7280', label: t };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-stamp"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const filtered = stamps
    .filter(s => (filterType ? s.type === filterType : true))
    .filter(s => (filterScope ? (s.scope || 'SCHOOL') === filterScope : true))
    .filter(s => (filterStatus ? (s.status || 'ACTIVE') === filterStatus : true));
  const totalStamps = stamps.length;
  const typesAvailable = new Set(stamps.map(s => s.type)).size;
  const activeStamps = stamps.filter(s => (s.status || 'ACTIVE') === 'ACTIVE').length;
  const revokedStamps = stamps.filter(s => s.status === 'REVOKED').length;
  const platformStamps = stamps.filter(s => s.scope === 'PLATFORM').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .stamp-card { transition: all 0.2s ease; }
        .stamp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-stamp" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Stamp Management
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage all digital stamps across schools and the platform</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/super-admin/stamps/designer')}
            style={{ padding: '12px 20px', background: gradIndigo, color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
          >
            <i className="fa fa-paint-brush"></i>
            Platform Designer
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{ padding: '12px 24px', background: gradOrange, color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(234,102,69,0.3)' }}
          >
            <i className="fa fa-plus"></i>
            Create Stamp
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Stamps</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{totalStamps}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Platform Stamps</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#7c3aed', margin: 0 }}>{platformStamps}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Active Stamps</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#10b981', margin: 0 }}>{activeStamps}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Types / Revoked</p>
          <p style={{ fontSize: '22px', fontWeight: 700, color: '#ef4444', margin: 0 }}>{typesAvailable} · {revokedStamps}</p>
        </div>
      </div>

      {/* Scope + Status Filters */}
      {filterScope !== '' || filterStatus !== '' || (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '4px' }}>Scope:</span>
          {[['', 'All'], ['SCHOOL', 'Schools'], ['PLATFORM', 'Platform']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilterScope(value)}
              style={{ padding: '6px 14px', borderRadius: '16px', border: filterScope === value ? '2px solid #7c3aed' : '1px solid #e8ddd0', background: filterScope === value ? '#ede9fe' : 'white', color: filterScope === value ? '#7c3aed' : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '4px' }}>Status:</span>
        {[['', 'All'], ['ACTIVE', 'Active'], ['REVOKED', 'Revoked'], ['SUSPENDED', 'Suspended'], ['ARCHIVED', 'Archived']].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilterStatus(value)}
            style={{ padding: '6px 14px', borderRadius: '16px', border: filterStatus === value ? '2px solid ' + (STATUS_META[value]?.color || '#6b7280') : '1px solid #e8ddd0', background: filterStatus === value ? (STATUS_META[value]?.color || '#6b7280') + '15' : 'white', color: filterStatus === value ? (STATUS_META[value]?.color || '#6b7280') : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Type Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {STAMP_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setFilterType(t.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: filterType === t.value ? '2px solid ' + t.color : '1px solid #e8ddd0',
              background: filterType === t.value ? t.color + '15' : 'white',
              color: filterType === t.value ? t.color : '#6b7280',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: filterType === t.value ? 600 : 500,
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Stamps Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', borderRadius: '14px', padding: '24px', textAlign: 'center', border: '1px solid #fecaca' }}>
          <i className="fa fa-exclamation-circle" style={{ fontSize: '32px', color: '#ef4444', marginBottom: '12px', display: 'block' }}></i>
          <p style={{ fontSize: '14px', color: '#dc2626', margin: 0 }}>{error}</p>
          <button onClick={loadStamps} style={{ marginTop: '12px', padding: '8px 20px', background: gradOrange, color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '48px', textAlign: 'center', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <i className="fa fa-stamp" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px', display: 'block' }}></i>
          <p style={{ fontSize: '16px', color: '#6b7280', margin: 0 }}>No stamps found</p>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0 0' }}>Adjust your filters or create your first stamp</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {filtered.map(stamp => {
            const status = STATUS_META[stamp.status || 'ACTIVE'] || { label: stamp.status || 'Active', color: '#6b7280' };
            return (
              <div key={stamp.id} className="stamp-card" style={{ background: '#fefcf9', borderRadius: '16px', border: stamp.status === 'REVOKED' ? '1px solid #fecaca' : '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {/* SVG Preview */}
                <div style={{
                  background: '#f5efe8',
                  padding: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '160px',
                  borderBottom: '1px solid #f3f4f6',
                }}>
                  {stamp.svgContent ? (
                    <div
                      style={{
                        width: stamp.width || 120,
                        height: stamp.height || 120,
                        opacity: stamp.opacity ?? 1,
                      }}
                      dangerouslySetInnerHTML={{ __html: stamp.svgContent }}
                    />
                  ) : (
                    <div style={{
                      width: stamp.width || 100,
                      height: stamp.height || 100,
                      borderRadius: stamp.shape === 'Circular' ? '50%' : stamp.shape === 'Oval' ? '50%' : stamp.shape === 'Square' ? '8px' : '4px',
                      background: 'linear-gradient(135deg, #e8ddd0, #d1d5db)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6b7280',
                      fontSize: '11px',
                      fontWeight: 600,
                      textAlign: 'center',
                      padding: '8px',
                      opacity: stamp.opacity ?? 1,
                    }}>
                      {stamp.name}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{stamp.name}</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {stamp.isDefault && (
                        <span style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600, borderRadius: '4px', background: '#d1fae5', color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <i className="fa fa-check-circle" style={{ fontSize: '8px' }}></i>
                          Default
                        </span>
                      )}
                      {stamp.scope === 'PLATFORM' && (
                        <span style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600, borderRadius: '4px', background: '#ede9fe', color: '#6d28d9', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <i className="fa fa-globe" style={{ fontSize: '8px' }}></i>
                          Platform
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', background: typeInfo(stamp.type).color + '15', color: typeInfo(stamp.type).color }}>
                      {stamp.type}
                    </span>
                    {stamp.shape && (
                      <span style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px', background: '#f3f4f6', color: '#6b7280' }}>
                        {stamp.shape}
                      </span>
                    )}
                    <span style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', background: status.color + '15', color: status.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: status.color }}></span>
                      {status.label}
                    </span>
                  </div>

                  {stamp.revokedReason && (
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px', lineHeight: 1.4 }}>
                      <i className="fa fa-info-circle" style={{ fontSize: '9px', marginRight: '3px' }}></i>
                      {stamp.revokedReason}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      <i className="fa fa-building" style={{ fontSize: '9px', marginRight: '3px' }}></i>
                      {stamp.scope === 'PLATFORM' ? 'Platform (all schools)' : stamp.school?.name || '—'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                    {(stamp.status || 'ACTIVE') === 'ACTIVE' ? (
                      <button
                        onClick={() => handleRevoke(stamp)}
                        style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: '#fef2f2', color: '#dc2626', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        title="Revoke"
                      >
                        <i className="fa fa-ban" style={{ fontSize: '10px' }}></i>
                        Revoke
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestore(stamp)}
                        style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: '#d1fae5', color: '#065f46', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        title="Restore"
                      >
                        <i className="fa fa-undo" style={{ fontSize: '10px' }}></i>
                        Restore
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicate(stamp.id)}
                      style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: '#f3f4f6', color: '#374151', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      title="Duplicate"
                    >
                      <i className="fa fa-copy" style={{ fontSize: '10px' }}></i>
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDelete(stamp.id, stamp.name)}
                      style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600, background: '#fef2f2', color: '#dc2626', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      title="Delete"
                    >
                      <i className="fa fa-trash" style={{ fontSize: '10px' }}></i>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Stamp Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)', padding: '20px',
        }} onClick={() => !creating && setShowCreateModal(false)}>
          <div style={{
            background: '#fefcf9', borderRadius: '20px', padding: '32px',
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', background: gradOrange, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa fa-stamp" style={{ fontSize: '16px', color: 'white' }}></i>
                </div>
                Create Stamp
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: creating ? 0.5 : 1 }}
              >
                <i className="fa fa-times" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Official School Stamp"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', outline: 'none', background: '#fefcf9' }}
                  >
                    {STAMP_TYPES.filter(t => t.value).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Shape</label>
                  <select
                    value={form.shape}
                    onChange={e => setForm(f => ({ ...f, shape: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', outline: 'none', background: '#fefcf9' }}
                  >
                    {SHAPES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Width (px)</label>
                  <input
                    type="number"
                    value={form.width}
                    onChange={e => setForm(f => ({ ...f, width: Number(e.target.value) }))}
                    min={20}
                    max={500}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Height (px)</label>
                  <input
                    type="number"
                    value={form.height}
                    onChange={e => setForm(f => ({ ...f, height: Number(e.target.value) }))}
                    min={20}
                    max={500}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Opacity: {form.opacity}%</label>
                <input
                  type="range"
                  value={form.opacity}
                  onChange={e => setForm(f => ({ ...f, opacity: Number(e.target.value) }))}
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                  id="isDefault"
                  style={{ width: '18px', height: '18px', accentColor: '#ea6645' }}
                />
                <label htmlFor="isDefault" style={{ fontSize: '14px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
                  Set as default stamp
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  SVG Content <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional - for custom SVG)</span>
                </label>
                <textarea
                  value={form.svgContent}
                  onChange={e => setForm(f => ({ ...f, svgContent: e.target.value }))}
                  placeholder={`<svg viewBox="0 0 100 100">...</svg>`}
                  rows={4}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              {/* Preview */}
              {form.svgContent && (
                <div style={{ background: '#f5efe8', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div
                    style={{ width: form.width, height: form.height, opacity: form.opacity / 100 }}
                    dangerouslySetInnerHTML={{ __html: form.svgContent }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e8ddd0' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fefcf9', color: '#6b7280', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: creating ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: gradOrange, color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: creating ? 0.7 : 1 }}
              >
                {creating ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="fa fa-plus"></i>
                    Create Stamp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}