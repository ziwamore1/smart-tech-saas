'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState('');
  const { user, logout } = useAuth();

  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [pathname]);

  const navItems = [
    { href: '/dashboard/teacher-view', label: 'My Dashboard', icon: '🏠' },
    { href: '/teacher/class', label: 'My Class', icon: '👥' },
    { href: '/teacher/enrollments', label: 'Enrollments', icon: '📝' },
    { href: '/dashboard/results', label: 'Results', icon: '📊' },
    { href: '/teacher/communications', label: 'Communications', icon: '💬' },
    { href: '/teacher/profile', label: 'Account Profile', icon: '👤' },
    { href: '/teacher/profile#advanced-staff-profile', label: 'Advanced Staff Profile', icon: '🪪' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-6 min-w-0">
              <Link href="/teacher" className="text-xl font-bold text-blue-600 shrink-0">
                Smart Tech
              </Link>
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href.split('#')[0] && (!item.href.includes('#') || activeHash === item.href.slice(item.href.indexOf('#')) ) ? 'page' : undefined}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                      pathname === item.href.split('#')[0] && (!item.href.includes('#') || activeHash === item.href.slice(item.href.indexOf('#')))
                        ? 'bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-200'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-blue-700'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">Teacher</p>
              </div>
              <button
                onClick={logout}
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg border border-red-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
        <div className="md:hidden px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href.split('#')[0] && (!item.href.includes('#') || activeHash === item.href.slice(item.href.indexOf('#')) ) ? 'page' : undefined}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all active:scale-95 ${
                  pathname === item.href.split('#')[0] && (!item.href.includes('#') || activeHash === item.href.slice(item.href.indexOf('#')))
                    ? 'bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-200'
                    : 'text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
