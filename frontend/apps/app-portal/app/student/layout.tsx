'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { href: '/student', label: 'Dashboard', icon: '🏠' },
    { href: '/student/results', label: 'Results', icon: '📝' },
    { href: '/student/exams', label: 'Exams', icon: '📋' },
    { href: '/student/homework', label: 'Homework', icon: '📚' },
    { href: '/student/report-cards', label: 'Report Cards', icon: '📄' },
    { href: '/student/assessments', label: 'Assessments', icon: '📊' },
    { href: '/student/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-6 min-w-0">
              <Link href="/student" className="text-xl font-bold text-blue-600 shrink-0">
                Smart Tech
              </Link>
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
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
                <p className="text-xs text-gray-500">Student</p>
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
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  pathname === item.href
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 bg-gray-50'
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
