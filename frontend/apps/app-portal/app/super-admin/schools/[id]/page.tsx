'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi } from '@/lib/api';
import Link from 'next/link';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradBlueLight = 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
const gradGreenLight = 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
const gradPurpleLight = 'linear-gradient(135deg, #f3e8ff, #e9d5ff)';

export default function SchoolDetailsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const schoolId = params.id as string;

  const [school, setSchool] = useState<any>(null);
  const [directors, setDirectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'directors' | 'subscription'>('details');

  const [showTypeEditor, setShowTypeEditor] = useState(false);
  const [selectedTypeCode, setSelectedTypeCode] = useState('');
  const [typeUpdating, setTypeUpdating] = useState(false);
  const [typeError, setTypeError] = useState('');

  const INSTITUTION_TYPES = [
    { code: 'PRIMARY_SCHOOL', name: 'Primary School' },
    { code: 'SECONDARY_SCHOOL', name: 'Secondary School' },
    { code: 'ADVANCED_SECONDARY', name: 'Advanced Secondary' },
    { code: 'COLLEGE', name: 'College' },
    { code: 'UNIVERSITY', name: 'University' },
  ];

  const [showDirectorForm, setShowDirectorForm] = useState(false);
  const [directorForm, setDirectorForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [directorError, setDirectorError] = useState('');
  const [directorSubmitting, setDirectorSubmitting] = useState(false);
  const [sendingLogin, setSendingLogin] = useState<string | null>(null);
  const [loginSent, setLoginSent] = useState<string | null>(null);

  const handleSendLogin = async (directorId: string) => {
    setSendingLogin(directorId);
    try {
      await superAdminApi.sendSchoolLink(schoolId, directorId, 'email');
      setLoginSent(directorId);
      setTimeout(() => setLoginSent(null), 3000);
    } catch (error: any) {
      console.error('Failed to send login:', error);
      setDirectorError(error?.response?.data?.message || 'Failed to send login link');
      setTimeout(() => setDirectorError(''), 3000);
    } finally {
      setSendingLogin(null);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && schoolId) {
      loadSchool();
    }
  }, [isAuthenticated, schoolId]);

  const loadSchool = async () => {
    try {
      setLoading(true);
      const response = await superAdminApi.getSchool(schoolId);
      setSchool(response.data?.data || response.data);
      await loadDirectors();
    } catch (error) {
      console.error('Failed to load school:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectors = async () => {
    try {
      const response = await superAdminApi.getDirectors(schoolId);
      setDirectors(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load directors:', error);
    }
  };

  const handleCreateDirector = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectorError('');

    if (directorForm.password !== directorForm.confirmPassword) {
      setDirectorError('Passwords do not match');
      return;
    }

    if (directorForm.password.length < 8) {
      setDirectorError('Password must be at least 8 characters');
      return;
    }

    setDirectorSubmitting(true);
    try {
      await superAdminApi.createDirector(schoolId, {
        firstName: directorForm.firstName,
        lastName: directorForm.lastName,
        email: directorForm.email,
        password: directorForm.password,
        phone: directorForm.phone,
      });
      await loadDirectors();
      setShowDirectorForm(false);
      setDirectorForm({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '' });
    } catch (error: any) {
      console.error('Failed to create director:', error);
      setDirectorError(error?.response?.data?.message || 'Failed to create director');
    } finally {
      setDirectorSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none',
    background: '#fefcf9',
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradBlue, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-building"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated || !school) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <Link href="/super-admin/schools" style={{ color: '#9ca3af', fontSize: '20px' }}><i className="fa fa-arrow-left"></i></Link>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{school.name}</h1>
          </div>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 36px' }}>School Details</p>
        </div>
        <span style={{ padding: '6px 14px', fontSize: '13px', fontWeight: 600, borderRadius: '20px', background: school.subscriptionStatus === 'active' ? '#d1fae5' : '#fef3c7', color: school.subscriptionStatus === 'active' ? '#059669' : '#d97706', textTransform: 'capitalize' }}>
          {school.subscriptionStatus || 'active'}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e8ddd0' }}>
        {(['details', 'directors', 'subscription'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: activeTab === tab ? '#3b82f6' : '#6b7280',
              borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'directors' ? `Directors (${directors.length})` : tab}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>School Information</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Institution Type</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>
                    {school.institutionType?.name || school.institutionType?.code || 'Not set'}
                  </span>
                  <button onClick={() => { setSelectedTypeCode(school.institutionType?.code || ''); setShowTypeEditor(true); }} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: '6px', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}>
                    <i className="fa fa-pen"></i>
                  </button>
                </div>
              </div>
              {school.registrationNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Registration Number</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{school.registrationNumber}</span>
                </div>
              )}
              {school.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Email</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{school.email}</span>
                </div>
              )}
              {school.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Phone</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{school.phone}</span>
                </div>
              )}
              {school.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Address</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937' }}>{school.address}</span>
                </div>
              )}
              {school.website && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Website</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#3b82f6' }}>{school.website}</span>
                </div>
              )}
              {school.motto && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Motto</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#1f2937', fontStyle: 'italic' }}>"{school.motto}"</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>Statistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              <div style={{ background: gradBlueLight, borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontSize: '28px', fontWeight: 700, color: '#2563eb', margin: 0 }}>{school._count?.students || 0}</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>Students</p>
              </div>
              <div style={{ background: gradGreenLight, borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontSize: '28px', fontWeight: 700, color: '#059669', margin: 0 }}>{school._count?.teachers || 0}</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>Teachers</p>
              </div>
              <div style={{ background: gradPurpleLight, borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontSize: '28px', fontWeight: 700, color: '#7c3aed', margin: 0 }}>{school._count?.classes || 0}</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>Classes</p>
              </div>
              <div style={{ background: '#fef3c7', borderRadius: '12px', padding: '16px' }}>
                <p style={{ fontSize: '28px', fontWeight: 700, color: '#d97706', margin: 0 }}>{school._count?.subjects || 0}</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }}>Subjects</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Directors Tab */}
      {activeTab === 'directors' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Directors</h2>
            <button onClick={() => setShowDirectorForm(true)} style={{ padding: '10px 18px', background: gradGreen, color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-plus"></i> Add Director
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {directors.map((director: any) => (
              <div key={director.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', background: gradPurple, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                    {director.firstName?.[0]}{director.lastName?.[0]}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{director.firstName} {director.lastName}</p>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{director.email}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {loginSent === director.id ? (
                    <button disabled style={{ padding: '8px 14px', background: '#d1fae5', borderRadius: '8px', border: 'none', color: '#059669', fontSize: '13px', fontWeight: 500, cursor: 'default' }}>
                      <i className="fa fa-check" style={{ marginRight: '6px' }}></i> Sent!
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleSendLogin(director.id)} 
                      disabled={sendingLogin === director.id}
                      style={{ padding: '8px 14px', background: '#fee2e2', borderRadius: '8px', border: 'none', color: '#dc2626', fontSize: '13px', fontWeight: 500, cursor: sendingLogin === director.id ? 'not-allowed' : 'pointer', opacity: sendingLogin === director.id ? 0.6 : 1 }}
                    >
                      <i className={`fa ${sendingLogin === director.id ? 'fa-spinner fa-spin' : 'fa-envelope'}`} style={{ marginRight: '6px' }}></i> 
                      {sendingLogin === director.id ? 'Sending...' : 'Send Login'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {directors.length === 0 && (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px' }}>No directors found</p>
            )}
          </div>

          {/* Add Director Modal */}
          {showDirectorForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
              <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', maxWidth: '450px', width: '90%' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: '0 0 20px' }}>Add New Director</h3>
                {directorError && (
                  <div style={{ padding: '12px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{directorError}</div>
                )}
                <form onSubmit={handleCreateDirector} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>First Name *</label>
                      <input required type="text" value={directorForm.firstName} onChange={(e) => setDirectorForm({ ...directorForm, firstName: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Last Name *</label>
                      <input required type="text" value={directorForm.lastName} onChange={(e) => setDirectorForm({ ...directorForm, lastName: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Email *</label>
                    <input required type="email" value={directorForm.email} onChange={(e) => setDirectorForm({ ...directorForm, email: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Phone</label>
                    <input type="tel" value={directorForm.phone} onChange={(e) => setDirectorForm({ ...directorForm, phone: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Password *</label>
                    <input required type="password" minLength={8} value={directorForm.password} onChange={(e) => setDirectorForm({ ...directorForm, password: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Confirm Password *</label>
                    <input required type="password" value={directorForm.confirmPassword} onChange={(e) => setDirectorForm({ ...directorForm, confirmPassword: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="button" onClick={() => setShowDirectorForm(false)} style={{ flex: 1, padding: '12px', background: '#fefcf9', border: '1px solid #d1d5db', borderRadius: '10px', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={directorSubmitting} style={{ flex: 1, padding: '12px', background: gradGreen, color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: directorSubmitting ? 'not-allowed' : 'pointer', opacity: directorSubmitting ? 0.6 : 1 }}>
                      {directorSubmitting ? 'Adding...' : 'Add Director'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscription Tab */}
      {activeTab === 'subscription' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Subscription Details</h2>
          <div style={{ display: 'grid', gap: '16px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', background: '#f5efe8' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Current Plan</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>{school.subscriptionTier || 'basic'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', background: '#f5efe8' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Status</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: school.subscriptionStatus === 'active' ? '#059669' : '#d97706', textTransform: 'capitalize' }}>{school.subscriptionStatus || 'active'}</span>
            </div>
            {school.subscription?.expiresAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', background: '#f5efe8' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Expires</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{new Date(school.subscription.expiresAt).toLocaleDateString()}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button style={{ padding: '10px 18px', background: '#fee2e2', borderRadius: '10px', border: 'none', color: '#dc2626', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                <i className="fa fa-ban" style={{ marginRight: '6px' }}></i> Deactivate
              </button>
              <button style={{ padding: '10px 18px', background: gradBlue, borderRadius: '10px', border: 'none', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                <i className="fa fa-credit-card" style={{ marginRight: '6px' }}></i> Change Plan
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Institution Type Editor Modal */}
      {showTypeEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>Change Institution Type</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px' }}>This will update the school's modules, features, and dashboards.</p>
            {typeError && (
              <div style={{ padding: '12px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{typeError}</div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Institution Type</label>
              <select
                value={selectedTypeCode}
                onChange={(e) => setSelectedTypeCode(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}
              >
                <option value="">Select type...</option>
                {INSTITUTION_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowTypeEditor(false)} style={{ flex: 1, padding: '12px', background: '#fefcf9', border: '1px solid #d1d5db', borderRadius: '10px', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={async () => {
                  if (!selectedTypeCode) return;
                  setTypeUpdating(true);
                  setTypeError('');
                  try {
                    await superAdminApi.updateSchool(schoolId, { institutionType: selectedTypeCode });
                    setShowTypeEditor(false);
                    loadSchool();
                  } catch (err: any) {
                    setTypeError(err?.response?.data?.message || 'Failed to update institution type');
                  } finally {
                    setTypeUpdating(false);
                  }
                }}
                disabled={typeUpdating || !selectedTypeCode}
                style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: typeUpdating || !selectedTypeCode ? 'not-allowed' : 'pointer', opacity: typeUpdating || !selectedTypeCode ? 0.6 : 1 }}
              >
                {typeUpdating ? 'Updating...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}