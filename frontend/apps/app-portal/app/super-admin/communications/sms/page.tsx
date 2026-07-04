'use client';

import { useState, useEffect } from 'react';
import { communicationsCloudApi } from '@/lib/api';

const mockTemplates = [
  { id: 't1', name: 'Fee Reminder', message: 'Dear parent, your fee balance of {amount} is due. Please pay by {date}.', type: 'SMS' },
  { id: 't2', name: 'Attendance Alert', message: 'Your child {name} was marked absent today. Please contact the school.', type: 'SMS' },
  { id: 't3', name: 'Exam Notification', message: 'Exams begin on {date}. Download timetable at {link}.', type: 'SMS' },
  { id: 't4', name: 'Event Reminder', message: 'Reminder: {event} is on {date} at {time}.', type: 'SMS' },
];

const mockMessages = [
  { id: 'm1', recipient: '+260977123456', message: 'Fee payment reminder for Term 2', status: 'Delivered', sentAt: '2026-07-03T08:30:00Z', cost: 0.05, senderId: 'SmartTech' },
  { id: 'm2', recipient: '+260955789012', message: 'Your child John was absent today', status: 'Delivered', sentAt: '2026-07-03T07:45:00Z', cost: 0.05, senderId: 'SmartTech' },
  { id: 'm3', recipient: '+260966345678', message: 'Exam results now available online', status: 'Sent', sentAt: '2026-07-02T16:00:00Z', cost: 0.05, senderId: 'INFO' },
  { id: 'm4', recipient: '+260977654321', message: 'School open day this Saturday', status: 'Failed', sentAt: '2026-07-02T14:30:00Z', cost: 0, senderId: 'SmartTech' },
  { id: 'm5', recipient: '+260988123456', message: 'Staff meeting tomorrow at 14:00', status: 'Delivered', sentAt: '2026-07-02T10:00:00Z', cost: 0.05, senderId: 'SmartTech' },
];

const statusBadge = (status: string) => {
  const m: Record<string, { bg: string; color: string }> = {
    Delivered: { bg: '#d1fae5', color: '#059669' },
    Sent: { bg: '#dbeafe', color: '#2563eb' },
    Failed: { bg: '#fee2e2', color: '#dc2626' },
    Pending: { bg: '#fef3c7', color: '#d97706' },
  };
  return m[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

export default function SmsManagementPage() {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [senderId, setSenderId] = useState('SmartTech');
  const [templates, setTemplates] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, delivered: 0, failed: 0, deliveryRate: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, mRes] = await Promise.all([
          communicationsCloudApi.getTemplates({ type: 'SMS' }),
          communicationsCloudApi.getMessages({ channel: 'sms', limit: 10 }),
        ]);
        const tBody = tRes.data?.statusCode ? tRes.data.data : tRes.data;
        const mBody = mRes.data?.statusCode ? mRes.data.data : mRes.data;
        setTemplates(Array.isArray(tBody) ? tBody : tBody?.templates || []);
        setMessages(Array.isArray(mBody) ? mBody : mBody?.messages || []);
        const delivered = Array.isArray(mBody) ? mBody.filter((m: any) => m.status === 'Delivered').length : 0;
        const failed = Array.isArray(mBody) ? mBody.filter((m: any) => m.status === 'Failed').length : 0;
        const total = Array.isArray(mBody) ? mBody.length : 0;
        setStats({ total, delivered, failed, deliveryRate: total ? Math.round((delivered / total) * 100) : 0 });
      } catch {
        setTemplates(mockTemplates);
        setMessages(mockMessages);
        setStats({ total: mockMessages.length, delivered: mockMessages.filter(m => m.status === 'Delivered').length, failed: mockMessages.filter(m => m.status === 'Failed').length, deliveryRate: 80 });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSend = async () => {
    if (!recipient || !message) return;
    setSending(true);
    setSendStatus(null);
    try {
      await communicationsCloudApi.sendSms({ recipient, message, senderId });
      setSendStatus({ type: 'success', text: 'SMS sent successfully!' });
      setRecipient('');
      setMessage('');
    } catch {
      setSendStatus({ type: 'error', text: 'Failed to send SMS. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const useTemplate = (tpl: any) => {
    setMessage(tpl.message);
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
      <style>{`
        .hover-card { transition: all 0.2s ease; cursor: pointer; }
        .hover-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.12); }
        .tpl-row { transition: all 0.2s ease; }
        .tpl-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa fa-sms" style={{ fontSize: '24px', color: 'white' }}></i>
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>SMS Management</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>Send and manage SMS messages across all schools</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Sent', value: stats.total, icon: 'fa-comment-dots', color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Delivered', value: stats.delivered, icon: 'fa-check-circle', color: '#059669', bg: '#d1fae5' },
          { label: 'Failed', value: stats.failed, icon: 'fa-times-circle', color: '#dc2626', bg: '#fee2e2' },
          { label: 'Delivery Rate', value: `${stats.deliveryRate}%`, icon: 'fa-chart-pie', color: '#d97706', bg: '#fef3c7' },
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
      </div>

      {/* Compose + Templates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Compose SMS */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-edit" style={{ color: '#3b82f6' }}></i> Compose SMS
          </h2>
          {sendStatus && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', fontWeight: 500, background: sendStatus.type === 'success' ? '#d1fae5' : '#fee2e2', color: sendStatus.type === 'success' ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className={`fa ${sendStatus.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              {sendStatus.text}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Recipient</label>
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="+260XXXXXXXXX or comma-separated numbers" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Sender ID</label>
              <select value={senderId} onChange={(e) => setSenderId(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }}>
                <option value="SmartTech">SmartTech</option>
                <option value="INFO">INFO</option>
                <option value="NOTIFY">NOTIFY</option>
                <option value="ALERT">ALERT</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Message <span style={{ color: '#9ca3af', fontWeight: 400 }}>({message.length}/160)</span></label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Type your SMS message here..." style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}></textarea>
            </div>
            <button onClick={handleSend} disabled={sending || !recipient || !message} style={{ padding: '12px 20px', background: sending ? '#9ca3af' : 'linear-gradient(135deg, #ea6645, #f59e0b)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', boxShadow: sending ? 'none' : '0 4px 12px rgba(234,102,69,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {sending ? <><i className="fa fa-spinner fa-spin"></i> Sending...</> : <><i className="fa fa-paper-plane"></i> Send SMS</>}
            </button>
          </div>
        </div>

        {/* Templates */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-file-alt" style={{ color: '#f59e0b' }}></i> SMS Templates
          </h2>
          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9ca3af' }}>
              <i className="fa fa-file-alt" style={{ fontSize: '36px', display: 'block', marginBottom: '8px', opacity: 0.4 }}></i>
              <p style={{ margin: '0', fontSize: '14px' }}>No templates yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {templates.map((tpl) => (
                <div key={tpl.id} className="tpl-row" style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{tpl.name}</span>
                    <button onClick={() => useTemplate(tpl)} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #ea6645', background: 'transparent', color: '#ea6645', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                      Use
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Messages Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-history" style={{ color: '#6366f1' }}></i> Recent SMS Messages
        </h2>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <i className="fa fa-inbox" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
            <p style={{ margin: '0', fontSize: '14px' }}>No messages sent yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8ddd0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Recipient</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Message</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Sent At</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => {
                  const badge = statusBadge(msg.status);
                  return (
                    <tr key={msg.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>{msg.recipient || msg.to}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.message}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color }}>{msg.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '12px' }}>{formatTime(msg.sentAt || msg.createdAt)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151', fontWeight: 500 }}>${(msg.cost ?? 0).toFixed(2)}</td>
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
