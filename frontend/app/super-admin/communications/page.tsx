'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { systemCommunicationApi } from '@/lib/api';

const fallbackStats = {
  totalProviders: 0,
  activeProviders: 0,
  totalBroadcasts: 0,
  messagesSentToday: 0,
  zohoStatus: 'Not Configured',
  zohoSender: '-',
  zohoLastTest: new Date().toISOString(),
  beemBalance: 0,
  beemSentToday: 0,
  beemDeliveryRate: 0,
};

const mockRecentActivity = [
  { id: 1, action: 'Broadcast sent to all schools', channel: 'Email', target: '1,245 recipients', timestamp: '2026-06-14T13:45:00Z', status: 'Sent' },
  { id: 2, action: 'SMS campaign completed', channel: 'SMS', target: '890 recipients', timestamp: '2026-06-14T12:30:00Z', status: 'Sent' },
  { id: 3, action: 'Zoho Mail connection tested', channel: 'Email', target: 'System', timestamp: '2026-06-14T08:30:00Z', status: 'Success' },
  { id: 4, action: 'Fee reminder triggered', channel: 'Email, SMS', target: '2,100 parents', timestamp: '2026-06-13T14:00:00Z', status: 'Sent' },
  { id: 5, action: 'YouTube video synced', channel: 'Social', target: 'Channel', timestamp: '2026-06-13T10:15:00Z', status: 'Synced' },
  { id: 6, action: 'New provider added: SendGrid', channel: 'Email', target: 'System', timestamp: '2026-06-12T16:45:00Z', status: 'Configured' },
  { id: 7, action: 'Beem Africa SMS balance low', channel: 'SMS', target: 'Admin', timestamp: '2026-06-12T09:00:00Z', status: 'Warning' },
  { id: 8, action: 'Exam results published', channel: 'Email, SMS', target: '5,600 recipients', timestamp: '2026-06-11T11:30:00Z', status: 'Sent' },
  { id: 9, action: 'Scheduled broadcast cancelled', channel: 'WhatsApp', target: '450 recipients', timestamp: '2026-06-10T15:20:00Z', status: 'Cancelled' },
  { id: 10, action: 'Report cards generated', channel: 'In-App', target: '3,200 students', timestamp: '2026-06-10T08:00:00Z', status: 'Delivered' },
];

const statusColors: Record<string, string> = {
  Connected: '#10b981',
  Disconnected: '#6b7280',
  'Auth Failed': '#ef4444',
  'Config Error': '#f59e0b',
};

export default function CommunicationsDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await systemCommunicationApi.getDashboard();
        const body = res.data?.statusCode ? res.data.data : res.data;
        setStats(body || fallbackStats);
      } catch {
        setStats(fallbackStats);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

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

  const s = stats || fallbackStats;
  const formatTime = (ts: string) => new Date(ts).toLocaleString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .stat-card { transition: all 0.3s ease; cursor: default; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .action-btn { transition: all 0.2s ease; cursor: pointer; }
        .action-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
        .activity-row { transition: all 0.2s ease; }
        .activity-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px',
            background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fa fa-tachometer-alt" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Communications Dashboard
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Monitor and manage all platform communications</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(59,130,246,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Providers</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{s.totalProviders}</p>
          <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <i className="fa fa-server"></i> System email, SMS & social providers
          </span>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(16,185,129,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Active Providers</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{s.activeProviders}</p>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span> Connected & ready
          </span>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(139,92,246,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Broadcasts</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{s.totalBroadcasts}</p>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <i className="fa fa-bullhorn"></i> All-time campaigns
          </span>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(234,102,69,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Messages Sent Today</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: '0' }}>{s.messagesSentToday.toLocaleString()}</p>
          <span style={{ fontSize: '11px', color: '#ea6645', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
            <i className="fa fa-check-circle"></i> Across all channels
          </span>
        </div>
      </div>

      {/* Zoho Mail & Beem Africa Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '44px', height: '44px', background: '#dbeafe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-envelope" style={{ fontSize: '20px', color: '#2563eb' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>Zoho Mail</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>Email Provider</div>
            </div>
            <span style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
              background: s.zohoStatus === 'Connected' ? '#d1fae5' : s.zohoStatus === 'Disconnected' ? '#f3f4f6' : s.zohoStatus === 'Auth Failed' ? '#fee2e2' : '#fef3c7',
              color: s.zohoStatus === 'Connected' ? '#059669' : s.zohoStatus === 'Disconnected' ? '#6b7280' : s.zohoStatus === 'Auth Failed' ? '#dc2626' : '#d97706',
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColors[s.zohoStatus] || '#6b7280', display: 'inline-block', marginRight: '6px' }}></span>
              {s.zohoStatus}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280' }}>
              <span>Current Sender:</span>
              <span style={{ fontWeight: 600, color: '#1f2937' }}>{s.zohoSender}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280' }}>
              <span>Last Tested:</span>
              <span style={{ fontWeight: 500, color: '#374151' }}>{formatTime(s.zohoLastTest)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button style={{ padding: '8px 16px', background: '#eff6ff', color: '#2563eb', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <i className="fa fa-plug" style={{ marginRight: '6px' }}></i> Test Connection
            </button>
            <button style={{ padding: '8px 16px', background: '#f3f4f6', color: '#6b7280', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <i className="fa fa-cog" style={{ marginRight: '6px' }}></i> Configure
            </button>
          </div>
        </div>

        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '44px', height: '44px', background: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-comment-dots" style={{ fontSize: '20px', color: '#d97706' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937' }}>Beem Africa</div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>SMS Provider</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '10px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a' }}>{s.beemBalance.toFixed(2)}</div>
              <div style={{ fontSize: '11px', color: '#166534' }}>SMS Balance</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#eff6ff', borderRadius: '10px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{s.beemSentToday}</div>
              <div style={{ fontSize: '11px', color: '#1e40af' }}>Sent Today</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#fefcbf', borderRadius: '10px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>{s.beemDeliveryRate}%</div>
              <div style={{ fontSize: '11px', color: '#92400e' }}>Delivery Rate</div>
            </div>
          </div>
          <div style={{ height: '8px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #f59e0b, #10b981)', borderRadius: '999px', width: `${s.beemDeliveryRate}%` }}></div>
          </div>
          <button style={{ marginTop: '16px', padding: '8px 16px', background: '#fef3c7', color: '#d97706', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <i className="fa fa-sync-alt" style={{ marginRight: '6px' }}></i> Top Up Balance
          </button>
        </div>
      </div>

      {/* Recent Activity + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-history" style={{ color: '#6366f1' }}></i> Recent Activity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {mockRecentActivity.map((item) => (
              <div key={item.id} className="activity-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', border: '1px solid transparent' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: item.channel.includes('Email') ? '#dbeafe' : item.channel.includes('SMS') ? '#fef3c7' : item.channel.includes('Social') ? '#fee2e2' : '#f3f4f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`fa ${item.channel.includes('Email') ? 'fa-envelope' : item.channel.includes('SMS') ? 'fa-comment' : item.channel.includes('Social') ? 'fa-youtube' : 'fa-bell'}`} style={{ fontSize: '14px', color: item.channel.includes('Email') ? '#2563eb' : item.channel.includes('SMS') ? '#d97706' : item.channel.includes('Social') ? '#dc2626' : '#6b7280' }}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>{item.action}</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>{item.channel} · {item.target} · {formatTime(item.timestamp)}</div>
                </div>
                <span style={{
                  padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, flexShrink: 0,
                  background: item.status === 'Sent' || item.status === 'Success' || item.status === 'Synced' || item.status === 'Delivered' ? '#d1fae5' : item.status === 'Warning' ? '#fef3c7' : item.status === 'Cancelled' ? '#fee2e2' : '#f3f4f6',
                  color: item.status === 'Sent' || item.status === 'Success' || item.status === 'Synced' || item.status === 'Delivered' ? '#059669' : item.status === 'Warning' ? '#d97706' : item.status === 'Cancelled' ? '#dc2626' : '#6b7280',
                }}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-bolt" style={{ color: '#f59e0b' }}></i> Quick Actions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link href="/super-admin/communications/broadcast" className="action-btn" style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                background: 'linear-gradient(135deg, #ea6645, #f59e0b)', borderRadius: '12px',
                color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '14px',
                boxShadow: '0 4px 12px rgba(234,102,69,0.3)',
              }}>
                <i className="fa fa-bullhorn" style={{ fontSize: '18px' }}></i>
                Create New Broadcast
              </Link>

              <Link href="/super-admin/communications/youtube" className="action-btn" style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                background: '#fee2e2', borderRadius: '12px', color: '#dc2626',
                textDecoration: 'none', fontWeight: 600, fontSize: '14px',
                border: '1px solid #fecaca',
              }}>
                <i className="fa fa-youtube" style={{ fontSize: '18px' }}></i>
                Check YouTube Channel
              </Link>

              <Link href="/super-admin/communications/analytics" className="action-btn" style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                background: '#eff6ff', borderRadius: '12px', color: '#2563eb',
                textDecoration: 'none', fontWeight: 600, fontSize: '14px',
                border: '1px solid #bfdbfe',
              }}>
                <i className="fa fa-chart-bar" style={{ fontSize: '18px' }}></i>
                View Usage Analytics
              </Link>

              <Link href="/super-admin/communications/providers" className="action-btn" style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                background: '#f0fdf4', borderRadius: '12px', color: '#059669',
                textDecoration: 'none', fontWeight: 600, fontSize: '14px',
                border: '1px solid #bbf7d0',
              }}>
                <i className="fa fa-server" style={{ fontSize: '18px' }}></i>
                Manage Providers
              </Link>
            </div>
          </div>

          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-info-circle" style={{ color: '#14b8a6' }}></i> System Summary
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>Email Providers</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>SMS Providers</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>WhatsApp Providers</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>2</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '8px 0' }}>
                <span style={{ color: '#6b7280' }}>Social Channels</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
