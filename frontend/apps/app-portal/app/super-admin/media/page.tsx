'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const gradPink = 'linear-gradient(135deg, #ec4899, #db2777)';
const gradCyan = 'linear-gradient(135deg, #06b6d4, #0891b2)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradAmber = 'linear-gradient(135deg, #f59e0b, #d97706)';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

async function api(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const base = apiBase || (typeof window !== 'undefined' ? window.location.origin.replace('app.', 'api.') : '');
  const res = await fetch(`${base}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await res.json();
  return data;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getTypeIcon(resourceType: string, format: string): string {
  if (resourceType === 'image') return 'fa-file-image';
  if (resourceType === 'raw' || resourceType === 'auto') {
    if (['pdf'].includes(format)) return 'fa-file-pdf';
    if (['doc', 'docx'].includes(format)) return 'fa-file-word';
    if (['xls', 'xlsx'].includes(format)) return 'fa-file-excel';
    return 'fa-file-alt';
  }
  return 'fa-file';
}

function getTypeColor(resourceType: string, format: string): string {
  if (resourceType === 'image') return gradCyan;
  if (format === 'pdf') return gradOrange;
  if (['doc', 'docx'].includes(format)) return gradBlue;
  if (['xls', 'xlsx'].includes(format)) return gradGreen;
  return gradPurple;
}

export default function MediaLibraryPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [media, setMedia] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [folderFilter, setFolderFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orphanLoading, setOrphanLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const folder = folderFilter !== 'all' ? folderFilter : undefined;
      const [mediaRes, statsRes] = await Promise.all([
        api(`/media?page=${page}&limit=20${folder ? `&folder=${encodeURIComponent(folder)}` : ''}`),
        api('/media/stats'),
      ]);
      setMedia(mediaRes?.data ?? mediaRes?.media ?? []);
      setTotalPages(mediaRes?.totalPages || mediaRes?.pagination?.totalPages || 1);
      setStats(statsRes?.data ?? statsRes);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, page, folderFilter]);

  useEffect(() => {
    setPage(1);
  }, [folderFilter]);

  const handleDelete = async (publicId: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api('/media', { method: 'DELETE', body: JSON.stringify({ publicId }) });
      loadData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} file(s)?`)) return;
    for (const publicId of selected) {
      await api('/media', { method: 'DELETE', body: JSON.stringify({ publicId }) });
    }
    setSelected(new Set());
    loadData();
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const handleOrphanCleanup = async () => {
    if (!window.confirm('Remove all orphaned Cloudinary files (files in DB but not in Cloudinary)?')) return;
    try {
      setOrphanLoading(true);
      const res = await api('/media/orphaned', { method: 'DELETE' });
      alert(`Cleanup complete. Removed ${res?.deleted || 0} orphaned records.`);
      loadData();
    } catch {
      alert('Cleanup failed');
    } finally {
      setOrphanLoading(false);
    }
  };

  const toggleSelect = (publicId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  };

  const getFolderNames = (): string[] => {
    const folders = new Set(media.map(m => m.folder).filter(Boolean));
    return ['all', ...Array.from(folders)];
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradPink, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-photo-video"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ec4899', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .media-card { transition: all 0.3s ease; cursor: pointer; }
        .media-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(236,72,153,0.12); }
        .media-card.selected { box-shadow: 0 0 0 2px #ec4899; }
        .folder-chip { transition: all 0.2s ease; cursor: pointer; }
        .folder-chip:hover { transform: translateY(-1px); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradPink, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-photo-video" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Media Library
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>
            {stats ? `${stats.totalFiles || 0} files · ${formatSize(stats.totalSize || stats.storageUsedMB * 1024 * 1024 || 0)} used` : 'Loading stats...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              style={{
                padding: '10px 20px', background: '#ef4444', color: 'white', border: 'none',
                borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <i className="fa fa-trash"></i>
              Delete {selected.size}
            </button>
          )}
          <button
            onClick={handleOrphanCleanup}
            disabled={orphanLoading}
            style={{
              padding: '10px 20px', background: 'white', color: '#ef4444', border: '1px solid #fecaca',
              borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', opacity: orphanLoading ? 0.6 : 1
            }}
          >
            <i className={`fa ${orphanLoading ? 'fa-spinner fa-spin' : 'fa-broom'}`}></i>
            Cleanup Orphaned
          </button>
          <button
            onClick={loadData}
            style={{
              padding: '10px 20px', background: 'white', color: '#6b7280', border: '1px solid #e8ddd0',
              borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <i className="fa fa-sync-alt"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Total Files', value: stats.totalFiles || 0, icon: 'fa-file-alt', color: gradBlue },
            { label: 'Storage Used', value: formatSize(stats.totalSize || 0), icon: 'fa-database', color: gradGreen },
            { label: 'Images', value: stats.images || 0, icon: 'fa-image', color: gradCyan },
            { label: 'Documents', value: stats.documents || 0, icon: 'fa-file-pdf', color: gradOrange },
          ].map(card => (
            <div key={card.label} style={{
              background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
              display: 'flex', alignItems: 'center', gap: '16px'
            }}>
              <div style={{
                width: '44px', height: '44px', background: card.color,
                borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <i className={`fa ${card.icon}`} style={{ fontSize: '18px', color: 'white' }}></i>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px', fontWeight: 500 }}>{card.label}</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Folder Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {getFolderNames().map(folder => (
          <button
            key={folder}
            className="folder-chip"
            onClick={() => setFolderFilter(folder)}
            style={{
              padding: '8px 18px', borderRadius: '24px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              background: folderFilter === folder ? gradPink : 'white',
              color: folderFilter === folder ? 'white' : '#6b7280',
              boxShadow: folderFilter === folder ? '0 2px 8px rgba(236,72,153,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
              border: folderFilter === folder ? 'none' : '1px solid #e8ddd0',
              textTransform: 'capitalize'
            }}
          >
            {folder === 'all' ? 'All Folders' : folder.split('/').pop()?.replace(/-/g, ' ') || folder}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {media.map((item) => {
          const isSelected = selected.has(item.publicId);
          const isImage = item.resourceType === 'image';
          return (
            <div
              key={item.publicId || item.id}
              className={`media-card${isSelected ? ' selected' : ''}`}
              onClick={() => handleCopyUrl(item.secureUrl || item.url)}
              style={{
                background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* Select checkbox */}
              <div
                onClick={(e) => { e.stopPropagation(); toggleSelect(item.publicId); }}
                style={{
                  position: 'absolute', top: '10px', right: '10px', zIndex: 2,
                  width: '24px', height: '24px', borderRadius: '6px',
                  background: isSelected ? '#ec4899' : 'rgba(255,255,255,0.9)',
                  border: isSelected ? 'none' : '2px solid #d1d5db',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                {isSelected && <i className="fa fa-check" style={{ fontSize: '12px', color: 'white' }}></i>}
              </div>

              {/* Preview */}
              <div style={{
                height: '160px',
                background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: '1px solid #f3f4f6', overflow: 'hidden'
              }}>
                {isImage && (item.secureUrl || item.url) ? (
                  <img
                    src={item.secureUrl || item.url}
                    alt={item.publicId}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div style={{
                    width: '64px', height: '64px',
                    background: getTypeColor(item.resourceType, item.format),
                    borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                  }}>
                    <i className={`fa ${getTypeIcon(item.resourceType, item.format)}`} style={{ fontSize: '28px', color: 'white' }}></i>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{
                    padding: '3px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.3px',
                    background: '#fdf2f8', color: '#db2777'
                  }}>
                    {item.format || item.resourceType}
                  </span>
                </div>
                <p style={{
                  fontSize: '13px', fontWeight: 600, color: '#1f2937', margin: '0 0 6px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {item.publicId?.split('/').pop() || item.name || 'Untitled'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#9ca3af' }}>
                  <span>{formatSize(item.size || 0)}</span>
                  <span>·</span>
                  <span>{item.folder ? item.folder.split('/').pop() : '-'}</span>
                  <span>·</span>
                  <span>{formatDate(item.createdAt || item.uploadedAt)}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(item.secureUrl || item.url, '_blank'); }}
                    style={{
                      flex: 1, padding: '6px 10px', background: '#fefcf9', color: '#3b82f6',
                      border: '1px solid #dbeafe', borderRadius: '8px', fontSize: '11px',
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <i className="fa fa-download" style={{ marginRight: '4px' }}></i> Open
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.publicId, item.publicId); }}
                    style={{
                      flex: 1, padding: '6px 10px', background: '#fefcf9', color: '#ef4444',
                      border: '1px solid #fecaca', borderRadius: '8px', fontSize: '11px',
                      fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <i className="fa fa-trash" style={{ marginRight: '4px' }}></i> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {media.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px 20px' }}>
            <i className="fa fa-photo-video" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px', display: 'block' }}></i>
            <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 4px' }}>No media files found</p>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Upload files via the API or dashboard to see them here</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #e8ddd0',
              background: 'white', color: '#6b7280', cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1, fontSize: '13px'
            }}
          >
            <i className="fa fa-chevron-left"></i> Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 3, totalPages - 6));
            const p = start + i;
            if (p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: '36px', height: '36px', borderRadius: '8px', border: 'none',
                  background: p === page ? gradPink : 'white',
                  color: p === page ? 'white' : '#6b7280',
                  cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                  boxShadow: p === page ? '0 2px 8px rgba(236,72,153,0.3)' : '0 1px 3px rgba(0,0,0,0.06)'
                }}
              >
                {p}
              </button>
            );
          })}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid #e8ddd0',
              background: 'white', color: '#6b7280', cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.5 : 1, fontSize: '13px'
            }}
          >
            Next <i className="fa fa-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}
