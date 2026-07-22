'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi } from '@/lib/api';

const STAFF_ROLES = [
  { value: 'admin', label: 'School Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
];

export default function EnrollStaffPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [schools, setSchools] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedRole, setSelectedRole] = useState('admin');

  const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
  const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSchools();
    }
  }, [isAuthenticated]);

  const loadSchools = async () => {
    try {
      const res = await superAdminApi.getSchools();
      const data = res.data?.data || res.data || [];
      setSchools(Array.isArray(data) ? data.filter((s: any) => s.status === 'active' || s.status === 'trial') : []);
    } catch (error) {
      console.error('Failed to load schools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedSchool) {
      setMessage({ type: 'error', text: 'Please select a school' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      setSubmitting(true);
      const res = await superAdminApi.enrollSelfAsStaff(selectedSchool, selectedRole);
      setMessage({ type: 'success', text: res.data?.message || 'Successfully enrolled as staff!' });
      setSelectedSchool('');
      setSelectedRole('admin');
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to enroll as staff';
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg[0] : msg });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>ST</div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {message && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          padding: '14px 20px', borderRadius: '12px',
          background: message.type === 'success' ? gradGreen : '#fee2e2',
          color: message.type === 'success' ? 'white' : '#991b1b',
          fontSize: '14px', fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          animation: 'slideIn 0.3s ease',
        }}>
          {message.type === 'success' ? <i className="fa fa-check-circle" style={{ marginRight: '8px' }}></i> : <i className="fa fa-exclamation-circle" style={{ marginRight: '8px' }}></i>}
          {message.text}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>Enroll as Staff</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Join an onboarded school as a staff member while retaining your Super Admin privileges.</p>
      </div>

      <div style={{ maxWidth: '560px', background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <i className="fa fa-user-plus" style={{ fontSize: '20px' }}></i>
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Select School & Role</h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '2px 0 0' }}>Choose where you want to enroll</p>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>School</label>
          <select
            value={selectedSchool}
            onChange={e => setSelectedSchool(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px',
              fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937',
              appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
            }}
          >
            <option value="">-- Select a school --</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Role</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {STAFF_ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => setSelectedRole(r.value)}
                style={{
                  padding: '12px', borderRadius: '10px', border: selectedRole === r.value ? '2px solid #ea6645' : '1px solid #e8ddd0',
                  background: selectedRole === r.value ? '#fff7ed' : 'white', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, color: selectedRole === r.value ? '#ea6645' : '#374151',
                  transition: 'all 0.2s',
                }}
              >
                <i className={`fa ${r.value === 'admin' ? 'fa-user-shield' : r.value === 'teacher' ? 'fa-chalkboard-teacher' : r.value === 'student' ? 'fa-user-graduate' : 'fa-user-friends'}`} style={{ marginRight: '8px' }}></i>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleEnroll}
          disabled={submitting || !selectedSchool}
          style={{
            width: '100%', padding: '12px 28px',
            background: (submitting || !selectedSchool) ? '#9ca3af' : gradOrange,
            color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
            cursor: (submitting || !selectedSchool) ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (!submitting && selectedSchool) e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {submitting ? <><i className="fa fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Enrolling...</> : 'Enroll as Staff'}
        </button>

        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px', textAlign: 'center' }}>
          You will be able to switch between your Super Admin identity and this school role from the same account.
        </p>
      </div>
    </div>
  );
}
