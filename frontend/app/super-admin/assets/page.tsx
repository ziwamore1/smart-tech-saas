'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradCyan = 'linear-gradient(135deg, #06b6d4, #0891b2)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';

interface Asset {
  id: string;
  name: string;
  type: string;
  size?: number;
  url?: string;
  createdAt: string;
}

const assetTypes = ['all', 'logo', 'background', 'stamp', 'signature', 'icon', 'image', 'font'];

const typeIcons: Record<string, string> = {
  logo: 'fa-image',
  background: 'fa-image',
  stamp: 'fa-stamp',
  signature: 'fa-pen',
  icon: 'fa-icons',
  image: 'fa-file-image',
  font: 'fa-font',
};

const typeColors: Record<string, string> = {
  logo: gradBlue,
  background: gradGreen,
  stamp: gradPurple,
  signature: 'linear-gradient(135deg, #f59e0b, #d97706)',
  icon: gradCyan,
  image: 'linear-gradient(135deg, #ec4899, #db2777)',
  font: 'linear-gradient(135deg, #64748b, #475569)',
};

export default function AssetsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadAssets();
    }
  }, [isAuthenticated]);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const params = typeFilter !== 'all' ? { type: typeFilter } : undefined;
      const response = await templateBuilderApi.getAssets(params);
      setAssets(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAssets();
    }
  }, [typeFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the asset "${name}"?`)) return;
    try {
      await templateBuilderApi.deleteAsset(id);
      loadAssets();
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradCyan, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-cloud-upload-alt"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .asset-card { transition: all 0.3s ease; }
        .asset-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(6,182,212,0.12); }
        .type-chip { transition: all 0.2s ease; cursor: pointer; }
        .type-chip:hover { transform: translateY(-1px); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradCyan, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-cloud-upload-alt" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Cloud Assets
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage all uploaded cloud assets</p>
        </div>
      </div>

      {/* Type Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {assetTypes.map(type => (
          <button
            key={type}
            className="type-chip"
            onClick={() => setTypeFilter(type)}
            style={{
              padding: '8px 18px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: typeFilter === type ? gradCyan : 'white',
              color: typeFilter === type ? 'white' : '#6b7280',
              boxShadow: typeFilter === type ? '0 2px 8px rgba(6,182,212,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
              border: typeFilter === type ? 'none' : '1px solid #e8ddd0',
              textTransform: 'capitalize',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {type !== 'all' && <i className={`fa ${typeIcons[type] || 'fa-file'}`} style={{ fontSize: '11px' }}></i>}
            {type === 'all' ? 'All Types' : type}
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="asset-card"
            style={{
              background: '#fefcf9',
              borderRadius: '14px',
              border: '1px solid #f3f4f6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              overflow: 'hidden'
            }}
          >
            {/* Preview Area */}
            <div style={{
              height: '120px',
              background: 'linear-gradient(135deg, #f0fdfa, #ecfeff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid #f3f4f6'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                background: typeColors[asset.type?.toLowerCase()] || gradCyan,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}>
                <i className={`fa ${typeIcons[asset.type?.toLowerCase()] || 'fa-file'}`} style={{ fontSize: '24px', color: 'white' }}></i>
              </div>
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {asset.name}
                </h3>
                <span style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  background: '#ecfeff',
                  color: '#0891b2',
                  marginLeft: '8px',
                  flexShrink: 0
                }}>
                  {asset.type}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <i className="fa fa-database" style={{ fontSize: '11px', color: '#9ca3af' }}></i>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{formatSize(asset.size)}</span>
              </div>
              <button
                onClick={() => handleDelete(asset.id, asset.name)}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  background: '#fefcf9',
                  color: '#ef4444',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#fecaca'; }}
              >
                <i className="fa fa-trash" style={{ fontSize: '11px' }}></i>
                Delete
              </button>
            </div>
          </div>
        ))}
        {assets.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' }}>
            <i className="fa fa-cloud-upload-alt" style={{ fontSize: '40px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No assets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
