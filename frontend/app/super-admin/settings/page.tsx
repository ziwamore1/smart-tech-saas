'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi } from '@/lib/api';

interface Setting {
  id: string;
  key: string;
  value: any;
  isPublic: boolean;
}

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'security' | 'system' | 'communication'>('general');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [generalSettings, setGeneralSettings] = useState({
    systemName: 'Smart Tech SaaS',
    supportEmail: '',
    supportPhone: '',
    address: '',
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
  });

  const [securitySettings, setSecuritySettings] = useState({
    jwtSecret: '',
    sessionTimeout: '60',
    maxLoginAttempts: '5',
    passwordMinLength: '8',
  });

  const [commSettings, setCommSettings] = useState({
    messagingSandboxMode: 'true',
    beemEnabled: 'true',
    beemApiKey: '',
    beemSenderName: '',
    sendgridConfigured: false,
    zohoConfigured: false,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await superAdminApi.getAllSettings();
      const allSettings = response.data?.data || response.data || [];
      setSettings(allSettings);
      const getVal = (key: string, def: string = '') => {
        const s = allSettings.find((x: any) => x.key === key);
        return s ? String(s.value) : def;
      };
      setCommSettings({
        messagingSandboxMode: getVal('messaging_sandbox_mode', 'true'),
        beemEnabled: getVal('beem_enabled', 'true'),
        beemApiKey: getVal('beem_api_key', ''),
        beemSenderName: getVal('beem_sender_name', 'SmartTech'),
        sendgridConfigured: !!getVal('sendgrid_api_key', ''),
        zohoConfigured: !!getVal('zoho_smtp_host', ''),
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: any) => {
    try {
      setSaving(true);
      await superAdminApi.updateSetting(key, value);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
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
            background: 'linear-gradient(135deg, #6b7280, #4b5563)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '18px'
          }}>
            <i className="fa fa-cog"></i>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#6b7280',
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
        .tab-btn { transition: all 0.2s ease; cursor: pointer; }
        .tab-btn.active { background: linear-gradient(135deg, #3b82f6, #2563eb) !important; color: white !important; box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
        .input-field { transition: all 0.2s ease; }
        .input-field:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .action-card { transition: all 0.2s ease; cursor: pointer; }
        .action-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
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
              background: 'linear-gradient(135deg, #6b7280, #4b5563)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="fa fa-cog" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Settings
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage system configuration</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 500
        }}>
          <i className={`fa ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '8px', borderBottom: '1px solid #e8ddd0' }}>
        {[
          { key: 'general', label: 'General', icon: 'fa-cog' },
          { key: 'email', label: 'Email', icon: 'fa-envelope' },
          { key: 'security', label: 'Security', icon: 'fa-shield' },
          { key: 'system', label: 'System', icon: 'fa-info-circle' },
          { key: 'communication', label: 'Communication', icon: 'fa-comments' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            style={{
              padding: '10px 18px',
              borderRadius: '8px 8px 0 0',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              background: activeTab === tab.key ? '#3b82f6' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className={`fa ${tab.icon}`} style={{ fontSize: '12px' }}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'general' && (
        <div style={{
          background: '#fefcf9',
          borderRadius: '16px',
          border: '1px solid #f3f4f6',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>General Settings</h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>System Name</label>
              <input
                type="text"
                value={generalSettings.systemName}
                onChange={(e) => setGeneralSettings({ ...generalSettings, systemName: e.target.value })}
                className="input-field"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Support Email</label>
                <input
                  type="email"
                  value={generalSettings.supportEmail}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Support Phone</label>
                <input
                  type="tel"
                  value={generalSettings.supportPhone}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, supportPhone: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => handleSave('general', generalSettings)}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                borderRadius: '10px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div style={{
          background: '#fefcf9',
          borderRadius: '16px',
          border: '1px solid #f3f4f6',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Email Settings</h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>SMTP Host</label>
                <input
                  type="text"
                  value={emailSettings.smtpHost}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>SMTP Port</label>
                <input
                  type="number"
                  value={emailSettings.smtpPort}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>SMTP Username</label>
                <input
                  type="text"
                  value={emailSettings.smtpUser}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>SMTP Password</label>
                <input
                  type="password"
                  value={emailSettings.smtpPassword}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => handleSave('email', emailSettings)}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                borderRadius: '10px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div style={{
          background: '#fefcf9',
          borderRadius: '16px',
          border: '1px solid #f3f4f6',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Security Settings</h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Max Login Attempts</label>
                <input
                  type="number"
                  value={securitySettings.maxLoginAttempts}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: e.target.value })}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => handleSave('security', securitySettings)}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                borderRadius: '10px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
          {/* System Info */}
          <div style={{
            background: '#fefcf9',
            borderRadius: '16px',
            border: '1px solid #f3f4f6',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>System Information</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Application Name</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{generalSettings.systemName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Version</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>1.0.0</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Environment</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>Development</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Total Settings</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{settings.length}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{
            background: '#fefcf9',
            borderRadius: '16px',
            border: '1px solid #f3f4f6',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px' }}>Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="action-card" style={{
                width: '100%',
                padding: '14px 16px',
                background: '#f3f4f6',
                borderRadius: '10px',
                border: 'none',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}>
                <span>Export Settings</span>
                <i className="fa fa-download" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
              <button className="action-card" style={{
                width: '100%',
                padding: '14px 16px',
                background: '#f3f4f6',
                borderRadius: '10px',
                border: 'none',
                color: '#374151',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}>
                <span>Import Settings</span>
                <i className="fa fa-upload" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
              <button className="action-card" style={{
                width: '100%',
                padding: '14px 16px',
                background: '#fef2f2',
                borderRadius: '10px',
                border: 'none',
                color: '#dc2626',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}>
                <span>Reset to Defaults</span>
                <i className="fa fa-refresh" style={{ fontSize: '14px', color: '#ef4444' }}></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'communication' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-flask" style={{ color: '#14b8a6' }}></i> Sandbox Mode
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 20px' }}>When enabled, all messages are logged but NOT actually sent. Disable for production.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f9fafb', borderRadius: '10px' }}>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
                <input
                  type="checkbox"
                  checked={commSettings.messagingSandboxMode === 'true'}
                  onChange={(e) => setCommSettings({ ...commSettings, messagingSandboxMode: e.target.checked ? 'true' : 'false' })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: commSettings.messagingSandboxMode === 'true' ? '#10b981' : '#d1d5db',
                  borderRadius: '26px', transition: '0.3s',
                }}>
                  <span style={{
                    position: 'absolute', height: '20px', width: '20px', borderRadius: '50%',
                    backgroundColor: 'white', top: '3px',
                    left: commSettings.messagingSandboxMode === 'true' ? '25px' : '3px',
                    transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </span>
              </label>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                {commSettings.messagingSandboxMode === 'true' ? 'Sandbox Mode Active - Messages are simulated' : 'Live Mode - Messages will be sent'}
              </span>
            </div>
          </div>

          <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-server" style={{ color: '#3b82f6' }}></i> Configured Providers
            </h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: commSettings.sendgridConfigured || commSettings.zohoConfigured ? '#f0fdf4' : '#fef2f2', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: '#dbeafe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa fa-envelope" style={{ color: '#2563eb', fontSize: '18px' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>Email (SendGrid / Zoho)</div>
                    <div style={{ fontSize: '12px', color: commSettings.sendgridConfigured || commSettings.zohoConfigured ? '#059669' : '#dc2626' }}>
                      {commSettings.sendgridConfigured || commSettings.zohoConfigured ? 'Configured' : 'Not configured'}
                    </div>
                  </div>
                </div>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: commSettings.sendgridConfigured || commSettings.zohoConfigured ? '#10b981' : '#ef4444' }}></span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: commSettings.beemEnabled === 'true' ? '#f0fdf4' : '#fef2f2', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: '#fef3c7', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa fa-comment" style={{ color: '#d97706', fontSize: '18px' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>SMS (Beem Africa)</div>
                    <div style={{ fontSize: '12px', color: commSettings.beemEnabled === 'true' ? '#059669' : '#dc2626' }}>
                      {commSettings.beemEnabled === 'true' ? 'Configured' : 'Not configured'} {commSettings.beemSenderName ? `- Sender: ${commSettings.beemSenderName}` : ''}
                    </div>
                  </div>
                </div>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: commSettings.beemEnabled === 'true' ? '#10b981' : '#ef4444' }}></span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: commSettings.beemEnabled === 'true' ? '#f0fdf4' : '#fef2f2', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: '#d1fae5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa fa-whatsapp" style={{ color: '#059669', fontSize: '18px' }}></i>
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>WhatsApp (Beem Africa)</div>
                    <div style={{ fontSize: '12px', color: commSettings.beemEnabled === 'true' ? '#059669' : '#dc2626' }}>
                      {commSettings.beemEnabled === 'true' ? 'Configured' : 'Not configured'}
                    </div>
                  </div>
                </div>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: commSettings.beemEnabled === 'true' ? '#10b981' : '#ef4444' }}></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => handleSave('messaging_sandbox_mode', commSettings.messagingSandboxMode)}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                borderRadius: '10px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}