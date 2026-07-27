'use client';

import { useState, useEffect } from 'react';
import { communicationsCloudApi } from '@/lib/api';

const mockTemplates = [
  { id: 't1', name: 'Fee Reminder', subject: 'Fee Balance Reminder', body: '<p>Dear {name},</p><p>Your fee balance of {amount} is due by {date}.</p>', type: 'Email' },
  { id: 't2', name: 'Exam Results', subject: 'Exam Results Available', body: '<p>Dear {name},</p><p>Your exam results are now available on the portal.</p>', type: 'Email' },
  { id: 't3', name: 'Meeting Invite', subject: 'Staff Meeting Invitation', body: '<p>You are invited to a staff meeting on {date} at {time}.</p>', type: 'Email' },
  { id: 't4', name: 'Welcome Email', subject: 'Welcome to SmartTech', body: '<p>Welcome {name}! Your account has been created.</p>', type: 'Email' },
];

const mockEmails = [
  { id: 'e1', to: 'parent@school.com', subject: 'Fee Balance Reminder', status: 'Delivered', sentAt: '2026-07-03T08:30:00Z', opened: true, clicked: false },
  { id: 'e2', to: 'teacher@school.com', subject: 'Staff Meeting Tomorrow', status: 'Delivered', sentAt: '2026-07-03T07:45:00Z', opened: true, clicked: true },
  { id: 'e3', to: 'director@school.com', subject: 'Monthly Report Available', status: 'Sent', sentAt: '2026-07-02T16:00:00Z', opened: false, clicked: false },
  { id: 'e4', to: 'parent2@school.com', subject: 'Exam Results Published', status: 'Delivered', sentAt: '2026-07-02T14:30:00Z', opened: true, clicked: false },
  { id: 'e5', to: 'admin@school.com', subject: 'System Update Notification', status: 'Bounced', sentAt: '2026-07-02T10:00:00Z', opened: false, clicked: false },
];

const statusBadge = (status: string) => {
  const m: Record<string, { bg: string; color: string }> = {
    Delivered: { bg: '#d1fae5', color: '#059669' },
    Sent: { bg: '#dbeafe', color: '#2563eb' },
    Bounced: { bg: '#fee2e2', color: '#dc2626' },
    Opened: { bg: '#fef3c7', color: '#d97706' },
    Clicked: { bg: '#e0e7ff', color: '#4338ca' },
    Pending: { bg: '#f3f4f6', color: '#6b7280' },
  };
  return m[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

export default function EmailManagementPage() {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [stats, setStats] = useState({ sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tRes, mRes] = await Promise.all([
          communicationsCloudApi.getTemplates({ type: 'Email' }),
          communicationsCloudApi.getMessages({ channel: 'email', limit: 10 }),
        ]);
        const tBody = tRes.data?.statusCode ? tRes.data.data : tRes.data;
        const mBody = mRes.data?.statusCode ? mRes.data.data : mRes.data;
        setTemplates(Array.isArray(tBody) ? tBody : tBody?.templates || []);
        setEmails(Array.isArray(mBody) ? mBody : mBody?.messages || []);
        const list = Array.isArray(mBody) ? mBody : mBody?.messages || [];
        setStats({
          sent: list.length,
          delivered: list.filter((m: any) => m.status === 'Delivered').length,
          opened: list.filter((m: any) => m.opened).length,
          clicked: list.filter((m: any) => m.clicked).length,
          bounced: list.filter((m: any) => m.status === 'Bounced').length,
        });
      } catch {
        setTemplates(mockTemplates);
        setEmails(mockEmails);
        setStats({ sent: mockEmails.length, delivered: mockEmails.filter(m => m.status === 'Delivered').length, opened: mockEmails.filter(m => m.opened).length, clicked: mockEmails.filter(m => m.clicked).length, bounced: mockEmails.filter(m => m.status === 'Bounced').length });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSend = async () => {
    if (!to || !subject || !body) return;
    setSending(true);
    setSendStatus(null);
    try {
      await communicationsCloudApi.sendEmail({ recipient: to, cc: showCc ? cc : undefined, bcc: showBcc ? bcc : undefined, subject, body });
      setSendStatus({ type: 'success', text: 'Email sent successfully!' });
      setTo(''); setSubject(''); setBody(''); setCc(''); setBcc('');
    } catch {
      setSendStatus({ type: 'error', text: 'Failed to send email. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const useTemplate = (tpl: any) => {
    setSubject(tpl.subject || '');
    setBody(tpl.body || '');
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
        <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #10b981, #34d399)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa fa-envelope" style={{ fontSize: '24px', color: 'white' }}></i>
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0' }}>Email Management</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>Send and manage email communications</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Sent', value: stats.sent, icon: 'fa-paper-plane', color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Delivered', value: stats.delivered, icon: 'fa-check-circle', color: '#059669', bg: '#d1fae5' },
          { label: 'Opened', value: stats.opened, icon: 'fa-eye', color: '#d97706', bg: '#fef3c7' },
          { label: 'Clicked', value: stats.clicked, icon: 'fa-mouse-pointer', color: '#4338ca', bg: '#e0e7ff' },
          { label: 'Bounced', value: stats.bounced, icon: 'fa-exclamation-triangle', color: '#dc2626', bg: '#fee2e2' },
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
        {/* Compose Email */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-edit" style={{ color: '#10b981' }}></i> Compose Email
          </h2>
          {sendStatus && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', fontWeight: 500, background: sendStatus.type === 'success' ? '#d1fae5' : '#fee2e2', color: sendStatus.type === 'success' ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className={`fa ${sendStatus.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              {sendStatus.text}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>To <span style={{ color: '#dc2626' }}>*</span></label>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@school.com" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => setShowCc(!showCc)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8ddd0', background: showCc ? '#dbeafe' : '#fdfaf7', color: '#6b7280', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>CC</button>
              <button onClick={() => setShowBcc(!showBcc)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8ddd0', background: showBcc ? '#dbeafe' : '#fdfaf7', color: '#6b7280', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>BCC</button>
            </div>
            {showCc && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>CC</label>
                <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@school.com" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            {showBcc && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>BCC</label>
                <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc@school.com" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Subject <span style={{ color: '#dc2626' }}>*</span></label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Body <span style={{ color: '#dc2626' }}>*</span></label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Write your email body here... HTML is supported" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '14px', color: '#1f2937', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}></textarea>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                <i className="fa fa-code"></i> HTML content is supported
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fdfaf7', color: '#6b7280', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa fa-paperclip"></i> Attach
              </button>
            </div>
            <button onClick={handleSend} disabled={sending || !to || !subject || !body} style={{ padding: '12px 20px', background: sending ? '#9ca3af' : 'linear-gradient(135deg, #10b981, #34d399)', color: 'white', borderRadius: '12px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', boxShadow: sending ? 'none' : '0 4px 12px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {sending ? <><i className="fa fa-spinner fa-spin"></i> Sending...</> : <><i className="fa fa-paper-plane"></i> Send Email</>}
            </button>
          </div>
        </div>

        {/* Templates */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-file-alt" style={{ color: '#10b981' }}></i> Email Templates
          </h2>
          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9ca3af' }}>
              <i className="fa fa-file-alt" style={{ fontSize: '36px', display: 'block', marginBottom: '8px', opacity: 0.4 }}></i>
              <p style={{ margin: '0', fontSize: '14px' }}>No templates yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {templates.map((tpl) => (
                <div key={tpl.id} style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #e8ddd0', background: '#fdfaf7', cursor: 'pointer' }} onClick={() => useTemplate(tpl)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{tpl.name}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#d1fae5', color: '#059669', fontSize: '10px', fontWeight: 600 }}>Use</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0' }}>{tpl.subject}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Emails Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-history" style={{ color: '#6366f1' }}></i> Recent Emails
        </h2>
        {emails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <i className="fa fa-inbox" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
            <p style={{ margin: '0', fontSize: '14px' }}>No emails sent yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8ddd0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Recipient</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Subject</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Sent At</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((msg) => {
                  const badge = statusBadge(msg.status);
                  return (
                    <tr key={msg.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', color: '#1f2937', fontWeight: 500 }}>{msg.to || msg.recipient}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.subject}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color }}>{msg.status}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: '12px' }}>{formatTime(msg.sentAt || msg.createdAt)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
                        {msg.opened ? <span style={{ color: '#059669' }}><i className="fa fa-eye"></i> Opened</span> : <span style={{ color: '#9ca3af' }}>—</span>}
                        {msg.clicked ? <span style={{ color: '#4338ca', marginLeft: '8px' }}><i className="fa fa-mouse-pointer"></i></span> : null}
                      </td>
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
