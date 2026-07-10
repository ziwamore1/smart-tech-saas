'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useIsSuperAdmin } from '@/lib/auth-context';
import Link from 'next/link';
import '../super-admin-fix.css';

const superAdminNav = [
  { 
    name: 'Dashboard', 
    href: '/super-admin', 
    icon: 'fa-th-large',
    color: '#ea6645'
  },
  { 
    name: 'Exams Overview', 
    href: '/dashboard/exams', 
    icon: 'fa-file-alt',
    color: '#f97316'
  },
  { 
    name: 'Assessments', 
    href: '/dashboard/assessments', 
    icon: 'fa-tasks',
    color: '#8b5cf6'
  },
  { 
    name: 'Schools', 
    href: '/super-admin/schools', 
    icon: 'fa-building',
    color: '#3b82f6'
  },
  { 
    name: 'Subscription Plans', 
    href: '/super-admin/subscription-plans', 
    icon: 'fa-credit-card',
    color: '#10b981'
  },
  { 
    name: 'Institution Types', 
    href: '/super-admin/institution-types', 
    icon: 'fa-university',
    color: '#059669'
  },
  { 
    name: 'Feature Locks', 
    href: '/super-admin/model-locks', 
    icon: 'fa-lock',
    color: '#8b5cf6'
  },
  { 
    name: 'Verification Center', 
    href: '/super-admin/verification', 
    icon: 'fa-shield-alt',
    color: '#6366f1'
  },
  { 
    name: 'Document Signatures', 
    href: '/super-admin/verification/signatures', 
    icon: 'fa-pen-fancy',
    color: '#3b82f6'
  },
  { 
    name: 'Blockchain Certs', 
    href: '/super-admin/verification/blockchain', 
    icon: 'fa-link',
    color: '#8b5cf6'
  },
  { 
    name: 'Ministry Verifications', 
    href: '/super-admin/verification/ministry', 
    icon: 'fa-building',
    color: '#10b981'
  },
  { 
    name: 'Approval Workflows', 
    href: '/super-admin/verification/approvals', 
    icon: 'fa-check-double',
    color: '#f59e0b'
  },
  { 
    name: 'Intelligence', 
    href: '/super-admin/intelligence', 
    icon: 'fa-brain',
    color: '#14b8a6'
  },
  { 
    name: 'Communications Hub', 
    href: '/super-admin/communications', 
    icon: 'fa-bullhorn',
    color: '#0ea5e9'
  },
  { 
    name: 'Audit Logs', 
    href: '/super-admin/audit-logs', 
    icon: 'fa-history',
    color: '#f59e0b'
  },
  { 
    name: 'Password Hub', 
    href: '/security/password-hub', 
    icon: 'fa-key',
    color: '#dc2626'
  },
  { 
    name: 'Account Center', 
    href: '/security/account-center', 
    icon: 'fa-user-circle',
    color: '#6366f1'
  },
  { 
    name: 'Device Manager', 
    href: '/security/device-manager', 
    icon: 'fa-laptop',
    color: '#06b6d4'
  },
  { 
    name: 'OTP Verification', 
    href: '/security/otp', 
    icon: 'fa-shield-alt',
    color: '#0d9488'
  },
  { 
    name: 'Audit Center', 
    href: '/security/audit-center', 
    icon: 'fa-clipboard-list',
    color: '#f59e0b'
  },
  { 
    name: 'Account Recovery', 
    href: '/security/recovery', 
    icon: 'fa-life-ring',
    color: '#10b981'
  },
  { 
    name: 'Settings', 
    href: '/super-admin/settings', 
    icon: 'fa-cog',
    color: '#64748b'
  },
  { 
    name: 'Academic Templates', 
    href: '/super-admin/academic-templates', 
    icon: 'fa-layer-group',
    color: '#ea6645'
  },
  { 
    name: 'Templates', 
    href: '/super-admin/templates', 
    icon: 'fa-file-alt',
    color: '#f97316'
  },
  { 
    name: 'Marketplace', 
    href: '/super-admin/marketplace', 
    icon: 'fa-store',
    color: '#8b5cf6'
  },
  { 
    name: 'Brand Presets', 
    href: '/super-admin/branding', 
    icon: 'fa-palette',
    color: '#ec4899'
  },
  { 
    name: 'Cloud Assets', 
    href: '/super-admin/assets', 
    icon: 'fa-cloud-upload-alt',
    color: '#06b6d4'
  },
  { 
    name: 'Media Library', 
    href: '/super-admin/media', 
    icon: 'fa-photo-video',
    color: '#ec4899'
  },
  { 
    name: 'Landing Mockups', 
    href: '/super-admin/landing-mockups', 
    icon: 'fa-mobile-alt',
    color: '#f97316'
  },
  { 
    name: 'Monitoring', 
    href: '/super-admin/monitoring', 
    icon: 'fa-chart-line',
    color: '#10b981'
  },
  { 
    name: 'Primary Monitoring', 
    href: '/super-admin/primary-monitoring', 
    icon: 'fa-child',
    color: '#059669'
  },
  { 
    name: 'Signatures', 
    href: '/super-admin/signatures', 
    icon: 'fa-pen',
    color: '#14b8a6'
  },
  { 
    name: 'Stamps', 
    href: '/super-admin/stamps', 
    icon: 'fa-stamp',
    color: '#ef4444'
  },
  { 
    name: 'Verifications', 
    href: '/super-admin/stamp-verifications', 
    icon: 'fa-check-circle',
    color: '#22c55e'
  },
  { 
    name: 'Profile', 
    href: '/super-admin/profile', 
    icon: 'fa-user-circle',
    color: '#ea6645'
  },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [isLoading, isSuperAdmin, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5efe8'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '18px'
          }}>
            ST
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#ea6645',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated || !isSuperAdmin) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/super-admin') {
      return pathname === '/super-admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5efe8' }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .sidebar-link:hover .nav-icon {
          transform: scale(1.1);
        }
        .sidebar-link.active {
          background: linear-gradient(135deg, rgba(234,102,69,0.1), rgba(245,158,11,0.1)) !important;
          border-left: 3px solid #ea6645 !important;
        }
        .sidebar-link.active .nav-icon {
          color: #ea6645 !important;
        }
        .sidebar-link.active .nav-text {
          color: #ea6645 !important;
          font-weight: 600 !important;
        }
      `}</style>

      {/* Mobile Header */}
      <div style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#fdfaf7',
        borderBottom: '1px solid #e8ddd0',
        padding: '0 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 50,
      }} className="mobile-header">
        <button
          onClick={() => setMobileMenuOpen(true)}
          style={{
            width: '40px',
            height: '40px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i className="fa fa-bars" style={{ fontSize: '20px', color: '#374151' }}></i>
        </button>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '18px',
          color: '#ea6645',
        }}>
          <i className="fa fa-graduation-cap"></i>
          Smart Tech
        </div>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
          backdropFilter: 'blur(4px)',
        }} onClick={() => setMobileMenuOpen(false)}>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '280px',
            background: '#fdfaf7',
            transform: 'translateX(0)',
            transition: 'transform 0.3s',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e8ddd0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                fontSize: '18px',
                color: '#ea6645',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}>
                  <i className="fa fa-graduation-cap" style={{ fontSize: '18px' }}></i>
                </div>
                Smart Tech
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  background: '#f3f4f6',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i className="fa fa-times" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
            </div>
            <div style={{ padding: '16px 12px' }}>
              {superAdminNav.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginBottom: '4px',
                    color: '#6b7280',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    borderLeft: isActive(item.href) ? '3px solid #ea6645' : '3px solid transparent',
                    background: isActive(item.href) ? 'linear-gradient(135deg, rgba(234,102,69,0.1), rgba(245,158,11,0.1))' : 'transparent',
                  }}
                >
                  <i className={`fa ${item.icon} nav-icon`} style={{ fontSize: '18px', color: item.color, transition: 'transform 0.2s' }}></i>
                  <span className="nav-text" style={{ fontSize: '14px', fontWeight: 500, color: isActive(item.href) ? '#ea6645' : '#6b7280' }}>
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: sidebarCollapsed ? '80px' : '260px',
        background: '#fdfaf7',
        borderRight: '1px solid #e8ddd0',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s',
        zIndex: 40,
      }} className="desktop-sidebar">
        {/* Logo Section */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e8ddd0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              minWidth: '40px',
              background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
            }}>
              <i className="fa fa-graduation-cap" style={{ fontSize: '20px' }}></i>
            </div>
            {!sidebarCollapsed && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: '#ea6645', whiteSpace: 'nowrap' }}>
                  Smart Tech
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                  Super Admin
                </div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                background: '#f3f4f6',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <i className="fa fa-chevron-left" style={{ fontSize: '12px', color: '#6b7280' }}></i>
            </button>
          )}
        </div>

        {/* Collapse Button when collapsed */}
        {sidebarCollapsed && (
          <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => setSidebarCollapsed(false)}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                background: '#f3f4f6',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fa fa-chevron-right" style={{ fontSize: '12px', color: '#6b7280' }}></i>
            </button>
          </div>
        )}

        {/* Navigation */}
        <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
          {!sidebarCollapsed && (
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '8px 16px',
              marginBottom: '8px',
            }}>
              Administration
            </div>
          )}
          {superAdminNav.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: sidebarCollapsed ? '12px' : '12px 16px',
                borderRadius: '10px',
                marginBottom: '4px',
                color: '#6b7280',
                textDecoration: 'none',
                transition: 'all 0.2s',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                borderLeft: isActive(item.href) ? '3px solid #ea6645' : '3px solid transparent',
                background: isActive(item.href) ? 'linear-gradient(135deg, rgba(234,102,69,0.1), rgba(245,158,11,0.1))' : 'transparent',
              }}
            >
              <i className={`fa ${item.icon} nav-icon`} style={{ fontSize: '18px', color: item.color, transition: 'transform 0.2s' }}></i>
              {!sidebarCollapsed && (
                <span className="nav-text" style={{ fontSize: '14px', fontWeight: 500, color: isActive(item.href) ? '#ea6645' : '#6b7280' }}>
                  {item.name}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* User Section */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid #e8ddd0',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: '#f5efe8',
            borderRadius: '12px',
            marginBottom: '12px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              minWidth: '40px',
              background: 'linear-gradient(135deg, #ea6645, #f59e0b)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '14px',
            }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.firstName} {user?.lastName}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Super Admin
                </div>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #e8ddd0',
              background: '#fefcf9',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#6b7280',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.borderColor = '#fecaca';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fefcf9';
              e.currentTarget.style.borderColor = '#e8ddd0';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <i className="fa fa-sign-out-alt" style={{ fontSize: '16px' }}></i>
            {!sidebarCollapsed && 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        marginLeft: sidebarCollapsed ? '80px' : '260px',
        padding: '24px',
        transition: 'margin-left 0.3s',
        minHeight: '100vh',
      }} className="main-content">
        {children}
      </div>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar {
            display: none !important;
          }
          .mobile-header {
            display: flex !important;
          }
          .main-content {
            margin-left: 0 !important;
            padding-top: 88px !important;
          }
        }
      `}</style>
    </div>
  );
}