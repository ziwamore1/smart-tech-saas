'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi } from '@/lib/api';
import Link from 'next/link';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING_REVIEW: { bg: '#fef3c7', color: '#d97706', label: 'Pending Review' },
  CONTACTED: { bg: '#dbeafe', color: '#2563eb', label: 'Contacted' },
  APPROVED: { bg: '#d1fae5', color: '#059669', label: 'Approved' },
  REJECTED: { bg: '#fee2e2', color: '#dc2626', label: 'Needs Info' },
};

export default function RegistrationRequestsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRequests();
    }
  }, [isAuthenticated]);

  const loadRequests = async (status?: string) => {
    try {
      setLoading(true);
      const response = await superAdminApi.getRegistrationRequests({ status: status || undefined, limit: 100 });
      const body = response.data;
      setRequests(Array.isArray(body) ? body : body?.data || []);
      setMeta(body?.meta || null);
    } catch (error) {
      console.error('Failed to load registration requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (status: string) => {
    setFilter(status);
    loadRequests(status || undefined);
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .req-row { transition: all 0.25s ease; }
        .req-row:hover { background: linear-gradient(90deg, rgba(234,102,69,0.04), rgba(59,130,246,0.04)); }
        .filter-btn { transition: all 0.2s ease; cursor: pointer; }
        .filter-btn:hover { transform: translateY(-1px); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ea6645, #f59e0b)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-inbox" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Registration Inbox
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Schools waiting for your review, contact, and activation</p>
        </div>
        <Link
          href="/super-admin/registrations/templates"
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: 'white',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
          }}
        >
          <i className="fa fa-envelope-open-text"></i> Email Templates
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#ea580c' }}>{meta?.total ?? requests.length}</div>
          <div style={{ fontSize: '13px', color: '#9a3412', fontWeight: 500 }}>Total Requests</div>
        </div>
        <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#d97706' }}>{requests.filter((r: any) => r.status === 'PENDING_REVIEW').length}</div>
          <div style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>Awaiting Review</div>
        </div>
        <div style={{ padding: '16px', background: '#dbeafe', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#2563eb' }}>{requests.filter((r: any) => r.status === 'CONTACTED').length}</div>
          <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>In Contact</div>
        </div>
        <div style={{ padding: '16px', background: '#d1fae5', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#059669' }}>{requests.filter((r: any) => r.status === 'APPROVED').length}</div>
          <div style={{ fontSize: '13px', color: '#065f46', fontWeight: 500 }}>Approved / On Trial</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[{ value: '', label: 'All' }, { value: 'PENDING_REVIEW', label: 'Pending Review' }, { value: 'CONTACTED', label: 'Contacted' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Needs Info' }].map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className="filter-btn"
            style={{
              padding: '9px 18px',
              borderRadius: '999px',
              border: filter === f.value ? 'none' : '1px solid #e8ddd0',
              background: filter === f.value ? 'linear-gradient(135deg, #ea6645, #f59e0b)' : '#fefcf9',
              color: filter === f.value ? 'white' : '#6b7280',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 0', color: '#9ca3af' }}>
            <i className="fa fa-inbox" style={{ fontSize: '36px', marginBottom: '12px', color: '#d1d5db', display: 'block' }}></i>
            <p style={{ fontSize: '14px' }}>No registration requests{filter ? ` with status ${filter}` : ''}.</p>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>New public registrations will land here for review.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {requests.map((req: any) => {
              const st = STATUS_STYLES[req.status] || { bg: '#f3f4f6', color: '#6b7280', label: req.status };
              return (
                <Link
                  key={req.id}
                  href={`/super-admin/registrations/${req.id}`}
                  className="req-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '12px',
                    borderBottom: '1px solid #f3f4f6',
                    textDecoration: 'none',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '240px' }}>
                    <div style={{ width: '44px', height: '44px', background: '#fff7ed', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa fa-building" style={{ fontSize: '18px', color: '#ea580c' }}></i>
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{req.schoolName}</p>
                      <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
                        {req.directorFirstName} {req.directorLastName} · {req.email}
                      </p>
                      <p style={{ fontSize: '11px', color: '#d1d5db', margin: '4px 0 0' }}>
                        {req.institutionType.replace(/_/g, ' ').toLowerCase()} · Requested {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {req.school?.registrationNumber && (
                    <span style={{ fontSize: '12px', color: '#6b7280', background: '#f3f4f6', padding: '4px 10px', borderRadius: '8px', fontWeight: 600 }}>{req.school.registrationNumber}</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      {req.expectedLearners ? <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{req.expectedLearners.toLocaleString()} learners</p> : <p style={{ fontSize: '12px', color: '#d1d5db', margin: 0 }}>Learners n/a</p>}
                      {req.lastContactedAt && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>Last contact {new Date(req.lastContactedAt).toLocaleDateString()}</p>}
                    </div>
                    <span style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '999px', background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                    <i className="fa fa-chevron-right" style={{ color: '#d1d5db', fontSize: '12px' }}></i>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}