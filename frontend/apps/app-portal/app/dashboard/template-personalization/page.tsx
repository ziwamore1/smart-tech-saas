'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';

interface PersonalizationSettings {
  logo: string;
  motto: string;
  primaryColor: string;
  secondaryColor: string;
  directorSignature: string;
  schoolStamp: string;
  headerText: string;
  footerText: string;
  includeLogo: boolean;
  includeStamp: boolean;
  includeSignature: boolean;
  includeRankings: boolean;
  includeComments: boolean;
  includeGrading: boolean;
  remarksEnabled: boolean;
  attendanceRules: string;
  gradingRules: string;
}

export default function TemplatePersonalizationPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'branding' | 'layout' | 'rules' | 'remarks' | 'marketplace'>('branding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [marketplaceTemplates, setMarketplaceTemplates] = useState<any[]>([]);
  const [settings, setSettings] = useState<PersonalizationSettings>({
    logo: '', motto: '', primaryColor: '#1a365d', secondaryColor: '#f5f5f5',
    directorSignature: '', schoolStamp: '', headerText: 'ACADEMIC REPORT',
    footerText: 'This is a computer-generated report',
    includeLogo: true, includeStamp: false, includeSignature: true,
    includeRankings: true, includeComments: true, includeGrading: true,
    remarksEnabled: true, attendanceRules: '', gradingRules: '',
  });
  const [aiRemarks, setAiRemarks] = useState({ type: 'teacher', studentName: '', academicPerformance: '', attendance: '', discipline: '', assessmentResults: '', result: '' });
  const [generatingRemarks, setGeneratingRemarks] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.schoolId) loadData();
  }, [isAuthenticated, user?.schoolId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [schoolRes, tplRes, marketRes, brandingRes] = await Promise.all([
        api.get('/school/current'),
        api.get('/template-builder'),
        api.get('/template-builder/marketplace'),
        api.get('/template-builder/branding'),
      ]);

      const schoolData = schoolRes.data?.data || schoolRes.data;
      const tplData = tplRes.data?.data || tplRes.data || [];
      const marketData = marketRes.data?.data || marketRes.data || [];
      const brandingData = brandingRes.data?.data || brandingRes.data || [];

      setSchool(schoolData);
      setTemplates(Array.isArray(tplData) ? tplData : []);
      setMarketplaceTemplates(Array.isArray(marketData) ? marketData : []);

      if (schoolData) {
        setSettings(prev => ({
          ...prev,
          logo: schoolData.logoUrl || schoolData.logo || '',
          motto: schoolData.motto || '',
          primaryColor: schoolData.primaryColor || '#1a365d',
          directorSignature: schoolData.directorSignature || '',
          schoolStamp: schoolData.SchoolStamp || '',
        }));
      }

      if (brandingData && brandingData.length > 0) {
        const preset = brandingData[0];
        setSettings(prev => ({
          ...prev,
          primaryColor: preset.primaryColor || prev.primaryColor,
          secondaryColor: preset.secondaryColor || prev.secondaryColor,
          headerText: preset.headerText || prev.headerText,
          footerText: preset.footerText || prev.footerText,
        }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (school?.id) {
        await api.patch('/school/profile', {
          logoUrl: settings.logo,
          motto: settings.motto,
          primaryColor: settings.primaryColor,
          directorSignature: settings.directorSignature,
          SchoolStamp: settings.schoolStamp,
        });
      }
      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateRemarks = async () => {
    try {
      setGeneratingRemarks(true);
      const res = await api.post('/super-admin/academic-templates/ai-remarks/generate', {
        type: aiRemarks.type,
        studentName: aiRemarks.studentName,
        academicPerformance: aiRemarks.academicPerformance,
        attendance: aiRemarks.attendance,
        discipline: aiRemarks.discipline,
        assessmentResults: aiRemarks.assessmentResults,
      });
      const data = res.data?.data || res.data;
      setAiRemarks(prev => ({ ...prev, result: data.remark || '' }));
    } catch (err) {
      console.error('Generate remarks failed:', err);
    } finally {
      setGeneratingRemarks(false);
    }
  };

  const handleDownloadTemplate = async (marketplaceId: string) => {
    try {
      await api.post(`/template-builder/marketplace/download/${marketplaceId}`);
      alert('Template downloaded from marketplace!');
      loadData();
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-palette"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .tab-link { transition: all 0.2s ease; cursor: pointer; }
        .tab-link:hover { background: #f5efe8; }
        .settings-card { transition: all 0.2s ease; }
        .settings-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-palette" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Template Personalization
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Customize your school's report templates</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#fefcf9', borderRadius: '12px', padding: '4px', border: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
        {[
          { key: 'branding', label: 'Branding', icon: 'palette' },
          { key: 'layout', label: 'Layout Settings', icon: 'cog' },
          { key: 'rules', label: 'Rules', icon: 'clipboard-list' },
          { key: 'remarks', label: 'AI Remarks', icon: 'comment-dots' },
          { key: 'marketplace', label: 'Marketplace', icon: 'store' },
        ].map(tab => (
          <button
            key={tab.key}
            className="tab-link"
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '12px 20px', border: 'none', borderRadius: '8px',
              background: activeTab === tab.key ? gradOrange : 'transparent',
              color: activeTab === tab.key ? 'white' : '#6b7280',
              fontWeight: activeTab === tab.key ? 600 : 500,
              fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <i className={`fa fa-${tab.icon}`}></i> {tab.label}
          </button>
        ))}
      </div>

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="settings-card" style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-building" style={{ color: '#ea6645' }}></i>
              School Branding
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>School Logo URL</label>
                <input type="text" value={settings.logo} onChange={e => setSettings(s => ({ ...s, logo: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>School Motto</label>
                <input type="text" value={settings.motto} onChange={e => setSettings(s => ({ ...s, motto: e.target.value }))}
                  placeholder="Enter school motto"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Primary Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={settings.primaryColor} onChange={e => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                    style={{ width: '48px', height: '40px', padding: '2px', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer' }} />
                  <input type="text" value={settings.primaryColor} onChange={e => setSettings(s => ({ ...s, primaryColor: e.target.value }))}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Secondary Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={settings.secondaryColor} onChange={e => setSettings(s => ({ ...s, secondaryColor: e.target.value }))}
                    style={{ width: '48px', height: '40px', padding: '2px', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer' }} />
                  <input type="text" value={settings.secondaryColor} onChange={e => setSettings(s => ({ ...s, secondaryColor: e.target.value }))}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Signature URL</label>
                <input type="text" value={settings.directorSignature} onChange={e => setSettings(s => ({ ...s, directorSignature: e.target.value }))}
                  placeholder="https://example.com/signature.png"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>School Stamp URL</label>
                <input type="text" value={settings.schoolStamp} onChange={e => setSettings(s => ({ ...s, schoolStamp: e.target.value }))}
                  placeholder="https://example.com/stamp.png"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
              <div style={{ width: '48px', height: '48px', background: settings.primaryColor, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '20px' }}>
                ST
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: settings.primaryColor }}>{school?.name || 'Your School Name'}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{settings.motto || 'School Motto'}</div>
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-end', padding: '12px 32px', background: gradOrange, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1 }}>
            <i className={`fa ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
            {saving ? 'Saving...' : 'Save Branding'}
          </button>
        </div>
      )}

      {/* Layout Settings Tab */}
      {activeTab === 'layout' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-cog" style={{ color: '#ea6645' }}></i>
            Report Layout Settings
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Header Text</label>
              <input type="text" value={settings.headerText} onChange={e => setSettings(s => ({ ...s, headerText: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Footer Text</label>
              <input type="text" value={settings.footerText} onChange={e => setSettings(s => ({ ...s, footerText: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {[
              { key: 'includeLogo', label: 'Show School Logo' },
              { key: 'includeStamp', label: 'Show School Stamp' },
              { key: 'includeSignature', label: 'Show Signatures' },
              { key: 'includeRankings', label: 'Show Rankings' },
              { key: 'includeComments', label: 'Show Comments' },
              { key: 'includeGrading', label: 'Show Grading' },
              { key: 'remarksEnabled', label: 'Enable Remarks' },
            ].map(toggle => (
              <label key={toggle.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', cursor: 'pointer' }}>
                <div
                  onClick={() => setSettings(s => ({ ...s, [toggle.key]: !(s as any)[toggle.key] }))}
                  style={{
                    width: '20px', height: '20px', borderRadius: '6px',
                    border: (settings as any)[toggle.key] ? 'none' : '2px solid #d1d5db',
                    background: (settings as any)[toggle.key] ? gradGreen : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}
                >
                  {(settings as any)[toggle.key] && <i className="fa fa-check" style={{ fontSize: '11px', color: 'white' }}></i>}
                </div>
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{toggle.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-clipboard-list" style={{ color: '#ea6645' }}></i>
            Custom Rules
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>Attendance Rules</label>
              <textarea value={settings.attendanceRules} onChange={e => setSettings(s => ({ ...s, attendanceRules: e.target.value }))}
                placeholder="Define attendance calculation rules (e.g., percentage thresholds for pass/fail)..."
                rows={4}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px' }}>Grading Rules</label>
              <textarea value={settings.gradingRules} onChange={e => setSettings(s => ({ ...s, gradingRules: e.target.value }))}
                placeholder="Define grading scale rules (e.g., A: 80-100%, B: 70-79%, etc.)..."
                rows={4}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      )}

      {/* AI Remarks Tab */}
      {activeTab === 'remarks' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-robot" style={{ color: '#ea6645' }}></i>
            AI Remarks Generator
          </h3>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px' }}>Generate professional remarks based on student performance data</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Remark Type</label>
              <select value={aiRemarks.type} onChange={e => setAiRemarks(s => ({ ...s, type: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                <option value="teacher">Teacher Remark</option>
                <option value="class_teacher">Class Teacher Remark</option>
                <option value="head_teacher">Head Teacher Remark</option>
                <option value="promotion">Promotion Remark</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Student Name</label>
              <input type="text" value={aiRemarks.studentName} onChange={e => setAiRemarks(s => ({ ...s, studentName: e.target.value }))}
                placeholder="e.g., John Doe"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Academic Performance</label>
              <select value={aiRemarks.academicPerformance} onChange={e => setAiRemarks(s => ({ ...s, academicPerformance: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                <option value="">Select performance</option>
                <option value="Excellent">Excellent</option>
                <option value="Very Good">Very Good</option>
                <option value="Good">Good</option>
                <option value="Satisfactory">Satisfactory</option>
                <option value="Fair">Fair</option>
                <option value="Needs Improvement">Needs Improvement</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Attendance</label>
              <select value={aiRemarks.attendance} onChange={e => setAiRemarks(s => ({ ...s, attendance: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                <option value="">Select attendance</option>
                <option value="Excellent (95%+)">Excellent (95%+)</option>
                <option value="Good (85-94%)">Good (85-94%)</option>
                <option value="Satisfactory (75-84%)">Satisfactory (75-84%)</option>
                <option value="Poor (Below 75%)">Poor (Below 75%)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Discipline</label>
              <select value={aiRemarks.discipline} onChange={e => setAiRemarks(s => ({ ...s, discipline: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                <option value="">Select discipline</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Satisfactory">Satisfactory</option>
                <option value="Needs Improvement">Needs Improvement</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Assessment Results</label>
              <input type="text" value={aiRemarks.assessmentResults} onChange={e => setAiRemarks(s => ({ ...s, assessmentResults: e.target.value }))}
                placeholder="e.g., Average score: 72%"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button onClick={handleGenerateRemarks} disabled={generatingRemarks} style={{ marginTop: '20px', padding: '12px 32px', background: gradPurple, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: generatingRemarks ? 0.7 : 1 }}>
            <i className={`fa ${generatingRemarks ? 'fa-spinner fa-spin' : 'fa-magic'}`}></i>
            {generatingRemarks ? 'Generating...' : 'Generate Remark'}
          </button>
          {aiRemarks.result && (
            <div style={{ marginTop: '20px', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <i className="fa fa-comment-dots" style={{ color: '#16a34a' }}></i>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534', textTransform: 'capitalize' }}>{aiRemarks.type.replace('_', ' ')} Remark</span>
              </div>
              <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: 1.6 }}>{aiRemarks.result}</p>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button onClick={() => { navigator.clipboard.writeText(aiRemarks.result); }} style={{ padding: '6px 14px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa fa-copy"></i> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Marketplace Tab */}
      {activeTab === 'marketplace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-store" style={{ color: '#ea6645' }}></i>
              Available Templates from Marketplace
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px' }}>Browse and download professionally designed templates</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {marketplaceTemplates.map((tpl: any) => (
                <div key={tpl.id} style={{ padding: '20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa fa-file-alt" style={{ color: '#7c3aed' }}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{tpl.title}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{tpl.template?.templateType || 'Report Card'}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.4 }}>{tpl.description || 'Professional template'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', fontSize: '12px', color: '#6b7280' }}>
                    <span><i className="fa fa-download" style={{ marginRight: '4px' }}></i> {tpl.downloads || 0}</span>
                    <span><i className="fa fa-heart" style={{ marginRight: '4px', color: '#ef4444' }}></i> {tpl.likes || 0}</span>
                    <span><i className="fa fa-building" style={{ marginRight: '4px' }}></i> {tpl.school?.name || 'System'}</span>
                  </div>
                  <button onClick={() => handleDownloadTemplate(tpl.id)} style={{ width: '100%', padding: '8px 16px', background: gradPurple, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <i className="fa fa-download"></i> Download Template
                  </button>
                </div>
              ))}
              {marketplaceTemplates.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                  <i className="fa fa-store" style={{ fontSize: '36px', color: '#d1d5db', marginBottom: '8px', display: 'block' }}></i>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No templates available in marketplace</p>
                </div>
              )}
            </div>
          </div>

          {/* Your Templates */}
          <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-file-alt" style={{ color: '#ea6645' }}></i>
              Your Templates
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {templates.map((tpl: any) => (
                <div key={tpl.id} style={{ padding: '20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px',
                      background: `linear-gradient(135deg, ${tpl.primaryColor || '#1a365d'}, ${tpl.secondaryColor || '#f5f5f5'})`,
                      borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className="fa fa-file-alt" style={{ color: 'white' }}></i>
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{tpl.name}</div>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: tpl.status === 'PUBLISHED' ? '#d1fae5' : '#fef3c7', color: tpl.status === 'PUBLISHED' ? '#065f46' : '#92400e', fontWeight: 500 }}>
                          {tpl.status}
                        </span>
                        <span style={{ color: '#9ca3af' }}>{tpl.templateType}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => router.push('/dashboard/template-builder')} style={{ flex: 1, padding: '8px', background: gradBlue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      <i className="fa fa-pen"></i> Edit
                    </button>
                    <button onClick={() => router.push('/dashboard/report-cards')} style={{ flex: 1, padding: '8px', background: gradGreen, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      <i className="fa fa-file-pdf"></i> Generate
                    </button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                  <i className="fa fa-file-alt" style={{ fontSize: '36px', color: '#d1d5db', marginBottom: '8px', display: 'block' }}></i>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No templates yet. Download from marketplace above!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
