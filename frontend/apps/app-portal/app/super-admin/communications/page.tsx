'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { communicationsCloudApi } from '@/lib/api';

const fallbackStats = {
  totalMessages: 0,
  todayMessages: 0,
  deliveryRate: 0,
  activeProviders: 0,
};

const mockRecentMessages = [
  { id: '1', channel: 'SMS', recipient: '+260977123456', message: 'Fee payment reminder for Term 2', status: 'Delivered', sentAt: '2026-07-03T08:30:00Z', cost: 0.05 },
  { id: '2', channel: 'Email', recipient: 'parent@school.com', message: 'Exam results now available online', status: 'Delivered', sentAt: '2026-07-03T07:45:00Z', cost: 0 },
  { id: '3', channel: 'WhatsApp', recipient: '+260955789012', message: 'School open day invitation', status: 'Sent', sentAt: '2026-07-02T16:00:00Z', cost: 0.08 },
  { id: '4', channel: 'Push', recipient: 'All Teachers', message: 'Staff meeting tomorrow at 14:00', status: 'Delivered', sentAt: '2026-07-02T14:30:00Z', cost: 0 },
  { id: '5', channel: 'SMS', recipient: '+260966345678', message: 'Your child was absent today', status: 'Failed', sentAt: '2026-07-02T10:00:00Z', cost: 0 },
];

const mockProviderHealth = [
  { name: 'Beem Africa', channel: 'SMS', status: 'Healthy', latency: 120, uptime: 99.8 },
  { name: 'Zoho Mail', channel: 'Email', status: 'Healthy', latency: 85, uptime: 99.9 },
  { name: 'Twilio', channel: 'WhatsApp', status: 'Healthy', latency: 95, uptime: 99.7 },
  { name: 'Firebase', channel: 'Push', status: 'Degraded', latency: 340, uptime: 97.2 },
];

const channelColor: Record<string, string> = {
  SMS: '#d97706', Email: '#2563eb', WhatsApp: '#059669', Push: '#8b5cf6',
};

const channelBg: Record<string, string> = {
  SMS: '#fef3c7', Email: '#dbeafe', WhatsApp: '#d1fae5', Push: '#f5f3ff',
};

const statusBadge = (status: string) => {
  const m: Record<string, { bg: string; color: string }> = {
    Delivered: { bg: '#d1fae5', color: '#059669' },
    Sent: { bg: '#dbeafe', color: '#2563eb' },
    Failed: { bg: '#fee2e2', color: '#dc2626' },
    Pending: { bg: '#fef3c7', color: '#d97706' },
  };
  return m[status] || { bg: '#f3f4f6', color: '#6b7280' };
};

export default function CommunicationsDashboardPage() {
  const [stats, setStats] = useState(fallbackStats);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, msgRes] = await Promise.all([
          communicationsCloudApi.getDashboardStats(),
          communicationsCloudApi.getMessages({ limit: 5 }),
        ]);
        const sBody = statsRes.data?.statusCode ? statsRes.data.data : statsRes.data;
        const mBody = msgRes.data?.statusCode ? msgRes.data.data : msgRes.data;
        setStats({
          totalMessages: sBody?.totalMessages ?? 0,
          todayMessages: sBody?.todayMessages ?? 0,
          deliveryRate: sBody?.deliveryRate ?? 0,
          activeProviders: sBody?.activeProviders ?? 0,
        });
        setRecentMessages(Array.isArray(mBody) ? mBody : mBody?.messages || []);
      } catch {
        setStats(fallbackStats);
        setRecentMessages(mockRecentMessages);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
        .stat-card { transition: all 0.3s ease; cursor: default; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .action-btn { transition: all 0.2s ease; cursor: pointer; }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
        .msg-row { transition: all 0.2s ease; }
        .msg-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ea6645, #f59e0b)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-tachometer-alt" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Communications Dashboard
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>SmartTech Communications Cloud overview</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(59,130,246,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Messages</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{stats.totalMessages.toLocaleString()}</p>
          <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <i className="fa fa-envelope"></i> All-time across channels
          </span>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(234,102,69,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Today's Messages</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{stats.todayMessages.toLocaleString()}</p>
          <span style={{ fontSize: '11px', color: '#ea6645', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <i className="fa fa-calendar-day"></i> Sent today
          </span>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(16,185,129,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Delivery Rate</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{stats.deliveryRate}%</p>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span> Success rate
          </span>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(139,92,246,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Active Providers</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{stats.activeProviders}</p>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <i className="fa fa-server"></i> Connected & ready
          </span>
        </div>
      </div>

      {/* Traffic Chart + Provider Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-chart-line" style={{ color: '#ea6645' }}></i> Traffic Overview
            </h2>
            <select style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', background: '#fdfaf7', fontSize: '12px', color: '#6b7280' }}>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div style={{ height: '200px', background: '#fdfaf7', borderRadius: '12px', border: '1px solid #e8ddd0', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', padding: '16px 8px', position: 'relative', overflow: 'hidden' }}>
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} style={{ flex: 1, maxWidth: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '100%', height: `${h}%`, background: 'linear-gradient(180deg, #ea6645, #f59e0b)', borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease', minHeight: '8px' }}></div>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
              </div>
            ))}
            <div style={{ position: 'absolute', bottom: '50px', left: '50%', transform: 'translateX(-50%)', color: '#9ca3af', fontSize: '13px' }}>
              <i className="fa fa-chart-bar" style={{ marginRight: '6px' }}></i> Daily message volume
            </div>
          </div>
        </div>

        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-heartbeat" style={{ color: '#10b981' }}></i> Provider Health
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mockProviderHealth.map((p) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: '#fdfaf7', border: '1px solid #e8ddd0' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.status === 'Healthy' ? '#10b981' : '#f59e0b', flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>{p.channel} &middot; {p.latency}ms latency</div>
                </div>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{p.uptime}% uptime</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Messages + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-comments" style={{ color: '#6366f1' }}></i> Recent Messages
            </h2>
            <Link href="/super-admin/communications/delivery-logs" style={{ fontSize: '12px', color: '#ea6645', fontWeight: 600, textDecoration: 'none' }}>
              View All <i className="fa fa-arrow-right"></i>
            </Link>
          </div>
          {recentMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <i className="fa fa-inbox" style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}></i>
              <p style={{ margin: '0', fontSize: '14px' }}>No messages yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(recentMessages.length > 0 ? recentMessages : mockRecentMessages).map((msg) => {
                const badge = statusBadge(msg.status);
                return (
                  <div key={msg.id} className="msg-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: '1px solid transparent' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0, background: channelBg[msg.channel] || '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa ${msg.channel === 'SMS' ? 'fa-comment-dots' : msg.channel === 'Email' ? 'fa-envelope' : msg.channel === 'WhatsApp' ? 'fa-whatsapp' : 'fa-bell'}`} style={{ fontSize: '14px', color: channelColor[msg.channel] || '#6b7280' }}></i>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.message || msg.content}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{msg.channel} &middot; {msg.recipient || msg.recipientId} &middot; {formatTime(msg.sentAt || msg.createdAt)}</div>
                    </div>
                    <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, flexShrink: 0, background: badge.bg, color: badge.color }}>{msg.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-bolt" style={{ color: '#f59e0b' }}></i> Quick Actions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/super-admin/communications/sms" className="action-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'linear-gradient(135deg, #ea6645, #f59e0b)', borderRadius: '12px', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 12px rgba(234,102,69,0.3)' }}>
                <i className="fa fa-sms" style={{ fontSize: '18px' }}></i> Send SMS
              </Link>
              <Link href="/super-admin/communications/email" className="action-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#dbeafe', borderRadius: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '14px', border: '1px solid #bfdbfe' }}>
                <i className="fa fa-envelope" style={{ fontSize: '18px' }}></i> Send Email
              </Link>
              <Link href="/super-admin/communications/whatsapp" className="action-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#d1fae5', borderRadius: '12px', color: '#059669', textDecoration: 'none', fontWeight: 600, fontSize: '14px', border: '1px solid #bbf7d0' }}>
                <i className="fa fa-whatsapp" style={{ fontSize: '18px' }}></i> Send WhatsApp
              </Link>
              <Link href="/super-admin/communications/push" className="action-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#f5f3ff', borderRadius: '12px', color: '#7c3aed', textDecoration: 'none', fontWeight: 600, fontSize: '14px', border: '1px solid #ddd6fe' }}>
                <i className="fa fa-bell" style={{ fontSize: '18px' }}></i> Send Push
              </Link>
              <Link href="/super-admin/communications/routing" className="action-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#f0fdf4', borderRadius: '12px', color: '#059669', textDecoration: 'none', fontWeight: 600, fontSize: '14px', border: '1px solid #bbf7d0' }}>
                <i className="fa fa-route" style={{ fontSize: '18px' }}></i> Manage Routing
              </Link>
            </div>
          </div>

          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-info-circle" style={{ color: '#14b8a6' }}></i> Cloud Summary
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>SMS Credits</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>12,450</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>Email Balance</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>Unlimited</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>WhatsApp Balance</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>8,230</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0' }}>
                <span style={{ color: '#6b7280' }}>Push Balance</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>Unlimited</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
