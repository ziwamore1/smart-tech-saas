'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

interface NotificationType {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  active: boolean;
  lastTriggered: string | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await systemCommunicationApi.getNotifications();
        const body = res.data?.statusCode ? res.data.data : res.data;
        setNotifications(body?.notifications || []);
      } catch {
        // Keep empty state on error
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const toggleActive = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, active: !n.active } : n))
    );
  };

  const handleTrigger = async (id: string) => {
    setTriggering(id);
    try {
      await systemCommunicationApi.triggerNotification({ id });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lastTriggered: new Date().toISOString() } : n))
      );
    } catch {
      // Silently fail
    } finally {
      setTriggering(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .notif-row { transition: all 0.2s ease; }
        .notif-row:hover { background: #f5efe8; }
        .trigger-btn { transition: all 0.2s ease; }
        .trigger-btn:hover { transform: scale(1.05); }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-bell" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Automated System Communications
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage automated notifications and system-triggered communications</p>
      </div>

      {/* Notifications List */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-list" style={{ color: '#6b7280' }}></i> Notification Types
          </h2>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>{notifications.filter((n) => n.active).length} active of {notifications.length}</span>
        </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                <i className="fa fa-spinner fa-spin" style={{ fontSize: '28px', display: 'block', marginBottom: '12px' }}></i>
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
                <i className="fa fa-inbox" style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}></i>
                No notifications found
              </div>
            ) : notifications.map((notif) => (
            <div key={notif.id} className="notif-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: '44px', height: '44px', background: notif.iconBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa ${notif.icon}`} style={{ fontSize: '18px', color: notif.iconColor }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                  {notif.name}
                  <span style={{
                    padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                    background: notif.active ? '#d1fae5' : '#f3f4f6',
                    color: notif.active ? '#059669' : '#9ca3af',
                  }}>
                    {notif.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>{notif.description}</p>
                {notif.lastTriggered && (
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>
                    <i className="fa fa-clock" style={{ marginRight: '4px' }}></i>
                    Last triggered: {new Date(notif.lastTriggered).toLocaleString()}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                {/* Toggle Switch */}
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={notif.active}
                    onChange={() => toggleActive(notif.id)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: notif.active ? '#10b981' : '#d1d5db',
                    borderRadius: '24px', transition: '0.3s',
                  }}>
                    <span style={{
                      position: 'absolute', height: '18px', width: '18px', borderRadius: '50%',
                      backgroundColor: 'white', top: '3px',
                      left: notif.active ? '23px' : '3px',
                      transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </span>
                </label>
                <button
                  onClick={() => handleTrigger(notif.id)}
                  disabled={triggering === notif.id}
                  className="trigger-btn"
                  style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: triggering === notif.id ? 'not-allowed' : 'pointer',
                    background: triggering === notif.id ? '#d1fae5' : '#f3f4f6',
                    color: triggering === notif.id ? '#059669' : '#6b7280',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <i className={`fa ${triggering === notif.id ? 'fa-spinner fa-spin' : 'fa-play'}`}></i>
                  {triggering === notif.id ? 'Triggering...' : 'Trigger Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
