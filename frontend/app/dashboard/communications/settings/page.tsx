'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationsCloudApi } from '@/lib/api';

const providerOptions = {
  email: [
    { value: 'zoho', label: 'Zoho Mail' },
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'gmail_smtp', label: 'Gmail SMTP' },
    { value: 'outlook_smtp', label: 'Outlook SMTP' },
    { value: 'custom_smtp', label: 'Custom SMTP' },
  ],
  sms: [
    { value: 'zamtel', label: 'Zamtel (Standard API)' },
    { value: 'zamtel-bulk', label: 'Zamtel Bulk SMS (bulksms.zamtel.co.zm)' },
    { value: 'beem', label: 'Beem Africa' },
    { value: 'airtel', label: 'Airtel' },
    { value: 'mtn', label: 'MTN' },
    { value: 'twilio', label: 'Twilio' },
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
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['school-comm-settings'],
    queryFn: () => communicationsCloudApi.getSchoolSettings().then(r => r.data?.settings || r.data),
  });

  const { data: systemProviders } = useQuery({
    queryKey: ['system-sms-providers'],
    queryFn: () => communicationsCloudApi.getSchoolSettings().then(r => r.data?.availableProviders || []),
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
    mutationFn: (data: any) => communicationsCloudApi.updateSchoolSettings(data),
    onSuccess: () => {
      setSuccessMsg('Communication settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['school-comm-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-sms-providers'] });
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

  const handleTestSms = async () => {
    if (!testPhone) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await communicationsCloudApi.sendSchoolSms({
        recipient: testPhone,
        message: 'This is a test SMS from SmartTech. Your SMS configuration is working correctly!',
        senderId: form.smsSenderId || undefined,
      });
      setTestResult({ success: true, message: `Test SMS sent successfully! Message ID: ${res.data?.id || 'N/A'}` });
    } catch (err: any) {
      setTestResult({ success: false, message: err?.response?.data?.message || err?.message || 'Failed to send test SMS' });
    }
    setTestLoading(false);
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
          <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
            <i className="fa fa-info-circle" style={{ marginRight: '8px' }}></i>
            <strong>How SMS routing works:</strong> When sending SMS, the system first checks your school's SMS configuration below. If your school has SMS enabled with a valid provider and API key, it uses your credentials. Otherwise, it falls back to the platform-level default provider managed by SuperAdmin.
          </div>

          <div style={{ background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px' }}>
              <i className="fa fa-mobile-alt" style={{ color: '#10b981', marginRight: '8px' }}></i>
              School SMS Provider
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>SMS Provider</label>
                <select value={form.smsProvider} onChange={e => setForm({...form, smsProvider: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                  {providerOptions.sms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  {form.smsProvider === 'zamtel-bulk' && 'Uses bulksms.zamtel.co.zm bulk SMS API'}
                  {form.smsProvider === 'zamtel' && 'Uses api.zamtel.zm standard SMS API'}
                  {form.smsProvider === 'beem' && 'Uses Beem Africa SMS gateway'}
                  {form.smsProvider === 'twilio' && 'Uses Twilio Programmable Messaging'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.smsEnabled} onChange={e => setForm({...form, smsEnabled: e.target.checked})}
                    style={{ width: '16px', height: '16px', accentColor: '#ea6645' }} />
                  <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>Enable School SMS</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>API Key</label>
                <input type="text" value={form.smsApiKey} onChange={e => setForm({...form, smsApiKey: e.target.value})}
                  placeholder={form.smsProvider === 'twilio' ? 'Twilio Account SID' : form.smsProvider === 'zamtel-bulk' ? 'Zamtel Bulk SMS API Key' : 'API Key'}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>API Secret</label>
                <input type="password" value={form.smsApiSecret} onChange={e => setForm({...form, smsApiSecret: e.target.value})}
                  placeholder={form.smsProvider === 'twilio' ? 'Twilio Auth Token' : 'API Secret'}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Sender ID</label>
                <input type="text" value={form.smsSenderId} onChange={e => setForm({...form, smsSenderId: e.target.value})}
                  placeholder={form.smsProvider === 'zamtel-bulk' ? 'SMARTTECH' : 'SchoolName'}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                  {form.smsProvider === 'zamtel-bulk' ? 'Alphanumeric sender ID (e.g. SMARTTECH)' : 'Default sender identifier'}
                </p>
              </div>
            </div>
            {form.smsEnabled && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#065f46' }}>
                  <i className="fa fa-check-circle" style={{ marginRight: '6px' }}></i>
                  School SMS is <strong>enabled</strong>.
                </p>
              </div>
            )}
            {!form.smsEnabled && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                  <i className="fa fa-info-circle" style={{ marginRight: '6px' }}></i>
                  School SMS is <strong>disabled</strong>. SMS will fall back to the platform default provider.
                </p>
              </div>
            )}
          </div>

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
            <button onClick={() => setShowTestModal(true)} disabled={!form.smsEnabled}
              style={{ padding: '12px 24px', background: 'white', color: '#374151', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-paper-plane"></i>
              Send Test SMS
            </button>
            <button onClick={handleSave} disabled={updateMutation.isPending}
              style={{ padding: '12px 24px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-save"></i>
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px', background: '#fdfaf7', borderRadius: '8px', border: '1px solid #e8ddd0' }}>
        <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
          <i className="fa fa-info-circle" style={{ marginRight: '6px' }}></i>
          <strong>Provider Resolution Order:</strong> School credentials (above) &rarr; System default provider (SuperAdmin) &rarr; Env-configured fallback (Twilio/Beem).
          Your school communication settings are isolated from other schools.
        </p>
      </div>

      {showTestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>
              <i className="fa fa-paper-plane" style={{ color: '#ea6645', marginRight: '8px' }}></i>
              Send Test SMS
            </h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>
              Send a test message to verify your SMS configuration.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Phone Number</label>
                <input type="text" value={testPhone} onChange={e => setTestPhone(e.target.value)}
                  placeholder="+26097XXXXXXX"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px' }} />
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Enter phone number with country code (e.g. +26097...)</p>
              </div>
              <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e' }}>
                <i className="fa fa-info-circle" style={{ marginRight: '6px' }}></i>
                A test SMS will be sent using your current provider configuration: <strong>{providerOptions.sms.find(p => p.value === form.smsProvider)?.label || form.smsProvider}</strong>
                {form.smsSenderId ? ` from sender ID "${form.smsSenderId}"` : ''}.
              </div>
              {testResult && (
                <div style={{ padding: '12px', borderRadius: '8px', fontSize: '13px', background: testResult.success ? '#ecfdf5' : '#fef2f2', border: `1px solid ${testResult.success ? '#a7f3d0' : '#fecaca'}`, color: testResult.success ? '#065f46' : '#991b1b' }}>
                  <i className={`fa ${testResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ marginRight: '6px' }}></i>
                  {testResult.message}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={() => { setShowTestModal(false); setTestResult(null); setTestPhone(''); }}
                style={{ padding: '10px 20px', background: 'white', color: '#374151', border: '1px solid #e8ddd0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleTestSms} disabled={testLoading || !testPhone}
                style={{ padding: '10px 20px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {testLoading ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-paper-plane"></i>}
                {testLoading ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
