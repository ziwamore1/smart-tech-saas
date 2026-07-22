'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { identityApi } from '@/lib/api';

export default function StudentProfilePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [accountInfo, setAccountInfo] = useState<{
    id?: string; email?: string; firstName?: string; lastName?: string; fullName?: string; phone?: string; roles?: string[]; createdAt?: string;
  }>({});

  const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/login'); }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) { loadProfile(); }
  }, [isAuthenticated]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await identityApi.getAccountCenter();
      const data = response.data?.data || response.data || {};
      setAccountInfo(data);
      setProfile({
        firstName: data.firstName || user?.firstName || '',
        lastName: data.lastName || user?.lastName || '',
        email: data.email || user?.email || '',
        phone: data.phone || '',
      });
    } catch (error) {
      if (user) {
        setProfile({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', phone: '' });
        setAccountInfo({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, fullName: user.fullName, roles: user.roles });
      }
    } finally { setLoading(false); }
  };

  const handleProfileUpdate = async () => {
    try {
      setSaving(true);
      await identityApi.updateProfile({ firstName: profile.firstName, lastName: profile.lastName, email: profile.email, phone: profile.phone });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
      setTimeout(() => setMessage(null), 3000);
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (password.newPassword !== password.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    if (password.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    try {
      setSaving(true);
      await identityApi.changePassword(password.currentPassword, password.newPassword);
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password. Check your current password.' });
      setTimeout(() => setMessage(null), 3000);
    } finally { setSaving(false); }
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradBlue, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>ST</div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, padding: '14px 20px', borderRadius: '12px', background: message.type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : '#fee2e2', color: message.type === 'success' ? 'white' : '#991b1b', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {message.type === 'success' ? <i className="fa fa-check-circle" style={{ marginRight: '8px' }}></i> : <i className="fa fa-exclamation-circle" style={{ marginRight: '8px' }}></i>}
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>Profile</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Manage your account settings and security</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px', maxWidth: '1000px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', background: gradBlue, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '18px' }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Profile Details</h2>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '2px 0 0' }}>Update your personal information</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>First Name</label>
              <input type="text" value={profile.firstName} onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Last Name</label>
              <input type="text" value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937' }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Email Address</label>
            <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Phone Number</label>
            <input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <button onClick={handleProfileUpdate} disabled={saving}
            style={{ padding: '12px 28px', background: saving ? '#9ca3af' : gradBlue, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            {saving ? <><i className="fa fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Saving...</> : 'Save Changes'}
          </button>
        </div>

        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <i className="fa fa-lock" style={{ fontSize: '20px' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Change Password</h2>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '2px 0 0' }}>Update your account password</p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Current Password</label>
            <input type="password" value={password.currentPassword} onChange={e => setPassword({ ...password, currentPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>New Password</label>
            <input type="password" value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Confirm New Password</label>
            <input type="password" value={password.confirmPassword} onChange={e => setPassword({ ...password, confirmPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <button onClick={handlePasswordChange} disabled={saving || !password.currentPassword || !password.newPassword || !password.confirmPassword}
            style={{ padding: '12px 28px', background: (saving || !password.currentPassword || !password.newPassword || !password.confirmPassword) ? '#9ca3af' : 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: (saving || !password.currentPassword || !password.newPassword || !password.confirmPassword) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { if (!saving && password.currentPassword && password.newPassword && password.confirmPassword) e.currentTarget.style.opacity = '0.9'; }} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            {saving ? <><i className="fa fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Updating...</> : 'Update Password'}
          </button>
        </div>

        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <i className="fa fa-info-circle" style={{ fontSize: '20px' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Account Info</h2>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '2px 0 0' }}>Your account details</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>User ID</span>
              <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600, fontFamily: 'monospace' }}>{accountInfo.id || user?.id || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Email</span>
              <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>{accountInfo.email || user?.email || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Full Name</span>
              <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>{accountInfo.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Role</span>
              <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#dbeafe', borderRadius: '9999px', fontSize: '12px', color: '#1e40af' }}>
                  <i className="fa fa-user-graduate" style={{ fontSize: '10px' }}></i> Student
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Joined</span>
              <span style={{ fontSize: '13px', color: '#1f2937', fontWeight: 600 }}>{accountInfo.createdAt ? new Date(accountInfo.createdAt).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
