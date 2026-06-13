'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

const gradAmber = 'linear-gradient(135deg, #f59e0b, #d97706)';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/v1\/?$/, '');
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

export default function ApprovalsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadWorkflows();
  }, [isAuthenticated]);

  const loadWorkflows = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/approval/school/all`, { headers: authHeaders() });
      const data = await res.json();
      setWorkflows(data?.data?.workflows || data?.workflows || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: '#d1fae5', text: '#059669' };
      case 'pending': return { bg: '#fef3c7', text: '#d97706' };
      case 'rejected': return { bg: '#fef2f2', text: '#dc2626' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const filtered = workflows.filter((w) => {
    if (filter === 'all') return true;
    return w.status === filter;
  });

  if (isLoading || loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa fa-check-double" style={{ color: '#f59e0b' }}></i> Approval Workflows
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Monitor multi-stage approval chains</p>
        </div>
        <Link href="/super-admin/verification" style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
          <i className="fa fa-arrow-left"></i> Back
        </Link>
      </div>

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'completed', 'rejected'].map((f) => {
          const colors = f !== 'all' ? getStatusColor(f) : null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: filter === f ? '#f59e0b' : colors ? colors.bg : '#f3f4f6',
                color: filter === f ? 'white' : colors ? colors.text : '#6b7280',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Workflow Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
        {filtered.map((wf) => {
          const colors = getStatusColor(wf.status);
          return (
            <div key={wf.id} style={{
              background: '#fefcf9', borderRadius: '16px', padding: '20px',
              border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 4px' }}>{wf.documentName}</p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{wf.documentType}</p>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: colors.bg, color: colors.text, textTransform: 'capitalize' }}>
                  {wf.status}
                </span>
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {wf.steps?.map((step: any, index: number) => {
                  const stepColors = step.status === 'approved' ? { bg: '#d1fae5', text: '#059669', icon: 'fa-check' } :
                    step.status === 'rejected' ? { bg: '#fef2f2', text: '#dc2626', icon: 'fa-times' } :
                    { bg: '#f3f4f6', text: '#6b7280', icon: 'fa-clock' };
                  return (
                    <div key={step.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                      background: stepColors.bg, borderRadius: '8px',
                    }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fefcf9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`fa ${stepColors.icon}`} style={{ fontSize: '12px', color: stepColors.text }}></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Step {step.order}: {step.role}</p>
                        {step.completedAt && <p style={{ fontSize: '11px', color: '#6b7280', margin: 0 }}>{new Date(step.completedAt).toLocaleString()}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  Created: {new Date(wf.createdAt).toLocaleDateString()}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {wf.steps?.filter((s: any) => s.status === 'approved').length || 0}/{wf.steps?.length || 0} approved
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '40px', textAlign: 'center', border: '1px solid #f3f4f6' }}>
          <i className="fa fa-check-double" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px' }}></i>
          <p style={{ fontSize: '16px', color: '#9ca3af' }}>No approval workflows found</p>
        </div>
      )}
    </div>
  );
}
