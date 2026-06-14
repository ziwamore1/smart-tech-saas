'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

const fallbackStats = {
  email: { sent: 45280, delivered: 43890, failed: 1390 },
  sms: { sent: 18240, delivered: 17650, failed: 590 },
  whatsapp: { sent: 8950, delivered: 8710, failed: 240 },
  push: { sent: 15670 },
};

const fallbackDaily = [
  { date: 'Jun 8', email: 2100, sms: 850, whatsapp: 420, push: 720 },
  { date: 'Jun 9', email: 1850, sms: 720, whatsapp: 380, push: 650 },
  { date: 'Jun 10', email: 2300, sms: 910, whatsapp: 510, push: 810 },
  { date: 'Jun 11', email: 1980, sms: 780, whatsapp: 440, push: 690 },
  { date: 'Jun 12', email: 2650, sms: 1020, whatsapp: 580, push: 920 },
  { date: 'Jun 13', email: 2400, sms: 950, whatsapp: 520, push: 850 },
  { date: 'Jun 14', email: 1250, sms: 470, whatsapp: 260, push: 430 },
];

const fallbackDistribution = [
  { label: 'Email', value: 52, color: '#2563eb' },
  { label: 'SMS', value: 21, color: '#d97706' },
  { label: 'WhatsApp', value: 10, color: '#059669' },
  { label: 'Push Notifications', value: 17, color: '#8b5cf6' },
];

const fallbackDeliveryRates = [
  { label: 'Email', rate: 96.9, color: '#10b981' },
  { label: 'SMS', rate: 96.8, color: '#10b981' },
  { label: 'WhatsApp', rate: 97.3, color: '#10b981' },
  { label: 'Push', rate: 99.2, color: '#10b981' },
];

export default function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState('2026-06-01');
  const [dateTo, setDateTo] = useState('2026-06-14');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(fallbackStats);
  const [daily, setDaily] = useState(fallbackDaily);
  const [distribution, setDistribution] = useState(fallbackDistribution);
  const [deliveryRates, setDeliveryRates] = useState(fallbackDeliveryRates);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await systemCommunicationApi.getAnalytics({ from: dateFrom, to: dateTo });
        const body = res.data?.statusCode ? res.data.data : res.data;
        if (body) {
          if (body.channels?.email || body.channels?.sms || body.channels?.whatsapp || body.channels?.pushNotification) {
            setStats(body.channels);
          }
          if (body.trends && body.trends.length > 0 && 'email' in body.trends[0]) {
            setDaily(body.trends);
          }
          if (body.distribution) {
            setDistribution(body.distribution);
          }
          if (body.deliveryRates) {
            setDeliveryRates(body.deliveryRates);
          }
        }
      } catch {
        // Keep fallback data on error
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [dateFrom, dateTo]);

  const maxDaily = Math.max(...daily.map((d) => d.email + d.sms + d.whatsapp + d.push));
  const maxChannelValue = Math.max(...distribution.map((c) => c.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .stat-card { transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .bar { transition: all 0.3s ease; }
        .bar:hover { opacity: 0.8; }
      `}</style>
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <i className="fa fa-spinner fa-spin" style={{ fontSize: '28px', display: 'block', marginBottom: '12px' }}></i>
          Loading analytics...
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #14b8a6, #0d9488)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-chart-bar" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Communication Usage Analytics
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Track message volumes, delivery rates, and channel performance</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '4px' }}>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '4px' }}>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none' }} />
          </div>
        </div>
      </div>

      {/* Email Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '36px', height: '36px', background: '#dbeafe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-envelope" style={{ fontSize: '16px', color: '#2563eb' }}></i>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>EMAIL</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
            <div><span style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>{stats.email.sent.toLocaleString()}</span><span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>sent</span></div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <span style={{ fontSize: '13px', color: '#059669' }}><i className="fa fa-check-circle"></i> {stats.email.delivered.toLocaleString()} delivered</span>
            <span style={{ fontSize: '13px', color: '#dc2626' }}><i className="fa fa-times-circle"></i> {stats.email.failed.toLocaleString()} failed</span>
          </div>
          <div style={{ marginTop: '8px', height: '6px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(stats.email.delivered / stats.email.sent) * 100}%`, background: '#10b981', borderRadius: '999px' }}></div>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '36px', height: '36px', background: '#fef3c7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-comment-dots" style={{ fontSize: '16px', color: '#d97706' }}></i>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#d97706' }}>SMS</span>
          </div>
          <div><span style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>{stats.sms.sent.toLocaleString()}</span><span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>sent</span></div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <span style={{ fontSize: '13px', color: '#059669' }}><i className="fa fa-check-circle"></i> {stats.sms.delivered.toLocaleString()} delivered</span>
            <span style={{ fontSize: '13px', color: '#dc2626' }}><i className="fa fa-times-circle"></i> {stats.sms.failed.toLocaleString()} failed</span>
          </div>
          <div style={{ marginTop: '8px', height: '6px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(stats.sms.delivered / stats.sms.sent) * 100}%`, background: '#10b981', borderRadius: '999px' }}></div>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '36px', height: '36px', background: '#d1fae5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-whatsapp" style={{ fontSize: '16px', color: '#059669' }}></i>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>WHATSAPP</span>
          </div>
          <div><span style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>{stats.whatsapp.sent.toLocaleString()}</span><span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>sent</span></div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <span style={{ fontSize: '13px', color: '#059669' }}><i className="fa fa-check-circle"></i> {stats.whatsapp.delivered.toLocaleString()} delivered</span>
            <span style={{ fontSize: '13px', color: '#dc2626' }}><i className="fa fa-times-circle"></i> {stats.whatsapp.failed.toLocaleString()} failed</span>
          </div>
          <div style={{ marginTop: '8px', height: '6px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(stats.whatsapp.delivered / stats.whatsapp.sent) * 100}%`, background: '#10b981', borderRadius: '999px' }}></div>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '36px', height: '36px', background: '#f5f3ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-bell" style={{ fontSize: '16px', color: '#8b5cf6' }}></i>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#8b5cf6' }}>PUSH</span>
          </div>
          <div><span style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937' }}>{stats.push.sent.toLocaleString()}</span><span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>sent</span></div>
          <div style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '13px', color: '#059669' }}><i className="fa fa-check-circle"></i> {Math.round(stats.push.sent * 0.99).toLocaleString()} delivered (est.)</span>
          </div>
          <div style={{ marginTop: '8px', height: '6px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '99%', background: '#10b981', borderRadius: '999px' }}></div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Daily Volume Trend */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-chart-line" style={{ color: '#14b8a6' }}></i> Daily Message Volume Trend
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px', padding: '0 8px' }}>
            {daily.map((d) => {
              const total = d.email + d.sms + d.whatsapp + d.push;
              const heightPct = (total / maxDaily) * 100;
              return (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ position: 'relative', width: '100%', height: `${heightPct}%`, display: 'flex', flexDirection: 'column-reverse', gap: '1px' }}>
                    <div className="bar" style={{ width: '100%', height: `${(d.email / total) * 100}%`, background: '#2563eb', borderRadius: '3px 3px 0 0', minHeight: '2px' }} title={`Email: ${d.email}`}></div>
                    <div className="bar" style={{ width: '100%', height: `${(d.sms / total) * 100}%`, background: '#d97706', borderRadius: '3px 3px 0 0', minHeight: '2px' }} title={`SMS: ${d.sms}`}></div>
                    <div className="bar" style={{ width: '100%', height: `${(d.whatsapp / total) * 100}%`, background: '#059669', borderRadius: '3px 3px 0 0', minHeight: '2px' }} title={`WhatsApp: ${d.whatsapp}`}></div>
                    <div className="bar" style={{ width: '100%', height: `${(d.push / total) * 100}%`, background: '#8b5cf6', borderRadius: '3px 3px 0 0', minHeight: '2px' }} title={`Push: ${d.push}`}></div>
                  </div>
                  <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{d.date}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}><span style={{ width: '10px', height: '10px', background: '#2563eb', borderRadius: '2px' }}></span> Email</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}><span style={{ width: '10px', height: '10px', background: '#d97706', borderRadius: '2px' }}></span> SMS</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}><span style={{ width: '10px', height: '10px', background: '#059669', borderRadius: '2px' }}></span> WhatsApp</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280' }}><span style={{ width: '10px', height: '10px', background: '#8b5cf6', borderRadius: '2px' }}></span> Push</span>
          </div>
        </div>

        {/* Channel Distribution */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-chart-pie" style={{ color: '#14b8a6' }}></i> Channel Distribution
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {distribution.map((ch) => (
              <div key={ch.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', background: ch.color, borderRadius: '3px' }}></span>
                    {ch.label}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{ch.value}%</span>
                </div>
                <div style={{ height: '10px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div className="bar" style={{ height: '100%', width: `${(ch.value / maxChannelValue) * 100}%`, background: ch.color, borderRadius: '999px' }}></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '24px' }}>
            {distribution.map((ch) => (
              <div key={ch.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: ch.color }}>{ch.value}%</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{ch.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delivery Success Rate */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-check-circle" style={{ color: '#10b981' }}></i> Delivery Success Rate by Channel
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {deliveryRates.map((ch) => (
            <div key={ch.label} style={{ textAlign: 'center', padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: ch.color }}>{ch.rate}%</div>
              <div style={{ fontSize: '13px', color: '#166534', fontWeight: 500, marginTop: '4px' }}>{ch.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
