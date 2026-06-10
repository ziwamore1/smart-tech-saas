'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi } from '@/lib/api';
import Link from 'next/link';

export default function SchoolsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSchools();
    }
  }, [isAuthenticated]);

  const loadSchools = async (status?: string) => {
    try {
      setLoading(true);
      const response = await superAdminApi.getSchools(status || undefined);
      setSchools(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load schools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (status: string) => {
    setFilter(status);
    loadSchools(status || undefined);
  };

  const handleActivate = async (id: string) => {
    try {
      await superAdminApi.activateSchool(id);
      loadSchools(filter || undefined);
    } catch (error) {
      console.error('Failed to activate school:', error);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await superAdminApi.deactivateSchool(id);
      loadSchools(filter || undefined);
    } catch (error) {
      console.error('Failed to deactivate school:', error);
    }
  };

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
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '18px'
          }}>
            <i className="fa fa-building"></i>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#3b82f6',
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
        .filter-btn { transition: all 0.2s ease; cursor: pointer; }
        .filter-btn:hover { transform: translateY(-1px); }
        .school-row { transition: all 0.25s ease; }
        .school-row:hover { background: linear-gradient(90deg, rgba(59,130,246,0.04), rgba(234,102,69,0.04)); }
        .action-btn { transition: all 0.2s ease; cursor: pointer; }
        .action-btn:hover { transform: scale(1.05); }
      `}</style>
      
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
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="fa fa-building" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Schools
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage all registered schools</p>
        </div>
        <Link
          href="/super-admin/schools/new"
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            transition: 'all 0.2s',
          }}
        >
          <i className="fa fa-plus" style={{ fontSize: '14px' }}></i>
          Register New School
        </Link>
      </div>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleFilterChange('')}
          className="filter-btn"
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            border: filter === '' ? 'none' : '1px solid #e8ddd0',
            background: filter === '' 
              ? 'linear-gradient(135deg, #3b82f6, #2563eb)' 
              : 'white',
            color: filter === '' ? 'white' : '#6b7280',
            boxShadow: filter === '' ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa fa-building" style={{ fontSize: '12px' }}></i>
          All Schools
        </button>
        <button
          onClick={() => handleFilterChange('active')}
          className="filter-btn"
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            border: filter === 'active' ? 'none' : '1px solid #e8ddd0',
            background: filter === 'active' 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'white',
            color: filter === 'active' ? 'white' : '#6b7280',
            boxShadow: filter === 'active' ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa fa-check-circle" style={{ fontSize: '12px' }}></i>
          Active
        </button>
        <button
          onClick={() => handleFilterChange('trial')}
          className="filter-btn"
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            border: filter === 'trial' ? 'none' : '1px solid #e8ddd0',
            background: filter === 'trial' 
              ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
              : 'white',
            color: filter === 'trial' ? 'white' : '#6b7280',
            boxShadow: filter === 'trial' ? '0 4px 12px rgba(245,158,11,0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa fa-clock" style={{ fontSize: '12px' }}></i>
          Trial
        </button>
        <button
          onClick={() => handleFilterChange('expired')}
          className="filter-btn"
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            border: filter === 'expired' ? 'none' : '1px solid #e8ddd0',
            background: filter === 'expired' 
              ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
              : 'white',
            color: filter === 'expired' ? 'white' : '#6b7280',
            boxShadow: filter === 'expired' ? '0 4px 12px rgba(239,68,68,0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa fa-times-circle" style={{ fontSize: '12px' }}></i>
          Expired
        </button>
      </div>

      {/* Schools Table */}
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
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>School</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Users</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subscription</th>
                <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school: any) => (
                <tr key={school.id} className="school-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <i className="fa fa-building" style={{ fontSize: '16px', color: '#2563eb' }}></i>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{school.name}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{school.address || 'No address'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      background: '#dbeafe',
                      color: '#2563eb',
                    }}>
                      {school.institutionType?.name || 'Not Set'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '14px', color: '#374151' }}>{school.email || '-'}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{school.phone || '-'}</div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>{school._count?.students || 0} students</span>
                      <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 600 }}>{school._count?.teachers || 0} teachers</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      background: school.subscriptionStatus === 'active' ? '#d1fae5' : school.subscriptionStatus === 'trial' ? '#fef3c7' : '#fee2e2',
                      color: school.subscriptionStatus === 'active' ? '#059669' : school.subscriptionStatus === 'trial' ? '#d97706' : '#dc2626',
                      display: 'inline-flex',
                      textTransform: 'capitalize'
                    }}>
                      {school.subscriptionStatus || 'inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{school.subscription?.tier || '-'}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {school.subscription?.expiresAt ? `Expires ${new Date(school.subscription.expiresAt).toLocaleDateString()}` : 'No expiry'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Link
                        href={`/super-admin/schools/${school.id}`}
                        className="action-btn"
                        style={{
                          padding: '8px 12px',
                          background: '#f3f4f6',
                          borderRadius: '8px',
                          color: '#6b7280',
                          fontSize: '13px',
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa fa-eye"></i>
                        View
                      </Link>
                      {school.subscriptionStatus === 'active' ? (
                        <button
                          onClick={() => handleDeactivate(school.id)}
                          className="action-btn"
                          style={{
                            padding: '8px 12px',
                            background: '#fee2e2',
                            borderRadius: '8px',
                            color: '#dc2626',
                            fontSize: '13px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa fa-ban"></i>
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(school.id)}
                          className="action-btn"
                          style={{
                            padding: '8px 12px',
                            background: '#d1fae5',
                            borderRadius: '8px',
                            color: '#059669',
                            fontSize: '13px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fa fa-check"></i>
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      margin: '0 auto 16px',
                      background: '#f3f4f6',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <i className="fa fa-building" style={{ fontSize: '24px', color: '#9ca3af' }}></i>
                    </div>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px' }}>No schools found</p>
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Register a new school to get started</p>
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