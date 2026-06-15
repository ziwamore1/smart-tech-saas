'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi } from '@/lib/api';
import Link from 'next/link';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradGray = 'linear-gradient(135deg, #f3f4f6, #e8ddd0)';
const gradBlueLight = 'linear-gradient(135deg, #dbeafe, #bfdbfe)';

interface DirectorForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

interface SchoolForm {
  name: string;
  registrationNumber: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  motto: string;
  subscriptionTier: string;
  institutionType: string;
}

export default function NewSchoolPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [schoolForm, setSchoolForm] = useState<SchoolForm>({
    name: '',
    registrationNumber: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    motto: '',
    subscriptionTier: 'basic',
    institutionType: 'PRIMARY_SCHOOL',
  });

  const [directorForm, setDirectorForm] = useState<DirectorForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [createdSchool, setCreatedSchool] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSchoolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleDirectorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (directorForm.password !== directorForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (directorForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setSubmitting(true);
      const schoolData = {
        name: schoolForm.name,
        registrationNumber: schoolForm.registrationNumber,
        email: schoolForm.email,
        phone: schoolForm.phone,
        address: schoolForm.address,
        website: schoolForm.website,
        motto: schoolForm.motto,
        subscriptionTier: schoolForm.subscriptionTier,
        subscriptionStatus: 'active',
        institutionType: schoolForm.institutionType,
      };
      const response = await superAdminApi.createSchool(schoolData);
      const createdSchool = response.data?.data || response.data;
      setCreatedSchool(createdSchool);
      
      if (directorForm.email && directorForm.password) {
        const directorResponse = await superAdminApi.createDirector(createdSchool.id, {
          firstName: directorForm.firstName,
          lastName: directorForm.lastName,
          email: directorForm.email,
          password: directorForm.password,
          phone: directorForm.phone,
        });
        const createdDirector = directorResponse.data?.data || directorResponse.data;
        
        superAdminApi.sendSchoolLink(createdSchool.id, createdDirector.id, 'email').catch((emailErr) => {
          console.error('Failed to send login email:', emailErr);
        });
      }
      
      setStep(3);
      setSuccess('School registered successfully!');
    } catch (err: any) {
      console.error('Registration error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to register school';
      if (msg.toLowerCase().includes('email already in use')) {
        setError(`The director email "${directorForm.email}" is already registered. The school was created, but the director account was not. Navigate to the school details page to add a director with a different email.`);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
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

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradBlue, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-plus-circle"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-plus-circle" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Register New School
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Add a new school to the system</p>
        </div>
      </div>

      {/* Step Indicators */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step >= s ? gradGreen : '#f3f4f6', color: step >= s ? 'white' : '#9ca3af',
              fontWeight: 600, fontSize: '14px', transition: 'all 0.2s'
            }}>
              {step > s ? <i className="fa fa-check"></i> : s}
            </div>
            {s < 3 && <div style={{ width: '40px', height: '2px', background: step > s ? '#10b981' : '#e8ddd0', margin: '0 4px' }}></div>}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-exclamation-circle"></i> {error}
        </div>
      )}

      {/* Step 1: School Details */}
      {step === 1 && (
        <form onSubmit={handleSchoolSubmit} style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>School Details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Institution Type *</label>
              <select required value={schoolForm.institutionType} onChange={(e) => setSchoolForm({ ...schoolForm, institutionType: e.target.value })} style={inputStyle}>
                <option value="PRIMARY_SCHOOL">Primary School</option>
                <option value="SECONDARY_SCHOOL">Secondary School</option>
                <option value="ADVANCED_SECONDARY">Advanced Secondary</option>
                <option value="COLLEGE">College</option>
                <option value="UNIVERSITY">University</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>School Name *</label>
              <input required type="text" value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} style={inputStyle} placeholder="Enter school name" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Registration Number</label>
              <input type="text" value={schoolForm.registrationNumber} onChange={(e) => setSchoolForm({ ...schoolForm, registrationNumber: e.target.value })} style={inputStyle} placeholder="SCH/2024/001" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Email *</label>
              <input required type="email" value={schoolForm.email} onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })} style={inputStyle} placeholder="school@example.com" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Phone</label>
              <input type="tel" value={schoolForm.phone} onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })} style={inputStyle} placeholder="+260 XXX XXX XXX" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Website</label>
              <input type="url" value={schoolForm.website} onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })} style={inputStyle} placeholder="https://school.edu.zm" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Subscription Tier</label>
              <select value={schoolForm.subscriptionTier} onChange={(e) => setSchoolForm({ ...schoolForm, subscriptionTier: e.target.value })} style={inputStyle}>
                <option value="basic">Basic (Free)</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Address</label>
              <input type="text" value={schoolForm.address} onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })} style={inputStyle} placeholder="Enter full address" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>School Motto</label>
              <input type="text" value={schoolForm.motto} onChange={(e) => setSchoolForm({ ...schoolForm, motto: e.target.value })} style={inputStyle} placeholder="Excellence in Education" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="submit" style={{ padding: '12px 24px', background: gradBlue, color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
              Next: Add Director <i className="fa fa-arrow-right" style={{ marginLeft: '8px' }}></i>
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Director Details */}
      {step === 2 && (
        <form onSubmit={handleDirectorSubmit} style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Director Account</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>First Name *</label>
              <input required type="text" value={directorForm.firstName} onChange={(e) => setDirectorForm({ ...directorForm, firstName: e.target.value })} style={inputStyle} placeholder="John" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Last Name *</label>
              <input required type="text" value={directorForm.lastName} onChange={(e) => setDirectorForm({ ...directorForm, lastName: e.target.value })} style={inputStyle} placeholder="Doe" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Email *</label>
              <input required type="email" value={directorForm.email} onChange={(e) => setDirectorForm({ ...directorForm, email: e.target.value })} style={inputStyle} placeholder="director@example.com" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Phone</label>
              <input type="tel" value={directorForm.phone} onChange={(e) => setDirectorForm({ ...directorForm, phone: e.target.value })} style={inputStyle} placeholder="+260 XX XXX XXXX" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Password *</label>
              <input required type="password" minLength={8} value={directorForm.password} onChange={(e) => setDirectorForm({ ...directorForm, password: e.target.value })} style={inputStyle} placeholder="Min 8 characters" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Confirm Password *</label>
              <input required type="password" value={directorForm.confirmPassword} onChange={(e) => setDirectorForm({ ...directorForm, confirmPassword: e.target.value })} style={inputStyle} placeholder="Confirm password" />
            </div>
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', background: '#fef3c7', marginTop: '16px' }}>
            <p style={{ fontSize: '13px', color: '#92400e', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-envelope"></i> A welcome email with login instructions will be sent to the director after registration.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
            <button type="button" onClick={() => setStep(1)} style={{ padding: '12px 24px', background: '#fefcf9', border: '1px solid #d1d5db', borderRadius: '10px', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <i className="fa fa-arrow-left" style={{ marginRight: '8px' }}></i> Back
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '12px 24px', background: submitting ? '#9ca3af' : gradGreen, color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              {submitting ? 'Registering...' : <><i className="fa fa-check" style={{ marginRight: '8px' }}></i> Register School</>}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Success */}
      {step === 3 && createdSchool && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '28px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <i className="fa fa-check" style={{ fontSize: '28px', color: '#059669' }}></i>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>School Registered Successfully!</h2>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px' }}>{createdSchool.name} has been registered and is ready for use.</p>
          
          <div style={{ padding: '16px', borderRadius: '10px', background: '#f3f4f6', textAlign: 'left', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: '0 0 12px' }}>School Details</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Name: {createdSchool.name}</p>
            {createdSchool.email && <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Email: {createdSchool.email}</p>}
            {createdSchool.phone && <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Phone: {createdSchool.phone}</p>}
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Status: <span style={{ textTransform: 'capitalize' }}>{createdSchool.subscriptionStatus || 'active'}</span></p>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>Tier: <span style={{ textTransform: 'capitalize' }}>{createdSchool.subscriptionTier || 'basic'}</span></p>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link href="/super-admin/schools" style={{ padding: '12px 24px', background: '#fefcf9', border: '1px solid #d1d5db', borderRadius: '10px', color: '#374151', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-arrow-left"></i> Back to Schools
            </Link>
            <Link href={`/super-admin/schools/${createdSchool.id}`} style={{ padding: '12px 24px', background: gradBlue, color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              View Details <i className="fa fa-arrow-right"></i>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}