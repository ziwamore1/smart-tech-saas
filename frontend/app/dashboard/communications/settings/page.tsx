'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationApi } from '@/lib/api';

const providerOptions = {
  email: [
    { value: 'zoho', label: 'Zoho Mail' },
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'gmail_smtp', label: 'Gmail SMTP' },
    { value: 'outlook_smtp', label: 'Outlook SMTP' },
    { value: 'custom_smtp', label: 'Custom SMTP' },
  ],
  sms: [
    { value: 'beem', label: 'Beem Africa' },
    { value: 'zamtel', label: 'Zamtel' },
    { value: 'airtel', label: 'Airtel' },
    { value: 'mtn', label: 'MTN' },
    { value: 'custom_sms', label: 'Custom SMS Gateway' },
  ],
  whatsapp: [
    { value: 'beem_whatsapp', label: 'Beem WhatsApp' },
    { value: 'meta_cloud', label: 'Meta Cloud API' },
  ],
};

export default function SchoolCommunicationSettingsPage() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['communication-settings'],
    queryFn: () => communicationApi.getSettings().then(r => r.data),
  });

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (settings) {
      setForm({
        smsProvider: settings.smsProvider || 'beem',
        smsApiKey: settings.smsApiKey || '',
        smsApiSecret: settings.smsApiSecret || '',
        smsSenderId: settings.smsSenderId || '',
        smsEnabled: settings.smsEnabled ?? false,
        emailProvider: settings.emailProvider || 'zoho',
        smtpHost: settings.smtpHost || '',
        smtpPort: settings.smtpPort || 587,
        smtpUser: settings.smtpUser || '',
        smtpPassword: settings.smtpPassword || '',
        smtpFromEmail: settings.smtpFromEmail || '',
        smtpFromName: settings.smtpFromName || '',
        emailEnabled: settings.emailEnabled ?? false,
        whatsappProvider: settings.whatsappProvider || 'beem_whatsapp',
        whatsappApiKey: settings.whatsappApiKey || '',
        whatsappApiSecret: settings.whatsappApiSecret || '',
        whatsappPhoneId: settings.whatsappPhoneId || '',
        whatsappEnabled: settings.whatsappEnabled ?? false,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => communicationApi.updateSettings(data),
    onSuccess: () => {
      setSuccessMsg('Communication settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['communication-settings'] });
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.message || 'Failed to save settings');
      setTimeout(() => setErrorMsg(''), 5000);
    },
  });

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>School Communication Settings</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
          Configure your own communication providers. These settings are isolated to your school only.
        </p>
      </div>

      {successMsg && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '14px', marginBottom: '16px' }}>
          <i className="fa fa-check-circle" style={{ marginRight: '8px' }}></i>{successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '14px', marginBottom: '16px' }}>
          <i className="fa fa-exclamation-circle" style={{ marginRight: '8px' }}></i>{errorMsg}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading settings...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-envelope" style={{ color: '#3b82f6', marginRight: '8px' }}></i>
              Email Provider
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Provider</label>
                <select value={form.emailProvider} onChange={e => setForm({...form, emailProvider: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                  {providerOptions.email.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.emailEnabled} onChange={e => setForm({...form, emailEnabled: e.target.checked})}
                    style={{ width: '16px', height: '16px', accentColor: '#ea6645' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Enable Email</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>SMTP Host</label>
                <input type="text" value={form.smtpHost} onChange={e => setForm({...form, smtpHost: e.target.value})}
                  placeholder="smtp.example.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>SMTP Port</label>
                <input type="number" value={form.smtpPort} onChange={e => setForm({...form, smtpPort: parseInt(e.target.value) || 587})}
                  placeholder="587" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Username</label>
                <input type="text" value={form.smtpUser} onChange={e => setForm({...form, smtpUser: e.target.value})}
                  placeholder="email@school.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Password / App Password</label>
                <input type="password" value={form.smtpPassword} onChange={e => setForm({...form, smtpPassword: e.target.value})}
                  placeholder="••••••••" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Sender Email</label>
                <input type="email" value={form.smtpFromEmail} onChange={e => setForm({...form, smtpFromEmail: e.target.value})}
                  placeholder="notifications@school.com" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Sender Name</label>
                <input type="text" value={form.smtpFromName} onChange={e => setForm({...form, smtpFromName: e.target.value})}
                  placeholder="School Name" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>
          </div>

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-mobile-alt" style={{ color: '#10b981', marginRight: '8px' }}></i>
              SMS Provider
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Provider</label>
                <select value={form.smsProvider} onChange={e => setForm({...form, smsProvider: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                  {providerOptions.sms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.smsEnabled} onChange={e => setForm({...form, smsEnabled: e.target.checked})}
                    style={{ width: '16px', height: '16px', accentColor: '#ea6645' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Enable SMS</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>API Key</label>
                <input type="text" value={form.smsApiKey} onChange={e => setForm({...form, smsApiKey: e.target.value})}
                  placeholder="API Key" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>API Secret</label>
                <input type="password" value={form.smsApiSecret} onChange={e => setForm({...form, smsApiSecret: e.target.value})}
                  placeholder="API Secret" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Sender ID</label>
                <input type="text" value={form.smsSenderId} onChange={e => setForm({...form, smsSenderId: e.target.value})}
                  placeholder="SchoolName" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>
          </div>

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-whatsapp" style={{ color: '#25D366', marginRight: '8px' }}></i>
              WhatsApp Provider
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Provider</label>
                <select value={form.whatsappProvider} onChange={e => setForm({...form, whatsappProvider: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                  {providerOptions.whatsapp.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.whatsappEnabled} onChange={e => setForm({...form, whatsappEnabled: e.target.checked})}
                    style={{ width: '16px', height: '16px', accentColor: '#ea6645' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>Enable WhatsApp</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>API Key</label>
                <input type="text" value={form.whatsappApiKey} onChange={e => setForm({...form, whatsappApiKey: e.target.value})}
                  placeholder="API Key" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Phone Number ID</label>
                <input type="text" value={form.whatsappPhoneId} onChange={e => setForm({...form, whatsappPhoneId: e.target.value})}
                  placeholder="WhatsApp Phone ID" style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={handleSave} disabled={updateMutation.isPending}
              style={{ padding: '12px 24px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-save"></i>
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
          <i className="fa fa-info-circle" style={{ marginRight: '6px' }}></i>
          Your school communication settings are completely isolated. They will never consume SuperAdmin resources or be visible to other schools.
        </p>
      </div>
    </div>
  );
}