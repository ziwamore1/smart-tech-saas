'use client';

import { useState, useEffect } from 'react';
import { communicationsCloudApi } from '@/lib/api';

const targetOptions = [
  { value: 'all-users', label: 'All Users', icon: 'fa-users' },
  { value: 'teachers', label: 'All Teachers', icon: 'fa-chalkboard-teacher' },
  { value: 'students', label: 'All Students', icon: 'fa-user-graduate' },
  { value: 'parents', label: 'All Parents', icon: 'fa-user-friends' },
  { value: 'admins', label: 'School Admins', icon: 'fa-user-tie' },
  { value: 'role', label: 'Specific Role', icon: 'fa-tag' },
  { value: 'class', label: 'Specific Class', icon: 'fa-school' },
  { value: 'user', label: 'Specific User ID', icon: 'fa-user' },
];

const mockNotifications = [
  { id: 'n1', title: 'Fee Reminder', body: 'Term 2 fees are due by July 15th', target: 'parents', status: 'Delivered', sentAt: '2026-07-03T08:30:00Z', sentCount: 1240, openedCount: 890 },
  { id: 'n2', title: 'Staff Meeting', body: 'Staff meeting tomorrow at 14:00 in the hall', target: 'teachers', status: 'Delivered', sentAt: '2026-07-03T07:45:00Z', sentCount: 85, openedCount: 72 },
  { id: 'n3', title: 'Exam Schedule', body: 'Final exams begin next Monday', target: 'students', status: 'Sent', sentAt: '2026-07-02T16:00:00Z', sentCount: 3200, openedCount: 0 },
  { id: 'n4', title: 'System Maintenance', body: 'System will be down on Sunday 2-4 AM', target: 'admins', status: 'Delivered', sentAt: '2026-07-02T14:30:00Z', sentCount: 45, openedCount: 40 },
  { id: 'n5', title: 'Holiday Announcement', body: 'School will be closed on July 20th', target: 'all-users', status: 'Failed', sentAt: '2026-07-02T10:00:00Z', sentCount: 0, openedCount: 0 },
];

const statusBadge = (status: string) => {
  const m: Record<string, { bg: string; color: string }> = {
    Delivered: { bg: '#d1fae5', color: '#059669' },
    Sent: { bg: '#dbeafe', color: '#2563eb' },
    Failed: { bg: '#fee2e2', color: '#dc2626' },
    Pending: { bg: '#fef3c7', color: '#d97706' },
    Scheduled: { bg: '#e0e7ff', color: '#4338ca' },
  };
  return m[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

export default function PushNotificationPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all-users');
  const [specificValue, setSpecificValue] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState({ sent: 0, delivered: 0, opened: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mRes, sRes] = await Promise.all([
          communicationsCloudApi.getMessages({ channel: 'push', limit: 10 }),
          communicationsCloudApi.getDashboardStats(),
        ]);
        const mBody = mRes.data?.statusCode ? mRes.data.data : mRes.data;
        const sBody = sRes.data?.statusCode ? sRes.data.data : sRes.data;
        setNotifications(Array.isArray(mBody) ? mBody : mBody?.messages || []);
        setStats({ sent: sBody?.pushSent ?? 0, delivered: sBody?.pushDelivered ?? 0, opened: sBody?.pushOpened ?? 0 });
      } catch {
        setNotifications(mockNotifications);
        setStats({ sent: 4570, delivered: 3890, opened: 2450 });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSend = async () => {
    if (!title || !body) return;
    setSending(true);
    setSendStatus(null);
    try {
      const payload: any = { title, body, targetAudience: target };
      if (target === 'user' && specificValue) payload.userId = specificValue;
      if (target === 'class' && specificValue) payload.classId = specificValue;
      if (target === 'role' && specificValue) payload.role = specificValue;
      await communicationsCloudApi.sendPush(payload);
      setSendStatus({ type: 'success', text: 'Push notification sent!' });
      setTitle(''); setBody(''); setSpecificValue('');
    } catch {
      setSendStatus({ type: 'error', text: 'Failed to send notification.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const formatTime = (ts: string) => new Date(ts).toLocaleString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa fa-bell" style={{ fontSize: '24px', color: 'white' }}></i>
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>Push Notifications</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>Send push notifications to users across the platform</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Sent', value: stats.sent.toLocaleString(), icon: 'fa-paper-plane', color: '#8b5cf6', bg: '#f5f3ff' },
          { label: 'Delivered', value: stats.delivered.toLocaleString(), icon: 'fa-check-circle', color: '#059669', bg: '#d1fae5' },
          { label: 'Opened', value: stats.opened.toLocaleString(), icon: 'fa-eye', color: '#d97706', bg: '#fef3c7' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fefcf9', borderRadius: '14px', padding: '18px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fa ${s.icon}`} style={{ fontSize: '16px', color: s.color }}></i>
              </div>
            </div>
            <p style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{s.value}</p>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{s.label}</p>
          </div>
        ))}
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '18px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-chart-pie" style={{ fontSize: '16px', color: '#8b5cf6' }}></i>
            </div>
          </div>
          <p style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{stats.sent ? Math.round((stats.opened / stats.sent) * 100) : 0}%</p>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>Open Rate</p>
        </div>
      </div>

      {/* Compose */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-edit" style={{ color: '#8b5cf6' }}></i> Compose Notification
          </h2>
          {sendStatus && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', fontWeight: 500, background: sendStatus.type === 'success' ? '#d1fae5' : '#fee2e2', color: sendStatus.type === 'success' ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className={`fa ${sendStatus.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              {sendStatus.text}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Title <span style={{ color: '#dc2626' }}>*</span></label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Body <span style={{ color: '#dc2626' }}>*</span></label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Notification body text..." style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}></textarea>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Target Audience <span style={{ color: '#dc2626' }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {targetOptions.map((opt) => (
                  <button key={opt.value} onClick={() => { setTarget(opt.value); setSpecificValue(''); }} style={{ padding: '10px', borderRadius: '10px', border: target === opt.value ? '2px solid #8b5cf6' : '1px solid #e8ddd0', background: target === opt.value ? '#f5f3ff' : '#fdfaf7', color: target === opt.value ? '#7c3aed' : '#6b7280', fontSize: '12px', fontWeight: 500, cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <i className={`fa ${opt.icon}`} style={{ fontSize: '16px' }}></i>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {(target === 'role' || target === 'class' || target === 'user') && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                  {target === 'role' ? 'Role Name' : target === 'class' ? 'Class ID' : 'User ID'}
                </label>
                <input value={specificValue} onChange={(e) => setSpecificValue(e.target.value)} placeholder={target === 'role' ? 'e.g. teacher' : target === 'class' ? 'e.g. class_123' : 'e.g. user_456'} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <button onClick={handleSend} disabled={sending || !title || !body} style={{ padding: '12px 20px', background: sending ? '#9ca3af' : 'linear-gradient(135deg, #8b5cf6, #a78bfa)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', boxShadow: sending ? 'none' : '0 4px 12px rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {sending ? <><i className="fa fa-spinner fa-spin"></i> Sending...</> : <><i className="fa fa-bell"></i> Send Notification</>}
            </button>
          </div>
        </div>

        {/* Tips */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-lightbulb" style={{ color: '#f59e0b' }}></i> Best Practices
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#6b7280' }}>
            <div style={{ padding: '12px', borderRadius: '10px', background: '#fdfaf7', border: '1px solid #e8ddd0' }}>
              <i className="fa fa-check-circle" style={{ color: '#059669', marginRight: '8px' }}></i>
              Keep titles under 50 characters
            </div>
            <div style={{ padding: '12px', borderRadius: '10px', background: '#fdfaf7', border: '1px solid #e8ddd0' }}>
              <i className="fa fa-check-circle" style={{ color: '#059669', marginRight: '8px' }}></i>
              Body text should be concise
            </div>
            <div style={{ padding: '12px', borderRadius: '10px', background: '#fdfaf7', border: '1px solid #e8ddd0' }}>
              <i className="fa fa-check-circle" style={{ color: '#059669', marginRight: '8px' }}></i>
              Target the right audience
            </div>
            <div style={{ padding: '12px', borderRadius: '10px', background: '#fdfaf7', border: '1px solid #e8ddd0' }}>
              <i className="fa fa-check-circle" style={{ color: '#059669', marginRight: '8px' }}></i>
              Avoid sending during off-hours
            </div>
          </div>
        </div>
      </div>

      {/* Recent Notifications */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-history" style={{ color: '#6366f1' }}></i> Recent Push Notifications
        </h2>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <i className="fa fa-inbox" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
            <p style={{ margin: '0', fontSize: '14px' }}>No notifications sent yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8ddd0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Title</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Body</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Target</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Sent</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Opened</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => {
                  const badge = statusBadge(n.status);
                  const targetLabel = targetOptions.find(t => t.value === n.target)?.label || n.target;
                  return (
                    <tr key={n.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>{n.title}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>{targetLabel}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color }}>{n.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>{(n.sentCount ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>{(n.openedCount ?? 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
