'use client';

import { useState, useEffect } from 'react';
import { communicationsCloudApi } from '@/lib/api';

const mockSenders = [
  { id: 's1', name: 'SmartTech', channel: 'SMS', isDefault: true, verified: true, createdAt: '2026-01-15T10:00:00Z', details: 'SmartTech SMS' },
  { id: 's2', name: 'INFO', channel: 'SMS', isDefault: false, verified: true, createdAt: '2026-02-20T08:30:00Z', details: 'Information SMS' },
  { id: 's3', name: 'NOTIFY', channel: 'SMS', isDefault: false, verified: false, createdAt: '2026-03-10T14:00:00Z', details: 'Notification SMS' },
  { id: 's4', name: 'noreply@smarttech.com', channel: 'Email', isDefault: true, verified: true, createdAt: '2026-01-15T10:00:00Z', details: 'No-Reply Email' },
  { id: 's5', name: 'support@smarttech.com', channel: 'Email', isDefault: false, verified: true, createdAt: '2026-02-01T09:00:00Z', details: 'Support Email' },
  { id: 's6', name: '+260977000001', channel: 'WhatsApp', isDefault: true, verified: true, createdAt: '2026-03-01T11:00:00Z', details: 'Business WhatsApp' },
];

const tabs = ['All', 'SMS', 'Email', 'WhatsApp', 'Push'];

export default function SenderIdsPage() {
  const [senders, setSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ name: '', channel: 'SMS' as string, details: '' });

  useEffect(() => {
    fetchSenders();
  }, []);

  const fetchSenders = async () => {
    setLoading(true);
    try {
      const res = await communicationsCloudApi.getSenderIdentities();
      const body = res.data?.statusCode ? res.data.data : res.data;
      setSenders(Array.isArray(body) ? body : body?.identities || []);
    } catch {
      setSenders(mockSenders);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', channel: 'SMS', details: '' });
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, channel: s.channel, details: s.details || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await communicationsCloudApi.updateSenderIdentity(editing.id, form);
      } else {
        await communicationsCloudApi.createSenderIdentity(form);
      }
      setShowModal(false);
      fetchSenders();
    } catch {
      if (editing) {
        setSenders(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s));
      } else {
        setSenders(prev => [...prev, { id: `s_${Date.now()}`, ...form, isDefault: false, verified: false, createdAt: new Date().toISOString() }]);
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await communicationsCloudApi.setDefaultSenderIdentity(id);
    } catch {}
    setSenders(prev => prev.map(s => ({ ...s, isDefault: s.id === id })));
  };

  const verify = async (id: string) => {
    try {
      await communicationsCloudApi.verifySenderIdentity(id);
      setSenders(prev => prev.map(s => s.id === id ? { ...s, verified: true } : s));
    } catch {}
  };

  const filtered = activeTab === 'All' ? senders : senders.filter(s => s.channel === activeTab);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .sender-row { transition: all 0.2s ease; }
        .sender-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #ec4899, #f472b6)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-id-card" style={{ fontSize: '24px', color: 'white' }}></i>
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>Sender Identities</h1>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>Manage sender IDs, email addresses, and WhatsApp numbers</p>
          </div>
        </div>
        <button onClick={openCreate} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #ea6645, #ec4899)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234,102,69,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-plus"></i> New Sender
        </button>
      </div>

      {/* Channel Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#fdfaf7', padding: '4px', borderRadius: '10px', border: '1px solid #e8ddd0', width: 'fit-content' }}>
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === tab ? '#ec4899' : 'transparent', color: activeTab === tab ? 'white' : '#6b7280', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            {tab === 'All' ? 'All' : <><i className={`fa ${tab === 'SMS' ? 'fa-comment-dots' : tab === 'Email' ? 'fa-envelope' : tab === 'WhatsApp' ? 'fa-whatsapp' : 'fa-bell'}`} style={{ marginRight: '6px' }}></i>{tab}</>}
          </button>
        ))}
      </div>

      {/* Sender List */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <i className="fa fa-id-card" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
            <p style={{ margin: '0', fontSize: '14px' }}>No sender identities found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map((s) => (
              <div key={s.id} className="sender-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e8ddd0', background: s.isDefault ? 'linear-gradient(135deg, rgba(236,72,153,0.05), rgba(234,102,69,0.05))' : '#fdfaf7' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0, background: s.channel === 'SMS' ? '#fef3c7' : s.channel === 'Email' ? '#dbeafe' : s.channel === 'WhatsApp' ? '#d1fae5' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fa ${s.channel === 'SMS' ? 'fa-comment-dots' : s.channel === 'Email' ? 'fa-envelope' : s.channel === 'WhatsApp' ? 'fa-whatsapp' : 'fa-bell'}`} style={{ fontSize: '18px', color: s.channel === 'SMS' ? '#d97706' : s.channel === 'Email' ? '#2563eb' : s.channel === 'WhatsApp' ? '#059669' : '#8b5cf6' }}></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{s.name}</span>
                    {s.isDefault && <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'linear-gradient(135deg, #ec4899, #ea6645)', color: 'white', fontSize: '10px', fontWeight: 700 }}>DEFAULT</span>}
                    {s.verified ? (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#d1fae5', color: '#059669', fontSize: '10px', fontWeight: 600 }}><i className="fa fa-check-circle"></i> Verified</span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#d97706', fontSize: '10px', fontWeight: 600 }}>Unverified</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{s.channel} &middot; {s.details || s.name} &middot; Created {new Date(s.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {!s.isDefault && (
                    <button onClick={() => setDefault(s.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e8ddd0', background: '#fdfaf7', color: '#6b7280', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                      Set Default
                    </button>
                  )}
                  {!s.verified && (
                    <button onClick={() => verify(s.id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d97706', background: '#fef3c7', color: '#d97706', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                      Verify
                    </button>
                  )}
                  <button onClick={() => openEdit(s)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e8ddd0', background: '#fdfaf7', color: '#6b7280', fontSize: '11px', cursor: 'pointer' }}>
                    <i className="fa fa-edit"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fefcf9', borderRadius: '20px', width: '480px', maxWidth: '90vw', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{editing ? 'Edit Sender' : 'Create Sender'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer' }}><i className="fa fa-times"></i></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Identifier</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder={form.channel === 'SMS' ? 'e.g. SmartTech' : form.channel === 'Email' ? 'e.g. noreply@school.com' : 'e.g. +260977000000'} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Channel</label>
                <select value={form.channel} onChange={(e) => setForm(f => ({ ...f, channel: e.target.value }))} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', outline: 'none' }}>
                  <option value="SMS">SMS</option>
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Push">Push</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Description (optional)</label>
                <input value={form.details} onChange={(e) => setForm(f => ({ ...f, details: e.target.value }))} placeholder="e.g. Primary SMS sender" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button onClick={handleSave} disabled={saving || !form.name} style={{ flex: 1, padding: '12px', background: saving ? '#9ca3af' : 'linear-gradient(135deg, #ea6645, #ec4899)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: saving || !form.name ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
                <button onClick={() => setShowModal(false)} style={{ padding: '12px 20px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', border: '1px solid #e8ddd0', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
