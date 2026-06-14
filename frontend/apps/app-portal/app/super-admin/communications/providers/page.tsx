'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

const providerTypes = ['All', 'Email', 'SMS', 'WhatsApp', 'Social'] as const;
type ProviderTypeTab = typeof providerTypes[number];

interface Provider {
  id: string;
  name: string;
  type: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'SOCIAL';
  channel?: string;
  status: string;
  senderEmail?: string;
  senderName?: string;
  lastTestedAt?: string;
  isDefault?: boolean;
  host?: string;
  port?: number;
  username?: string;
  apiKey?: string;
  apiSecret?: string;
  password?: string;
  config?: any;
}

const statusStyle = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    'Connected': { bg: '#d1fae5', color: '#059669' },
    'Disconnected': { bg: '#f3f4f6', color: '#6b7280' },
    'Authentication Failed': { bg: '#fee2e2', color: '#dc2626' },
    'Configuration Error': { bg: '#fef3c7', color: '#d97706' },
    'Not Configured': { bg: '#f3f4f6', color: '#9ca3af' },
    'Inactive': { bg: '#f3f4f6', color: '#9ca3af' },
    'Expired Subscription': { bg: '#fee2e2', color: '#dc2626' },
  };
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

const typeIcon = (type: string) => {
  const map: Record<string, string> = {
    EMAIL: 'fa-envelope',
    SMS: 'fa-comment-dots',
    WHATSAPP: 'fa-whatsapp',
    SOCIAL: 'fa-share-alt',
  };
  return map[type] || 'fa-cog';
};

const typeColor = (type: string) => {
  const map: Record<string, string> = {
    EMAIL: '#2563eb',
    SMS: '#d97706',
    WHATSAPP: '#059669',
    SOCIAL: '#8b5cf6',
  };
  return map[type] || '#6b7280';
};

const typeBg = (type: string) => {
  const map: Record<string, string> = {
    EMAIL: '#dbeafe',
    SMS: '#fef3c7',
    WHATSAPP: '#d1fae5',
    SOCIAL: '#f5f3ff',
  };
  return map[type] || '#f3f4f6';
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProviderTypeTab>('All');
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const res = await systemCommunicationApi.getProviders();
      const body = res.data?.statusCode ? res.data.data : res.data;
      setProviders(Array.isArray(body) ? body : []);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = activeTab === 'All'
    ? providers
    : providers.filter((p) => p.type === activeTab.toUpperCase());

  const openEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setSaveError(null);
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingProvider({
      id: '', name: '', type: 'EMAIL', channel: 'EMAIL', status: 'Not Configured',
    });
    setSaveError(null);
    setShowModal(true);
  };

  const handleTestConnection = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await systemCommunicationApi.testProvider(id);
      const body = res.data?.statusCode ? res.data.data : res.data;
      setTestResult({ id, success: body?.status === 'Connected', message: body?.message || 'Connection test completed' });
    } catch (err: any) {
      setTestResult({ id, success: false, message: err?.response?.data?.message || err?.message || 'Connection failed' });
    }
    setTimeout(() => {
      setTesting(null);
      setTestResult(null);
      loadProviders();
    }, 1500);
  };

  const handleSave = async (formData: any) => {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...formData };
      if (payload.port) payload.port = Number(payload.port);
      if (!payload.password) delete payload.password;
      if (!payload.apiKey) delete payload.apiKey;
      if (!payload.apiSecret) delete payload.apiSecret;
      if (editingProvider?.id) {
        await systemCommunicationApi.updateProvider(editingProvider.id, payload);
      } else {
        await systemCommunicationApi.createProvider(payload);
      }
      setShowModal(false);
      await loadProviders();
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err?.message || 'Failed to save provider');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await systemCommunicationApi.deleteProvider(id);
      setShowDelete(null);
      await loadProviders();
    } catch {}
  };

  const handleSetDefault = async (id: string) => {
    try {
      await systemCommunicationApi.setDefaultProvider(id);
      await loadProviders();
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .provider-card { transition: all 0.3s ease; }
        .provider-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .tab-btn { transition: all 0.2s ease; cursor: pointer; }
        .tab-btn:hover { opacity: 0.9; }
        .test-btn { transition: all 0.2s ease; }
        .test-btn:hover { transform: scale(1.05); }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-server" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Communication Providers
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage email, SMS, WhatsApp, and social media providers</p>
        </div>
        <button onClick={openAdd} style={{
          padding: '12px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
          borderRadius: '10px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
        }}>
          <i className="fa fa-plus"></i> Add Provider
        </button>
      </div>

      {/* Test Result Toast */}
      {testResult && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 500,
          background: testResult.success ? '#ecfdf5' : '#fef2f2',
          border: testResult.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
          color: testResult.success ? '#065f46' : '#991b1b',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeIn 0.2s ease',
        }}>
          <i className={`fa ${testResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ fontSize: '16px' }}></i>
          {testResult.message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {providerTypes.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="tab-btn"
            style={{
              padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              border: activeTab === tab ? 'none' : '1px solid #e8ddd0',
              background: activeTab === tab ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#fefcf9',
              color: activeTab === tab ? 'white' : '#6b7280',
              boxShadow: activeTab === tab ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            {tab !== 'All' && <i className={`fa ${typeIcon(tab)}`} style={{ fontSize: '12px' }}></i>}
            {tab}
          </button>
        ))}
      </div>

      {/* Loading / Provider Cards Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: '#9ca3af' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px', marginRight: '12px' }}></i> Loading providers...
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {filtered.map((provider) => {
          const ss = statusStyle(provider.status);
          return (
            <div key={provider.id} className="provider-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
              {provider.isDefault && (
                <span style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa fa-star"></i> Default
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{ width: '44px', height: '44px', background: typeBg(provider.type), borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`fa ${typeIcon(provider.type)}`} style={{ fontSize: '20px', color: typeColor(provider.type) }}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>{provider.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{provider.type} {provider.channel ? `· ${provider.channel}` : ''}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ss.color, flexShrink: 0 }}></span>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: ss.bg, color: ss.color }}>{provider.status}</span>
              </div>

              {provider.senderEmail && (
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  <i className="fa fa-envelope" style={{ marginRight: '6px', color: '#9ca3af', fontSize: '11px' }}></i>
                  {provider.senderEmail}
                </div>
              )}
              {provider.lastTestedAt && (
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                  <i className="fa fa-clock" style={{ marginRight: '6px', fontSize: '11px' }}></i>
                  Last tested: {new Date(provider.lastTestedAt).toLocaleString()}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f3f4f6' }}>
                <button onClick={() => openEdit(provider)} style={{ padding: '8px 14px', background: '#f3f4f6', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa fa-edit"></i> Edit
                </button>
                {provider.status !== 'Not Configured' && provider.status !== 'Inactive' && (
                  <button onClick={() => handleTestConnection(provider.id)} className="test-btn" style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    background: testing === provider.id ? '#d1fae5' : '#eff6ff',
                    color: testing === provider.id ? '#059669' : '#2563eb',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <i className={`fa ${testing === provider.id ? 'fa-spinner fa-spin' : 'fa-plug'}`}></i>
                    {testing === provider.id ? 'Testing...' : 'Test Connection'}
                  </button>
                )}
                {!provider.isDefault && (
                  <button onClick={() => handleSetDefault(provider.id)} style={{ padding: '8px 14px', background: 'transparent', borderRadius: '8px', border: '1px solid #fef3c7', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa fa-star"></i>
                  </button>
                )}
                <button onClick={() => setShowDelete(provider.id)} style={{ padding: '8px 14px', background: 'transparent', borderRadius: '8px', border: '1px solid #fee2e2', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#ef4444', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa fa-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <i className="fa fa-server" style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}></i>
            No providers found
          </div>
        )}
      </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#fdfaf7', borderRadius: '20px', padding: '32px', width: '640px', maxWidth: '95vw',
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa fa-server" style={{ color: '#3b82f6' }}></i>
                {editingProvider?.id ? 'Edit Provider' : 'Add Provider'}
              </h2>
              <button onClick={() => { setShowModal(false); setSaveError(null); }} style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-times" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleSave(Object.fromEntries(fd)); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Provider Name</label>
                  <input type="text" name="name" defaultValue={editingProvider?.name || ''} placeholder="e.g., Zoho Mail" required style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Type</label>
                  <select name="type" defaultValue={editingProvider?.type || 'EMAIL'} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                    <option value="EMAIL">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SOCIAL">Social</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Channel</label>
                <select name="channel" defaultValue={editingProvider?.channel || 'EMAIL'} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PUSH">Push</option>
                  <option value="SOCIAL">Social</option>
                </select>
              </div>

              <div style={{ borderTop: '1px solid #e8ddd0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>SMTP Configuration</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>SMTP Host</label>
                    <input type="text" name="host" defaultValue={editingProvider?.host || ''} placeholder="smtp.example.com" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>SMTP Port</label>
                    <input type="number" name="port" defaultValue={editingProvider?.port || 587} placeholder="587" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>Username</label>
                    <input type="text" name="username" defaultValue={editingProvider?.username || ''} placeholder="user@example.com" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>Password / App Password</label>
                    <input type="password" name="password" placeholder="Leave blank to keep current" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>Sender Email</label>
                    <input type="email" name="senderEmail" defaultValue={editingProvider?.senderEmail || ''} placeholder="noreply@domain.com" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>Sender Name</label>
                    <input type="text" name="senderName" defaultValue={editingProvider?.senderName || ''} placeholder="Smart Tech" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e8ddd0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>API Configuration</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>API Key</label>
                    <input type="text" name="apiKey" defaultValue={editingProvider?.apiKey || ''} placeholder="Enter API key" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px', display: 'block' }}>API Secret</label>
                    <input type="password" name="apiSecret" defaultValue={editingProvider?.apiSecret || ''} placeholder="Leave blank to keep current" style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {saveError && (
                <div style={{ padding: '12px 14px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca', color: '#991b1b', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa fa-exclamation-circle" style={{ fontSize: '14px' }}></i>
                  {saveError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #e8ddd0' }}>
                <button type="button" onClick={() => { setShowModal(false); setSaveError(null); }} style={{ padding: '12px 20px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: '12px 24px', background: saving ? '#93c5fd' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                  <i className={`fa ${saving ? 'fa-spinner fa-spin' : 'fa-save'}`} style={{ marginRight: '6px' }}></i> {saving ? 'Saving...' : 'Save Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 110,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowDelete(null)}>
          <div style={{
            background: '#fdfaf7', borderRadius: '16px', padding: '28px', width: '400px', maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa fa-exclamation-triangle" style={{ fontSize: '20px', color: '#dc2626' }}></i>
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Delete Provider</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>This action cannot be undone.</p>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 20px' }}>
              Are you sure you want to delete <strong>{providers.find(p => p.id === showDelete)?.name}</strong>? This will remove all configuration data.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDelete(null)} style={{ padding: '10px 18px', background: '#f3f4f6', color: '#6b7280', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(showDelete!)} style={{ padding: '10px 18px', background: '#dc2626', color: 'white', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
                <i className="fa fa-trash" style={{ marginRight: '6px' }}></i> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
