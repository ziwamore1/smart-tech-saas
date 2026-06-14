'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

interface ScheduledMessage {
  id: string;
  title: string;
  type: string;
  channel: string;
  scheduledAt: string;
  status: 'Pending' | 'Sent' | 'Cancelled';
  target: string;
}

const fallbackScheduled: ScheduledMessage[] = [
  { id: 'SCH-001', title: 'End of Term Announcement', type: 'Broadcast', channel: 'Email, SMS', scheduledAt: '2026-06-20T08:00:00Z', status: 'Pending', target: 'All Schools' },
  { id: 'SCH-002', title: 'Fee Reminder - Term 2', type: 'Notification', channel: 'SMS', scheduledAt: '2026-06-20T08:00:00Z', status: 'Pending', target: 'Parents' },
  { id: 'SCH-003', title: 'Parent-Teacher Meeting Notice', type: 'Broadcast', channel: 'Email, WhatsApp', scheduledAt: '2026-06-20T08:00:00Z', status: 'Pending', target: 'Parents' },
  { id: 'SCH-004', title: 'Staff Training Reminder', type: 'Notification', channel: 'Email, In-App', scheduledAt: '2026-06-20T08:00:00Z', status: 'Pending', target: 'Teachers' },
  { id: 'SCH-005', title: 'Sports Day Schedule', type: 'Broadcast', channel: 'Email, SMS', scheduledAt: '2026-06-22T09:00:00Z', status: 'Pending', target: 'All Schools' },
  { id: 'SCH-006', title: 'Holiday Closing Notice', type: 'Broadcast', channel: 'Email, SMS, WhatsApp', scheduledAt: '2026-06-25T10:00:00Z', status: 'Pending', target: 'All Schools' },
  { id: 'SCH-007', title: 'System Maintenance - June', type: 'Notification', channel: 'Email, Push, In-App', scheduledAt: '2026-06-27T22:00:00Z', status: 'Pending', target: 'All Users' },
  { id: 'SCH-008', title: 'Exam Results Published', type: 'Notification', channel: 'Email, SMS', scheduledAt: '2026-06-15T08:00:00Z', status: 'Sent', target: 'Parents' },
  { id: 'SCH-009', title: 'Welcome Email - New Schools', type: 'Notification', channel: 'Email', scheduledAt: '2026-06-12T10:00:00Z', status: 'Sent', target: 'New Registrations' },
  { id: 'SCH-010', title: 'Quarterly Newsletter', type: 'Broadcast', channel: 'Email', scheduledAt: '2026-06-01T08:00:00Z', status: 'Cancelled', target: 'All Schools' },
];

const typeIcon: Record<string, string> = {
  Broadcast: 'fa-bullhorn',
  Notification: 'fa-bell',
};

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string }> = {
    Pending: { bg: '#fef3c7', color: '#d97706' },
    Sent: { bg: '#d1fae5', color: '#059669' },
    Cancelled: { bg: '#f3f4f6', color: '#9ca3af' },
  };
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

export default function ScheduledPage() {
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScheduled = async () => {
    try {
      setLoading(true);
      const res = await systemCommunicationApi.getScheduled();
      const body = res.data?.statusCode ? res.data.data : res.data;
      if (body) {
        const broadcasts: ScheduledMessage[] = (body.broadcasts || []).map((b: any) => ({
          id: b.id,
          title: b.title || b.subject || '',
          type: 'Broadcast',
          channel: Array.isArray(b.channels) ? b.channels.join(', ') : (b.channel || ''),
          scheduledAt: b.scheduledAt || b.scheduled_for || '',
          status: b.status || 'Pending',
          target: b.target || b.audience || '',
        }));
        const communications: ScheduledMessage[] = (body.communications || []).map((c: any) => ({
          id: c.id,
          title: c.title || c.subject || '',
          type: c.type || 'Notification',
          channel: Array.isArray(c.channels) ? c.channels.join(', ') : (c.channel || ''),
          scheduledAt: c.scheduledAt || c.scheduled_for || '',
          status: c.status || 'Pending',
          target: c.target || c.audience || '',
        }));
        setScheduled([...broadcasts, ...communications]);
      } else {
        setScheduled([]);
      }
    } catch {
      setScheduled(fallbackScheduled);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduled();
  }, []);

  const handleCancel = async (id: string) => {
    try {
      await systemCommunicationApi.cancelScheduled(id);
      setScheduled((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: 'Cancelled' as const } : s))
      );
    } catch (err) {
      console.error('Cancel failed', err);
    }
  };

  const groupedByDate = scheduled.reduce<Record<string, ScheduledMessage[]>>((acc, item) => {
    const dateKey = new Date(item.scheduledAt).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(groupedByDate[b][0].scheduledAt).getTime() - new Date(groupedByDate[a][0].scheduledAt).getTime()
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid #e8ddd0',
          borderTopColor: '#ea6645', borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .scheduled-row { transition: all 0.2s ease; }
        .scheduled-row:hover { background: #f5efe8; }
        .cancel-btn { transition: all 0.2s ease; cursor: pointer; }
        .cancel-btn:hover { background: #fee2e2 !important; color: #dc2626 !important; }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ec4899, #db2777)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-calendar-alt" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Scheduled Messages
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>View and manage all scheduled communications</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706' }}>{scheduled.filter((s) => s.status === 'Pending').length}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Pending</div>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>{scheduled.filter((s) => s.status === 'Sent').length}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Sent</div>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#9ca3af' }}>{scheduled.filter((s) => s.status === 'Cancelled').length}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Cancelled</div>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6' }}>{scheduled.length}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Total</div>
        </div>
      </div>

      {/* Grouped by Date */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sortedDates.map((dateKey) => {
          const items = groupedByDate[dateKey];
          const hasPending = items.some((s) => s.status === 'Pending');
          return (
            <div key={dateKey}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <i className="fa fa-calendar-day" style={{ color: '#ec4899', fontSize: '16px' }}></i>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{dateKey}</h2>
                <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: '#f3e8ff', color: '#7c3aed' }}>{items.length} messages</span>
              </div>
              <div style={{ background: '#fefcf9', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {items.map((item) => {
                  const sb = statusBadge(item.status);
                  return (
                    <div key={item.id} className="scheduled-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                        background: item.type === 'Broadcast' ? '#fef3c7' : '#dbeafe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className={`fa ${typeIcon[item.type] || 'fa-bell'}`} style={{ fontSize: '16px', color: item.type === 'Broadcast' ? '#d97706' : '#2563eb' }}></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.title}
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>{item.type}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                          {item.channel} · {item.target} · {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: sb.bg, color: sb.color, flexShrink: 0 }}>{item.status}</span>
                      {item.status === 'Pending' && (
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="cancel-btn"
                          style={{ padding: '8px 14px', background: '#f3f4f6', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                        >
                          <i className="fa fa-ban"></i> Cancel
                        </button>
                      )}
                      <button style={{ padding: '8px 10px', background: 'transparent', borderRadius: '6px', border: 'none', fontSize: '13px', cursor: 'pointer', color: '#9ca3af', flexShrink: 0 }}>
                        <i className="fa fa-chevron-right"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
