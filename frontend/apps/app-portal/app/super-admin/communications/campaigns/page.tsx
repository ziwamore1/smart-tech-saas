'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

const campaignTypes = ['Promotional', 'Educational', 'Onboarding', 'Engagement', 'Alert'] as const;

const channelOptions = [
  { id: 'email', label: 'Email', icon: 'fa-envelope', color: '#2563eb' },
  { id: 'sms', label: 'SMS', icon: 'fa-comment-dots', color: '#d97706' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'fa-whatsapp', color: '#059669' },
  { id: 'push', label: 'Push Notifications', icon: 'fa-bell', color: '#8b5cf6' },
  { id: 'inapp', label: 'In-App', icon: 'fa-mobile-alt', color: '#14b8a6' },
];

const targetTypes = ['All Schools', 'Directors', 'Teachers', 'Parents', 'Students'];

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    Draft: { bg: '#f3f4f6', color: '#6b7280' },
    Scheduled: { bg: '#fef3c7', color: '#d97706' },
    Active: { bg: '#d1fae5', color: '#059669' },
    Paused: { bg: '#ffedd5', color: '#ea580c' },
    Completed: { bg: '#ccfbf1', color: '#0d9488' },
    Cancelled: { bg: '#f3f4f6', color: '#9ca3af' },
  };
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

const typeColors: Record<string, string> = {
  Promotional: '#2563eb',
  Educational: '#059669',
  Onboarding: '#8b5cf6',
  Engagement: '#d97706',
  Alert: '#dc2626',
};

const typeBg: Record<string, string> = {
  Promotional: '#dbeafe',
  Educational: '#d1fae5',
  Onboarding: '#f5f3ff',
  Engagement: '#fef3c7',
  Alert: '#fee2e2',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('Promotional');
  const [formChannels, setFormChannels] = useState<string[]>([]);
  const [formTargetType, setFormTargetType] = useState('All Schools');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await systemCommunicationApi.getCampaigns();
      const body = res.data?.statusCode ? res.data.data : res.data;
      setCampaigns(Array.isArray(body) ? body : []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormType('Promotional');
    setFormChannels([]);
    setFormTargetType('All Schools');
    setFormTemplateId('');
    setFormScheduledAt('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const toggleChannel = (id: string) => {
    setFormChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSaveDraft = async () => {
    try {
      const payload: any = {
        name: formName,
        description: formDescription,
        type: formType,
        channels: formChannels,
        targetType: formTargetType,
        templateId: formTemplateId || undefined,
        scheduledAt: formScheduledAt || undefined,
        status: 'Draft',
      };
      await systemCommunicationApi.createCampaign(payload);
      setShowModal(false);
      fetchCampaigns();
    } catch {
      // silent
    }
  };

  const handleLaunch = async () => {
    try {
      const payload: any = {
        name: formName,
        description: formDescription,
        type: formType,
        channels: formChannels,
        targetType: formTargetType,
        templateId: formTemplateId || undefined,
        scheduledAt: formScheduledAt || undefined,
      };
      if (formScheduledAt) {
        payload.status = 'Scheduled';
        await systemCommunicationApi.createCampaign(payload);
      } else {
        const res = await systemCommunicationApi.createCampaign(payload);
        const body = res.data?.statusCode ? res.data.data : res.data;
        if (body?.id) {
          await systemCommunicationApi.launchCampaign(body.id);
        }
      }
      setShowModal(false);
      fetchCampaigns();
    } catch {
      // silent
    }
  };

  const handleLaunchCampaign = async (id: string) => {
    try {
      await systemCommunicationApi.launchCampaign(id);
      fetchCampaigns();
    } catch {
      // silent
    }
  };

  const handlePauseCampaign = async (id: string) => {
    try {
      await systemCommunicationApi.pauseCampaign(id);
      fetchCampaigns();
    } catch {
      // silent
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await systemCommunicationApi.deleteCampaign(id);
      fetchCampaigns();
    } catch {
      // silent
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .cmp-card { transition: all 0.2s ease; }
        .cmp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .action-btn-icon { transition: all 0.15s ease; cursor: pointer; }
        .action-btn-icon:hover { transform: scale(1.1); }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        .input-field:focus { border-color: #ea6645 !important; box-shadow: 0 0 0 3px rgba(234,102,69,0.1); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-bullseye" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Campaigns
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Create and manage multi-channel marketing campaigns</p>
        </div>
        <button onClick={openCreate} style={{
          padding: '12px 20px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white',
          borderRadius: '10px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
        }}>
          <i className="fa fa-plus"></i> Create Campaign
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      )}

      {/* Campaign Cards */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {campaigns.map((c: any) => {
            const sb = statusBadge(c.status);
            return (
              <div key={c.id} className="cmp-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {/* Top Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: typeBg[c.type] || '#f3f4f6', color: typeColors[c.type] || '#6b7280' }}>{c.type}</span>
                      <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: sb.bg, color: sb.color }}>{c.status}</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                    {c.status === 'Draft' && (
                      <button onClick={() => handleLaunchCampaign(c.id)} className="action-btn-icon" style={{ padding: '8px', background: '#d1fae5', borderRadius: '8px', border: 'none', cursor: 'pointer', color: '#059669', fontSize: '13px' }} title="Launch">
                        <i className="fa fa-paper-plane"></i>
                      </button>
                    )}
                    {c.status === 'Active' && (
                      <button onClick={() => handlePauseCampaign(c.id)} className="action-btn-icon" style={{ padding: '8px', background: '#ffedd5', borderRadius: '8px', border: 'none', cursor: 'pointer', color: '#ea580c', fontSize: '13px' }} title="Pause">
                        <i className="fa fa-pause"></i>
                      </button>
                    )}
                    <button onClick={() => handleDeleteCampaign(c.id)} className="action-btn-icon" style={{ padding: '8px', background: '#fee2e2', borderRadius: '8px', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '13px' }} title="Delete">
                      <i className="fa fa-trash"></i>
                    </button>
                  </div>
                </div>

                {/* Description */}
                {c.description && (
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', lineHeight: 1.5 }}>
                    {c.description.length > 100 ? c.description.substring(0, 100) + '...' : c.description}
                  </div>
                )}

                {/* Channels */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {(Array.isArray(c.channels) ? c.channels : typeof c.channels === 'string' ? c.channels.split(',').map((s: string) => s.trim().toLowerCase()) : []).map((ch: string) => {
                    const opt = channelOptions.find((o) => o.id === ch || o.label.toLowerCase() === ch.toLowerCase());
                    return (
                      <span key={ch} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: opt ? opt.color + '18' : '#f3f4f6', color: opt?.color || '#6b7280' }}>
                        {opt && <i className={`fa ${opt.icon}`} style={{ fontSize: '10px' }}></i>}
                        {opt ? opt.label : ch}
                      </span>
                    );
                  })}
                </div>

                {/* Target */}
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                  <i className="fa fa-users" style={{ marginRight: '6px' }}></i>
                  Target: <span style={{ fontWeight: 600, color: '#374151' }}>{c.targetType || c.target || '-'}</span>
                </div>

                {/* Stats */}
                {(c.sentCount !== undefined || c.openedCount !== undefined || c.clickedCount !== undefined || c.failedCount !== undefined) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '12px', background: '#f5efe8', borderRadius: '10px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#2563eb' }}>{(c.sentCount || 0).toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Sent</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>{(c.openedCount || 0).toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Opened</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#8b5cf6' }}>{(c.clickedCount || 0).toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Clicked</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>{(c.failedCount || 0).toLocaleString()}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Failed</div>
                    </div>
                  </div>
                )}

                {/* Schedule info */}
                {c.scheduledAt && (
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '10px' }}>
                    <i className="fa fa-clock" style={{ marginRight: '4px' }}></i>
                    Scheduled: {new Date(c.scheduledAt).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
          {campaigns.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px 24px', color: '#9ca3af' }}>
              <i className="fa fa-bullseye" style={{ fontSize: '48px', display: 'block', marginBottom: '16px', opacity: 0.4 }}></i>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#6b7280', marginBottom: '6px' }}>No campaigns yet</div>
              <div style={{ fontSize: '13px' }}>Click "Create Campaign" to get started</div>
            </div>
          )}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#fdfaf7', borderRadius: '20px', padding: '32px', width: '600px', maxWidth: '95vw',
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa fa-bullseye" style={{ color: '#8b5cf6' }}></i> Create Campaign
              </h2>
              <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-times" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Campaign Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g., Summer Enrollment Drive" className="input-field" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Description</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} placeholder="Describe the campaign purpose..." className="input-field" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>

              {/* Type + Target */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Campaign Type</label>
                  <select value={formType} onChange={(e) => setFormType(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                    {campaignTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Target Audience</label>
                  <select value={formTargetType} onChange={(e) => setFormTargetType(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}>
                    {targetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Channels */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px', display: 'block' }}>Channels</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {channelOptions.map((ch) => (
                    <label key={ch.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                      borderRadius: '10px', border: formChannels.includes(ch.id) ? '2px solid ' + ch.color : '1px solid #e8ddd0',
                      background: formChannels.includes(ch.id) ? ch.color + '15' : '#fefcf9',
                      color: formChannels.includes(ch.id) ? ch.color : '#6b7280',
                      fontWeight: formChannels.includes(ch.id) ? 600 : 500,
                      fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease',
                    }}>
                      <input type="checkbox" checked={formChannels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} style={{ accentColor: ch.color, display: 'none' }} />
                      <i className={`fa ${ch.icon}`} style={{ fontSize: '14px' }}></i>
                      {ch.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Template ID */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Template ID <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
                <input type="text" value={formTemplateId} onChange={(e) => setFormTemplateId(e.target.value)} placeholder="e.g., tpl_abc123" className="input-field" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {/* Schedule */}
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Schedule Date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional — leave empty to launch immediately)</span></label>
                <input type="datetime-local" value={formScheduledAt} onChange={(e) => setFormScheduledAt(e.target.value)} className="input-field" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e8ddd0' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '12px 20px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveDraft} style={{ padding: '12px 20px', background: '#fefcf9', color: '#6b7280', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                <i className="fa fa-save" style={{ marginRight: '6px' }}></i> Save as Draft
              </button>
              <button onClick={handleLaunch} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
                <i className="fa fa-rocket" style={{ marginRight: '6px' }}></i> {formScheduledAt ? 'Schedule Campaign' : 'Launch Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
