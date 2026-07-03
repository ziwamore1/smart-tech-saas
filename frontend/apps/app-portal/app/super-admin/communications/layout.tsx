'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const commNav = [
  { name: 'Dashboard', href: '/super-admin/communications', icon: 'fa-tachometer-alt', color: '#ea6645' },
  { name: 'SMS', href: '/super-admin/communications/sms', icon: 'fa-sms', color: '#3b82f6' },
  { name: 'Email', href: '/super-admin/communications/email', icon: 'fa-envelope', color: '#10b981' },
  { name: 'WhatsApp', href: '/super-admin/communications/whatsapp', icon: 'fa-whatsapp', color: '#25D366' },
  { name: 'Push', href: '/super-admin/communications/push', icon: 'fa-bell', color: '#8b5cf6' },
  { name: 'Providers', href: '/super-admin/communications/providers', icon: 'fa-server', color: '#3b82f6' },
  { name: 'Routing', href: '/super-admin/communications/routing', icon: 'fa-route', color: '#f97316' },
  { name: 'Templates', href: '/super-admin/communications/templates', icon: 'fa-file-alt', color: '#f97316' },
  { name: 'Sender IDs', href: '/super-admin/communications/sender-ids', icon: 'fa-id-card', color: '#ec4899' },
  { name: 'Campaigns', href: '/super-admin/communications/campaigns', icon: 'fa-bullhorn', color: '#8b5cf6' },
  { name: 'Broadcast', href: '/super-admin/communications/broadcast', icon: 'fa-broadcast-tower', color: '#f59e0b' },
  { name: 'Scheduled', href: '/super-admin/communications/scheduled', icon: 'fa-calendar-alt', color: '#ec4899' },
  { name: 'Analytics', href: '/super-admin/communications/analytics', icon: 'fa-chart-bar', color: '#14b8a6' },
  { name: 'Delivery Logs', href: '/super-admin/communications/delivery-logs', icon: 'fa-clipboard-list', color: '#6366f1' },
  { name: 'Credits', href: '/super-admin/communications/credits', icon: 'fa-coins', color: '#f59e0b' },
  { name: 'Notifications', href: '/super-admin/communications/notifications', icon: 'fa-bell', color: '#10b981' },
];

export default function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/super-admin/communications') {
      return pathname === '/super-admin/communications';
    }
    return pathname.startsWith(href);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .comm-link { transition: all 0.2s ease; cursor: pointer; text-decoration: none; }
        .comm-link:hover { background: #f5efe8 !important; }
        .comm-link.active { background: linear-gradient(135deg, rgba(234,102,69,0.1), rgba(245,158,11,0.1)) !important; border-bottom: 2px solid #ea6645 !important; }
        .comm-link.active .comm-icon { color: #ea6645 !important; }
        .comm-link.active .comm-text { color: #ea6645 !important; font-weight: 600 !important; }
      `}</style>

      <div style={{
        background: '#fdfaf7',
        borderRadius: '16px',
        border: '1px solid #e8ddd0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fa fa-comments" style={{ fontSize: '18px', color: 'white' }}></i>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '18px', color: '#1f2937' }}>SmartTech Communications Cloud</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>Multi-channel communication platform with unified messaging, routing, and analytics</div>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: '4px', flexWrap: 'wrap',
          borderBottom: '1px solid #e8ddd0', paddingBottom: '8px',
        }}>
          {commNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`comm-link ${active ? 'active' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '13px', fontWeight: 500,
                  color: active ? '#ea6645' : '#6b7280',
                  background: active ? 'linear-gradient(135deg, rgba(234,102,69,0.1), rgba(245,158,11,0.1))' : 'transparent',
                  borderBottom: active ? '2px solid #ea6645' : '2px solid transparent',
                }}
              >
                <i className={`fa ${item.icon} comm-icon`} style={{ fontSize: '14px', color: active ? '#ea6645' : item.color }}></i>
                <span className="comm-text">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ minHeight: '400px' }}>
        {children}
      </div>
    </div>
  );
}
