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
  const [activeProfileSection, setActiveProfileSection] = useState<'account' | 'advanced'>('account');
  const { user, logout, allRoles } = useAuth();
  const directorRoles = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Principal'];
  const normalizeRole = (role: string) => role.toLowerCase().replace(/[^a-z]/g, '');
  const roleCandidates = [...(user?.schoolRoles || []), ...(allRoles || [])];
  const isSchoolAdministrator = roleCandidates.some(role => ['Director', 'Deputy Director', 'Principal'].some(adminRole => normalizeRole(role) === normalizeRole(adminRole)));
  const roleLabel = directorRoles.find(expected => roleCandidates.some(role => normalizeRole(role) === normalizeRole(expected)))
    || user?.schoolRoles?.[0]
    || allRoles?.[0]
    || 'Staff';

  useEffect(() => {
    const syncProfileSection = () => {
      setActiveProfileSection(new URLSearchParams(window.location.search).get('section') === 'advanced' ? 'advanced' : 'account');
    };
    syncProfileSection();
    window.addEventListener('popstate', syncProfileSection);
    return () => window.removeEventListener('popstate', syncProfileSection);
  }, [pathname]);

  const teacherNavItems = [
    { href: '/dashboard/teacher-view', label: 'My Dashboard', icon: '🏠' },
    { href: '/teacher/class', label: 'My Class', icon: '👥' },
    { href: '/teacher/enrollments', label: 'Enrollments', icon: '📝' },
    { href: '/dashboard/results', label: 'Results', icon: '📊' },
    { href: '/teacher/communications', label: 'Communications', icon: '💬' },
    { href: '/teacher/profile', label: 'Account Profile', icon: '👤' },
    { href: '/teacher/profile?section=advanced', label: 'Advanced Staff Profile', icon: '🪪' },
  ];
  const adminNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/dashboard/staff-records', label: 'Staff Returns Hub', icon: '📋' },
    { href: '/teacher/profile', label: 'Account Profile', icon: '👤' },
    { href: '/teacher/profile?section=advanced', label: 'Advanced Staff Profile', icon: '🪪' },
  ];
  const navItems = isSchoolAdministrator ? adminNavItems : teacherNavItems;
  const isActive = (href: string) => {
    const [itemPath, query] = href.split('?');
    if (pathname !== itemPath) return false;
    if (query?.includes('section=advanced')) return activeProfileSection === 'advanced';
    if (itemPath === '/teacher/profile') return activeProfileSection === 'account';
    return true;
  };

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
                    onClick={() => { if (item.href.startsWith('/teacher/profile')) setActiveProfileSection(item.href.includes('section=advanced') ? 'advanced' : 'account'); }}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      isActive(item.href)
                        ? 'bg-indigo-100 text-indigo-800 shadow-sm ring-1 ring-indigo-300'
                        : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-800'
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
                <p className="text-xs text-gray-500">{roleLabel}</p>
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
                onClick={() => { if (item.href.startsWith('/teacher/profile')) setActiveProfileSection(item.href.includes('section=advanced') ? 'advanced' : 'account'); }}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  isActive(item.href)
                    ? 'bg-indigo-100 text-indigo-800 shadow-sm ring-1 ring-indigo-300'
                    : 'text-gray-600 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-800'
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
