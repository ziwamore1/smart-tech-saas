'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { systemCommunicationApi } from '@/lib/api';
import Link from 'next/link';

export default function RegistrationTemplatesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ name: '', subject: '', message: '', category: 'registration' });

  const loadTemplates = async () => {
    try {
      const response = await systemCommunicationApi.getTemplates();
      const body = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setTemplates(body.filter((t: any) => t.type === 'EMAIL'));
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Could not load email templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTemplates();
    }
  }, [isAuthenticated]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.message.trim()) {
      setError('Template name and message are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await systemCommunicationApi.createTemplate({ name: form.name, type: 'EMAIL', subject: form.subject, message: form.message, category: form.category });
      setForm({ name: '', subject: '', message: '', category: 'registration' });
      setShowForm(false);
      await loadTemplates();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save template.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try {
      await systemCommunicationApi.deleteTemplate(id);
      await loadTemplates();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete template.');
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/super-admin/registrations" style={{ color: '#9ca3af', fontSize: '20px' }}><i className="fa fa-arrow-left"></i></Link>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-envelope-open-text" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Registration Email Templates</h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Reusable messages to respond to school registration requests</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
        >
          <i className="fa fa-plus"></i> New Template
        </button>
      </div>

      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', color: '#92400e' }}>
        <i className="fa fa-info-circle"></i> You can use placeholders in your message: <strong>{'{directorFirstName}'}</strong>, <strong>{'{schoolName}'}</strong>, <strong>{'{registrationNumber}'}</strong>, <strong>{'{trialEndsAt}'}</strong>.
      </div>

      {showForm && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}><i className="fa fa-pen"></i> New Email Template</h2>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Template name (e.g. Onboarding Guide)" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '13px' }} />
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Email subject" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '13px' }} />
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Email message…" rows={5} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '13px', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleCreate} disabled={busy} style={{ padding: '11px 20px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              {busy ? 'Saving…' : 'Save Template'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '11px 20px', background: '#fefcf9', border: '1px solid #e8ddd0', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#6b7280' }}>Cancel</button>
          </div>
          {error && <p style={{ margin: 0, fontSize: '13px', color: '#dc2626' }}>{error}</p>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {templates.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>No email templates yet. Click "New Template" to create one.</p>
        ) : (
          templates.map((t: any) => (
            <div key={t.id} style={{ background: '#fefcf9', borderRadius: '16px', padding: '18px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{t.name}</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {t.isDefault && <span style={{ fontSize: '10px', fontWeight: 600, color: '#059669', background: '#d1fae5', padding: '3px 8px', borderRadius: '999px' }}>DEFAULT</span>}
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#7c3aed', background: '#ede9fe', padding: '3px 8px', borderRadius: '999px' }}>{String(t.category || 'email').toUpperCase()}</span>
                </div>
              </div>
              {t.subject && <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}><strong>Subject:</strong> {t.subject}</p>}
              <p style={{ margin: 0, fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '160px', overflow: 'auto', background: '#fdfaf7', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '10px' }}>{t.message}</p>
              <button onClick={() => handleDelete(t.id, t.name)} style={{ alignSelf: 'flex-end', padding: '7px 12px', background: '#fefcf9', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>
                <i className="fa fa-trash"></i> Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
