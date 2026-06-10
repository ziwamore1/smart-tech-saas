'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi } from '@/lib/api';
import Link from 'next/link';

interface AuditLog {
  id: string;
  action: string;
  model: string;
  recordId: string;
  changes: any;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  school?: {
    id: string;
    name: string;
  };
}

export default function AuditLogsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadLogs();
    }
  }, [isAuthenticated]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await superAdminApi.getAuditLogs({ limit });
      setLogs(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create': return { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' };
      case 'update': return { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' };
      case 'delete': return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
      default: return { bg: '#f3f4f6', text: '#374151', border: '#e8ddd0' };
    }
  };

  const filteredLogs = logs.filter(log => 
    !filter || log.action.toLowerCase().includes(filter.toLowerCase()) || 
    log.model.toLowerCase().includes(filter.toLowerCase()) ||
    log.user?.email?.includes(filter)
  );

  if (isLoading || loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5efe8'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '18px'
          }}>
            <i className="fa fa-history"></i>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#f59e0b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .log-row { transition: all 0.2s ease; }
        .log-row:hover { background: #f5efe8; }
        .filter-input:focus { border-color: #f59e0b !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
      `}</style>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="fa fa-history" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Audit Logs
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Track all system activities</p>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-input"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            outline: 'none',
            width: '250px',
            background: '#fefcf9'
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: '#fefcf9',
        borderRadius: '16px',
        border: '1px solid #f3f4f6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #f5efe8, #f3f4f6)', borderBottom: '1px solid #e8ddd0' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Record ID</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>School</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Changes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const actionColor = getActionColor(log.action);
                return (
                  <tr key={log.id} className="log-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '14px'
                        }}>
                          {log.user?.firstName?.[0]}{log.user?.lastName?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                            {log.user?.firstName} {log.user?.lastName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{log.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        background: actionColor.bg,
                        color: actionColor.text,
                        border: `1px solid ${actionColor.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textTransform: 'capitalize'
                      }}>
                        <i className={`fa fa-${
                          log.action === 'create' ? 'plus' : log.action === 'update' ? 'edit' : log.action === 'delete' ? 'trash' : 'circle'
                        }`} style={{ fontSize: '10px' }}></i>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '8px',
                        background: '#f3f4f6',
                        color: '#374151'
                      }}>
                        {log.model}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <code style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        background: '#f3f4f6',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      }}>
                        {log.recordId?.substring(0, 8)}...
                      </code>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {log.school ? (
                        <Link
                          href={`/super-admin/schools/${log.school.id}`}
                          style={{
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#ea6645',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa fa-building" style={{ fontSize: '12px' }}></i>
                          {log.school.name}
                        </Link>
                      ) : (
                        <span style={{ fontSize: '14px', color: '#d1d5db' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {log.changes ? (
                        <button style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          color: 'white',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <i className="fa fa-eye" style={{ fontSize: '11px' }}></i>
                          View
                        </button>
                      ) : (
                        <span style={{ fontSize: '14px', color: '#d1d5db' }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <i className="fa fa-search" style={{ fontSize: '32px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No audit logs found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>
          Showing <span style={{ fontWeight: 600, color: '#374151' }}>{filteredLogs.length}</span> of <span style={{ fontWeight: 600, color: '#374151' }}>{logs.length}</span> logs
        </p>
        <button
          onClick={() => {
            setLimit(prev => prev + 50);
            loadLogs();
          }}
          style={{
            padding: '10px 20px',
            background: '#fefcf9',
            border: '1px solid #e8ddd0',
            borderRadius: '10px',
            color: '#374151',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa fa-plus" style={{ fontSize: '12px' }}></i>
          Load More
        </button>
      </div>
    </div>
  );
}