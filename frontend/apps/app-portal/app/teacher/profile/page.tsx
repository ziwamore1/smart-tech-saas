'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { identityApi, premiumStaffRecordsApi } from '@/lib/api';

const ADVANCED_FIELDS = [
  { key: 'gender', label: 'Gender', category: 'GENDER' },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
  { key: 'maritalStatus', label: 'Marital Status', category: 'MARITAL_STATUS' },
  { key: 'nationality', label: 'Nationality', category: 'NATIONALITY' },
  { key: 'nrcNumber', label: 'NRC Number' },
  { key: 'tsNumber', label: 'MAN/TS Number' },
  { key: 'aesNumber', label: 'AES Number' },
  { key: 'phoneNumber', label: 'Staff Return Phone' },
  { key: 'substantivePosition', label: 'Substantive Position', category: 'POSITION' },
  { key: 'substantiveScale', label: 'Substantive Scale' },
  { key: 'currentPosition', label: 'Current Position', category: 'POSITION' },
  { key: 'actingPosition', label: 'Acting Position', category: 'POSITION' },
  { key: 'administration', label: 'Additional Responsibility', category: 'ADDITIONAL_RESPONSIBILITY' },
  { key: 'dateOfFirstAppointment', label: 'First Appointment Date', type: 'date' },
  { key: 'dateOfPresentAppointment', label: 'Current Post Appointment Date', type: 'date' },
  { key: 'academicQualification', label: 'Highest Academic', category: 'HIGHEST_ACADEMIC' },
  { key: 'professionalQualification', label: 'Highest Teacher Qualification', category: 'TEACHER_QUALIFICATION' },
  { key: 'yearOfQualification', label: 'Year of Qualification', type: 'number' },
  { key: 'specialization', label: 'Specialization' },
  { key: 'gradeLevel', label: 'Main Grade Taught', type: 'text', placeholder: 'For example: Form 1, Grade 10, Grade 11' },
  { key: 'nextOfKin', label: 'Next of Kin' },
  { key: 'nextOfKinContact', label: 'Next of Kin Contact' },
  { key: 'nextOfKinRelationship', label: 'Next of Kin Relationship' },
];

const ADVANCED_DYNAMIC_FIELDS = [
  { key: 'highestLevelOfEducation', label: 'Highest Level of Education', category: 'EDUCATION_LEVEL' },
  { key: 'differentlyAbled', label: 'Differently Abled', category: 'DIFFERENTLY_ABLED' },
  { key: 'inServiceTraining', label: 'In-Service Training / CPD' },
  { key: 'staffPresence', label: 'Staff Presence', category: 'STAFF_PRESENCE' },
  { key: 'employer', label: 'Employer', category: 'EMPLOYER' },
  { key: 'subjectBeingTaughtA', label: 'Subject Being Taught (A)', category: 'SUBJECT' },
  { key: 'subjectBeingTaughtB', label: 'Subject Being Taught (B)', category: 'SUBJECT' },
  { key: 'subjectQualifiedToTeachA', label: 'Subject Qualified to Teach (A)', category: 'SUBJECT' },
  { key: 'subjectQualifiedToTeachB', label: 'Subject Qualified to Teach (B)', category: 'SUBJECT' },
];

export default function TeacherProfilePage() {
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

  const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';

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
          <div style={{ width: '48px', height: '48px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>ST</div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
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
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000, padding: '14px 20px', borderRadius: '12px', background: message.type === 'success' ? gradGreen : '#fee2e2', color: message.type === 'success' ? 'white' : '#991b1b', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
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
            <div style={{ width: '48px', height: '48px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '18px' }}>
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
                onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Last Name</label>
              <input type="text" value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937' }}
                onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Email Address</label>
            <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937' }}
              onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Phone Number</label>
            <input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box', color: '#1f2937' }}
              onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <button onClick={handleProfileUpdate} disabled={saving}
            style={{ padding: '12px 28px', background: saving ? '#9ca3af' : gradGreen, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
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
              onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>New Password</label>
            <input type="password" value={password.newPassword} onChange={e => setPassword({ ...password, newPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Confirm New Password</label>
            <input type="password" value={password.confirmPassword} onChange={e => setPassword({ ...password, confirmPassword: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8ddd0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: 'white', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#10b981'} onBlur={e => e.target.style.borderColor = '#e8ddd0'} />
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#dcfce7', borderRadius: '9999px', fontSize: '12px', color: '#166534' }}>
                  <i className="fa fa-chalkboard-teacher" style={{ fontSize: '10px' }}></i> Teacher
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

      <div id="advanced-staff-profile">
        <AdvancedStaffProfileCard />
      </div>
    </div>
  );
}

function AdvancedStaffProfileCard() {
  const [profile, setProfile] = useState<any>(null);
  const [lookups, setLookups] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => {
      if (message.type === 'success') setOpen(false);
      setMessage(null);
    }, message.type === 'success' ? 30000 : 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const load = async () => {
    try {
      setLoading(true);
      const [profileRes, lookupRes] = await Promise.all([
        premiumStaffRecordsApi.getMyAdvancedProfile(),
        premiumStaffRecordsApi.getMyAdvancedProfileLookups(),
      ]);
      const value = profileRes.data?.data || profileRes.data || {};
      const lookupRows = lookupRes.data?.data || lookupRes.data || [];
      const grouped: Record<string, any[]> = {};
      (Array.isArray(lookupRows) ? lookupRows : []).forEach((row: any) => {
        grouped[row.category] = [...(grouped[row.category] || []), row];
      });
      setProfile(value);
      setLookups(grouped);
      setForm({ ...(value.profile || {}), dynamicFields: { ...((value.profile?.dynamicFields as any) || {}) } });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Advanced Staff Profile could not be loaded.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const valueFor = (field: { key: string; dynamic?: boolean }) => {
    const value = field.dynamic ? form.dynamicFields?.[field.key] : form[field.key];
    if (field.key.toLowerCase().includes('date') && value) return String(value).slice(0, 10);
    return value || '';
  };

  const setValue = (key: string, value: any, dynamic = false) => {
    if (dynamic) setForm((current: any) => ({ ...current, dynamicFields: { ...(current.dynamicFields || {}), [key]: value } }));
    else setForm((current: any) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = { ...form, dynamicFields: form.dynamicFields || {} };
      const response = await premiumStaffRecordsApi.updateMyAdvancedProfile(payload);
      const result = response.data?.data || response.data || {};
      setProfile((current: any) => ({ ...current, profile: result.profile || current.profile, editable: result.editable, syncedDraftReturns: result.syncedDraftReturns }));
      setForm({ ...(result.profile || form), dynamicFields: { ...((result.profile?.dynamicFields as any) || form.dynamicFields || {}) } });
      setMessage({ type: 'success', text: `Your details have been saved and synced to the Main Staff Return Hub${result.syncedDraftReturns ? ` (${result.syncedDraftReturns} open return${result.syncedDraftReturns === 1 ? '' : 's'})` : ''}.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Advanced Staff Profile could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ marginTop: 24, color: '#6b7280' }}>Loading Advanced Staff Profile...</div>;
  if (!profile?.profile) return null;

  const editable = Boolean(profile.editable);
  const renderInput = (field: any, dynamic = false) => {
    const options = field.category ? lookups[field.category] || [] : [];
    const value = valueFor({ key: field.key, dynamic });
    return (
      <div key={`${dynamic ? 'dynamic-' : ''}${field.key}`}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{field.label}</label>
        {options.length ? (
          <>
            <input list={`lookup-${field.key}`} disabled={!editable || saving} type={field.type || 'text'} value={value} onChange={e => setValue(field.key, e.target.value, dynamic)} placeholder={`Select or type ${field.label.toLowerCase()}`} style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 7, background: editable ? '#fff' : '#f3f4f6', color: '#1f2937', boxSizing: 'border-box' }} />
            <datalist id={`lookup-${field.key}`}>
              {options.map((option: any) => <option key={option.id} value={option.label} />)}
            </datalist>
          </>
        ) : (
          <input disabled={!editable || saving} type={field.type || 'text'} value={value} onChange={e => setValue(field.key, e.target.value, dynamic)} placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`} style={{ width: '100%', padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 7, background: editable ? '#fff' : '#f3f4f6', color: '#1f2937', boxSizing: 'border-box' }} />
        )}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 24, maxWidth: 1000, background: '#fefcf9', border: '1px solid #c7d2fe', borderRadius: 16, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, color: '#1e1b4b' }}><i className="fa fa-id-card" style={{ marginRight: 8, color: '#4f46e5' }}></i>Advanced Staff Profile</h2>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>Separate from your login profile. These records support current and future Staff Return templates.</p>
        </div>
        <span style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: editable ? '#166534' : '#92400e', background: editable ? '#dcfce7' : '#fef3c7' }}>{editable ? 'DRAFT OPEN - EDITABLE' : 'LOCKED'}</span>
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 9, background: editable ? '#eef2ff' : '#fff7ed', color: editable ? '#3730a3' : '#9a3412', fontSize: 13, lineHeight: 1.5 }}>
        {profile.guidance?.message}
        {profile.draftReturns?.length > 0 && <div style={{ marginTop: 5, fontWeight: 600 }}>Open return: {profile.draftReturns.map((item: any) => `${item.name} (${item.period})`).join(', ')}</div>}
      </div>

      {message && <div style={{ marginTop: 12, padding: 10, borderRadius: 7, background: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#991b1b', fontSize: 13 }}>{message.text}</div>}

      <button onClick={() => setOpen(true)} style={{ marginTop: 18, padding: '10px 18px', background: editable ? '#4f46e5' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 8, cursor: editable ? 'pointer' : 'default', fontWeight: 600 }}>
        <i className="fa fa-edit" style={{ marginRight: 7 }}></i>{editable ? 'Open Advanced Staff Profile' : 'View Advanced Staff Profile'}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 'min(980px, 100%)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h3 style={{ margin: 0, color: '#1e1b4b' }}>Advanced Staff Profile</h3><p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Use the lookup options where provided. Leave unknown fields for the Staff Return Hub administrator.</p></div>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            {message && (
              <div role={message.type === 'success' ? 'status' : 'alert'} style={{ margin: '14px 22px 0', padding: 16, borderRadius: 12, border: `2px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', color: message.type === 'success' ? '#166534' : '#991b1b', boxShadow: '0 4px 14px rgba(22, 101, 52, 0.12)' }}>
                {message.type === 'success' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <i className="fa fa-check-circle" aria-hidden="true" style={{ fontSize: 24, marginTop: 2 }}></i>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>Save successful</div>
                        <div style={{ marginTop: 5, fontSize: 14, lineHeight: 1.5 }}>{message.text}</div>
                        <div style={{ marginTop: 5, fontSize: 12, color: '#3f6212' }}>Review the saved values below. Confirm when you are ready; this notice will close automatically in 30 seconds.</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} style={{ marginTop: 12, padding: '9px 14px', border: 'none', borderRadius: 7, background: '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                      I’ve confirmed — close profile
                    </button>
                  </>
                ) : message.text}
              </div>
            )}
            <div style={{ padding: 22, overflowY: 'auto' }}>
              <h4 style={{ margin: '0 0 12px', color: '#374151' }}>Identity and Employment Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>{ADVANCED_FIELDS.map(field => renderInput(field))}</div>
              <h4 style={{ margin: '24px 0 12px', color: '#374151' }}>Staff Return Guidance Fields</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>{ADVANCED_DYNAMIC_FIELDS.map(field => renderInput(field, true))}</div>
            </div>
            <div style={{ padding: '12px 22px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setOpen(false)} style={{ padding: '9px 16px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 7, cursor: 'pointer' }}>Close</button>
              <button onClick={save} disabled={!editable || saving} style={{ padding: '9px 18px', border: 'none', background: !editable || saving ? '#9ca3af' : '#4f46e5', color: '#fff', borderRadius: 7, cursor: !editable || saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{saving ? 'Saving and syncing...' : 'Save and Sync Return'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
