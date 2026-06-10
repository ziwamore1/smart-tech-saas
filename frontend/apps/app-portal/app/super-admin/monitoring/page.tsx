'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradCyan = 'linear-gradient(135deg, #06b6d4, #0891b2)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradAmber = 'linear-gradient(135deg, #f59e0b, #d97706)';

interface MediaItem {
  id: string;
  filename: string;
  type: string;
  size: number;
  createdAt: string;
}

interface MediaStats {
  totalFiles: number;
  totalStorage: number;
  creditsUsed: number;
}

interface HealthStatus {
  status: string;
  [key: string]: any;
}

export default function MonitoringPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mediaStats, setMediaStats] = useState<MediaStats | null>(null);
  const [recentUploads, setRecentUploads] = useState<MediaItem[]>([]);
  const [cloudinaryHealth, setCloudinaryHealth] = useState<string>('checking');
  const [redisHealth, setRedisHealth] = useState<string>('checking');
  const [databaseHealth, setDatabaseHealth] = useState<string>('checking');
  const [redisConnected, setRedisConnected] = useState(false);
  const [systemUptime, setSystemUptime] = useState<'Healthy' | 'Issues'>('Healthy');
  const [cleaningOrphaned, setCleaningOrphaned] = useState(false);
  const [orphanedMessage, setOrphanedMessage] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setOrphanedMessage('');

      const [statsRes, mediaRes, healthRes] = await Promise.allSettled([
        api.get('/media/stats'),
        api.get('/media', { params: { limit: 10 } }),
        api.get('/health'),
      ]);

      if (statsRes.status === 'fulfilled') {
        setMediaStats(statsRes.value.data?.data || statsRes.value.data || null);
      } else {
        console.error('Failed to load media stats:', statsRes.reason);
      }

      if (mediaRes.status === 'fulfilled') {
        const data = mediaRes.value.data?.data || mediaRes.value.data || [];
        setRecentUploads(Array.isArray(data) ? data : data.media || []);
      } else {
        console.error('Failed to load recent uploads:', mediaRes.reason);
      }

      if (healthRes.status === 'fulfilled') {
        const health = healthRes.value.data?.data || healthRes.value.data || {};
        setCloudinaryHealth(health.cloudinary === 'ok' || health.cloudinary?.status === 'ok' ? 'healthy' : 'unhealthy');
        setRedisHealth(health.redis === 'ok' || health.redis?.status === 'ok' ? 'healthy' : 'unhealthy');
        setDatabaseHealth(health.database === 'ok' || health.database?.status === 'ok' ? 'healthy' : 'unhealthy');
        setRedisConnected(health.redis === 'ok' || health.redis?.status === 'ok');
        if (health.cloudinary === 'ok' && health.redis === 'ok' && health.database === 'ok') {
          setSystemUptime('Healthy');
        } else {
          setSystemUptime('Issues');
        }
      } else {
        console.error('Failed to load health:', healthRes.reason);
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
    }
  }, [isAuthenticated, fetchAll]);

  const handleOrphanedCleanup = async () => {
    if (!window.confirm('Are you sure you want to run orphaned cleanup? This will delete unused media files.')) return;
    try {
      setCleaningOrphaned(true);
      setOrphanedMessage('');
      const res = await api.delete('/media/orphaned');
      const msg = res.data?.message || res.data?.data?.message || 'Orphaned cleanup completed successfully';
      setOrphanedMessage(msg);
    } catch (error) {
      console.error('Orphaned cleanup failed:', error);
      setOrphanedMessage('Orphaned cleanup failed');
    } finally {
      setCleaningOrphaned(false);
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

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const storagePercent = mediaStats
    ? Math.min(Math.round((mediaStats.totalStorage / (1024 * 1024 * 1024)) * 100), 100)
    : 0;

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradCyan, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-chart-line"></i>
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
        .monitor-card { transition: all 0.3s ease; }
        .monitor-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(6,182,212,0.12); }
        .action-btn { transition: all 0.2s ease; }
        .action-btn:hover { transform: translateY(-1px); }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: gradCyan, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-chart-line" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Monitoring Dashboard
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>System health and performance overview</p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Redis Status */}
        <div className="monitor-card" style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
              <i className="fa fa-database" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Redis Status</p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                {redisConnected ? <span style={{ color: '#10b981' }}>Connected ✓</span> : <span style={{ color: '#ef4444' }}>Disconnected ✗</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Cloudinary Storage */}
        <div className="monitor-card" style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', background: gradCyan, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(6,182,212,0.2)' }}>
              <i className="fa fa-cloud" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Cloudinary Storage</p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                {mediaStats ? formatSize(mediaStats.totalStorage) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Total Files */}
        <div className="monitor-card" style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', background: gradBlue, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.2)' }}>
              <i className="fa fa-file-alt" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Files</p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                {mediaStats ? mediaStats.totalFiles.toLocaleString() : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* System Uptime */}
        <div className="monitor-card" style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', background: gradAmber, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245,158,11,0.2)' }}>
              <i className="fa fa-clock" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>System Uptime</p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
                {systemUptime === 'Healthy' ? <span style={{ color: '#10b981' }}>Healthy</span> : <span style={{ color: '#ef4444' }}>Issues</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Health Check Section */}
      <div className="monitor-card" style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-heartbeat" style={{ color: '#06b6d4' }}></i>
          Health Check
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { label: 'Cloudinary API', status: cloudinaryHealth, icon: 'fa-cloud' },
            { label: 'Redis', status: redisHealth, icon: 'fa-database' },
            { label: 'Database', status: databaseHealth, icon: 'fa-server' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#faf7f4', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className={`fa ${item.icon}`} style={{ fontSize: '14px', color: '#6b7280', width: '18px', textAlign: 'center' }}></i>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{item.label}</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>
                {item.status === 'checking' ? (
                  <span style={{ color: '#9ca3af' }}>Checking...</span>
                ) : item.status === 'healthy' ? (
                  <span style={{ color: '#10b981' }}><i className="fa fa-check-circle"></i> Healthy</span>
                ) : (
                  <span style={{ color: '#ef4444' }}><i className="fa fa-times-circle"></i> Unhealthy</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Usage Card */}
      <div className="monitor-card" style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-cloud" style={{ color: '#06b6d4' }}></i>
          Storage Usage
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>Cloudinary Storage</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{mediaStats ? formatSize(mediaStats.totalStorage) : '-'}</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#f0fdfa', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${storagePercent}%`, height: '100%', background: gradCyan, borderRadius: '6px', transition: 'width 0.5s ease' }}></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: '#faf7f4', borderRadius: '10px' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>
                {mediaStats ? formatSize(mediaStats.totalStorage) : '-'}
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Storage Used</p>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: '#faf7f4', borderRadius: '10px' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>
                {mediaStats ? mediaStats.totalFiles.toLocaleString() : '-'}
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Files</p>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: '#faf7f4', borderRadius: '10px' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>
                {mediaStats ? (mediaStats.creditsUsed ?? '-') : '-'}
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Credits Used</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Uploads Table */}
      <div className="monitor-card" style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-file-upload" style={{ color: '#06b6d4' }}></i>
          Recent Uploads
        </h2>
        {recentUploads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <i className="fa fa-cloud-upload-alt" style={{ fontSize: '36px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No recent uploads found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>File Name</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Size</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uploaded Date</th>
                </tr>
              </thead>
              <tbody>
                {recentUploads.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', color: '#1f2937', fontWeight: 600 }}>{item.filename || item.name || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.3px', background: '#ecfeff', color: '#0891b2' }}>
                        {item.type || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>{formatSize(item.size)}</td>
                    <td style={{ padding: '12px', color: '#6b7280' }}>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="action-btn"
          onClick={handleOrphanedCleanup}
          disabled={cleaningOrphaned}
          style={{
            padding: '10px 22px',
            background: cleaningOrphaned ? '#9ca3af' : gradOrange,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: cleaningOrphaned ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: cleaningOrphaned ? 'none' : '0 2px 8px rgba(234,102,69,0.3)',
          }}
        >
          <i className={`fa ${cleaningOrphaned ? 'fa-spinner fa-spin' : 'fa-trash'}`} style={{ fontSize: '13px' }}></i>
          {cleaningOrphaned ? 'Cleaning...' : 'Run Orphaned Cleanup'}
        </button>
        <button
          className="action-btn"
          onClick={fetchAll}
          style={{
            padding: '10px 22px',
            background: gradCyan,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}
        >
          <i className="fa fa-sync-alt" style={{ fontSize: '13px' }}></i>
          Refresh All Stats
        </button>
        {orphanedMessage && (
          <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
            <i className="fa fa-check-circle"></i> {orphanedMessage}
          </span>
        )}
      </div>
    </div>
  );
}
