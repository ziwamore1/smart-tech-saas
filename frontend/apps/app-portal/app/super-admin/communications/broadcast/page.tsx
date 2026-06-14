'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

const mockSchools = [
  { id: '1', name: 'Lusaka Primary School' },
  { id: '2', name: 'Ndola Girls Secondary' },
  { id: '3', name: 'Kitwe Boys High' },
  { id: '4', name: 'Mongu High School' },
  { id: '5', name: 'Livingstone International' },
  { id: '6', name: 'Kabwe Christian Academy' },
  { id: '7', name: 'Chipata Day School' },
  { id: '8', name: 'Solwezi Technical College' },
  { id: '9', name: 'Kasama Girls School' },
  { id: '10', name: 'Mansa Basic School' },
];

const channels = [
  { id: 'email', label: 'Email', icon: 'fa-envelope', color: '#2563eb' },
  { id: 'sms', label: 'SMS', icon: 'fa-comment-dots', color: '#d97706' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'fa-whatsapp', color: '#059669' },
  { id: 'push', label: 'Push Notifications', icon: 'fa-bell', color: '#8b5cf6' },
  { id: 'inapp', label: 'In-App Notifications', icon: 'fa-mobile-alt', color: '#14b8a6' },
  { id: 'youtube', label: 'YouTube Announcement', icon: 'fa-youtube', color: '#ef4444' },
];

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    Draft: { bg: '#f3f4f6', color: '#6b7280' },
    Scheduled: { bg: '#fef3c7', color: '#d97706' },
    Sending: { bg: '#dbeafe', color: '#2563eb' },
    Sent: { bg: '#d1fae5', color: '#059669' },
    Failed: { bg: '#fee2e2', color: '#dc2626' },
    Cancelled: { bg: '#f3f4f6', color: '#9ca3af' },
  };
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

export default function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('All Schools');
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [showSchoolSelect, setShowSchoolSelect] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await systemCommunicationApi.getBroadcasts();
      const body = res.data?.statusCode ? res.data.data : res.data;
      setBroadcasts(Array.isArray(body) ? body : (body?.broadcasts || []));
    } catch {
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  };

  const createBroadcast = async (status: string) => {
    try {
      const data: any = {
        title,
        message,
        targetType,
        channels: selectedChannels,
        status,
      };
      if (targetType === 'Selected Schools') {
        data.selectedSchools = selectedSchools;
      }
      if (scheduleLater && scheduleDate) {
        data.scheduleDate = scheduleDate;
      }
      await systemCommunicationApi.createBroadcast(data);
      setTitle('');
      setMessage('');
      setTargetType('All Schools');
      setSelectedSchools([]);
      setSelectedChannels([]);
      setScheduleLater(false);
      setScheduleDate('');
      await loadBroadcasts();
    } catch {}
  };

  const toggleSchool = (id: string) => {
    setSelectedSchools((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .input-field { transition: all 0.2s ease; }
        .input-field:focus { border-color: #ea6645 !important; box-shadow: 0 0 0 3px rgba(234,102,69,0.1); }
        .school-option { transition: all 0.15s ease; cursor: pointer; }
        .school-option:hover { background: #f5efe8; }
        .channel-chip { transition: all 0.2s ease; cursor: pointer; }
        .channel-chip:hover { transform: translateY(-1px); }
        .broadcast-row { transition: all 0.2s ease; }
        .broadcast-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-broadcast-tower" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Broadcast Center
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Send communications across multiple channels</p>
      </div>

      {/* Create Broadcast Form */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-bullhorn" style={{ color: '#f59e0b' }}></i> Create New Broadcast
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter broadcast title..."
              className="input-field"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your broadcast message..."
              rows={4}
              className="input-field"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Target Type</label>
            <select
              value={targetType}
              onChange={(e) => { setTargetType(e.target.value); setShowSchoolSelect(e.target.value === 'Selected Schools'); }}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}
            >
              <option>All Schools</option>
              <option>Selected Schools</option>
              <option>Directors</option>
              <option>Teachers</option>
              <option>Parents</option>
              <option>Students</option>
              <option>Custom Users</option>
            </select>
          </div>

          {showSchoolSelect && (
            <div style={{ background: '#f5efe8', borderRadius: '12px', padding: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px', display: 'block' }}>
                Select Schools ({selectedSchools.length} selected)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px', maxHeight: '200px', overflow: 'auto' }}>
                {mockSchools.map((school) => (
                  <label key={school.id} className="school-option" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: selectedSchools.includes(school.id) ? '#fefcf9' : 'transparent', border: selectedSchools.includes(school.id) ? '1px solid #ea6645' : '1px solid transparent' }}>
                    <input
                      type="checkbox"
                      checked={selectedSchools.includes(school.id)}
                      onChange={() => toggleSchool(school.id)}
                      style={{ accentColor: '#ea6645' }}
                    />
                    <span style={{ fontSize: '13px', color: '#374151' }}>{school.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '10px', display: 'block' }}>Channels</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className="channel-chip"
                  style={{
                    padding: '10px 16px', borderRadius: '10px', border: selectedChannels.includes(ch.id) ? '2px solid ' + ch.color : '1px solid #e8ddd0',
                    background: selectedChannels.includes(ch.id) ? ch.color + '15' : '#fefcf9',
                    color: selectedChannels.includes(ch.id) ? ch.color : '#6b7280',
                    fontWeight: selectedChannels.includes(ch.id) ? 600 : 500,
                    fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  }}
                >
                  <i className={`fa ${ch.icon}`} style={{ fontSize: '14px' }}></i>
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={scheduleLater}
                onChange={(e) => setScheduleLater(e.target.checked)}
                style={{ accentColor: '#ea6645', width: '16px', height: '16px' }}
              />
              <i className="fa fa-clock" style={{ color: '#6b7280' }}></i>
              Schedule for later
            </label>
            {scheduleLater && (
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button onClick={() => createBroadcast('DRAFT')} style={{ padding: '12px 20px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <i className="fa fa-save" style={{ marginRight: '6px' }}></i> Save as Draft
            </button>
            {scheduleLater ? (
              <button onClick={() => createBroadcast('SCHEDULED')} style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
                <i className="fa fa-calendar-check" style={{ marginRight: '6px' }}></i> Schedule Broadcast
              </button>
            ) : (
              <button onClick={() => createBroadcast('SENT')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #ea6645, #f59e0b)', color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(234,102,69,0.3)' }}>
                <i className="fa fa-paper-plane" style={{ marginRight: '6px' }}></i> Send Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast History */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-history" style={{ color: '#6b7280' }}></i> Broadcast History
          </h2>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>{broadcasts.length} broadcasts</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: '#9ca3af' }}>
              <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px', marginRight: '12px' }}></i> Loading broadcasts...
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5efe8', borderBottom: '1px solid #e8ddd0' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Channels</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sent At</th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b: any) => {
                const sb = statusBadge(b.status);
                return (
                  <tr key={b.id} className="broadcast-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>{b.title}</td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#6b7280' }}>{b.channels}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: '#f3f4f6', color: '#6b7280' }}>{b.target}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: sb.bg, color: sb.color }}>{b.status}</span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#9ca3af' }}>
                      {b.sentAt ? new Date(b.sentAt).toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button style={{ padding: '6px 10px', background: '#f3f4f6', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', color: '#374151' }}>
                          <i className="fa fa-eye"></i>
                        </button>
                        {(b.status === 'Draft' || b.status === 'Scheduled') && (
                          <button style={{ padding: '6px 10px', background: '#dbeafe', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', color: '#2563eb' }}>
                            <i className="fa fa-paper-plane"></i>
                          </button>
                        )}
                        <button style={{ padding: '6px 10px', background: '#fee2e2', borderRadius: '6px', border: 'none', fontSize: '12px', cursor: 'pointer', color: '#dc2626' }}>
                          <i className="fa fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
          {!loading && broadcasts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
              <i className="fa fa-bullhorn" style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}></i>
              No broadcasts yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
