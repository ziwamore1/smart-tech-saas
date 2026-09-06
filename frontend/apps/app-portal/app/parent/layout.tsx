'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { schoolApi, messagesApi, notificationsApi } from '@/lib/api';

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { data: school } = useQuery({
    queryKey: ['school-current-layout'],
    queryFn: () => schoolApi.getCurrentSchool().then(r => r.data),
    retry: false,
  });

  const { data: unreadMsgs } = useQuery({
    queryKey: ['msgs-unread-layout'],
    queryFn: () => messagesApi.getUnreadCount().then(r => r.data?.unreadCount ?? 0),
    retry: false,
    refetchInterval: 20000,
  });

  const { data: unreadNotifs } = useQuery({
    queryKey: ['notifs-unread-layout'],
    queryFn: () => notificationsApi.getUnreadCount().then(r => r.data?.count ?? 0),
    retry: false,
    refetchInterval: 20000,
  });

  const institutionType = school?.institutionType?.name || school?.institutionType?.code || null;

  const navItems = [
    { href: '/parent', label: 'Dashboard', icon: '🏠' },
    { href: '/parent/results', label: "Results", icon: '📝' },
    { href: '/parent/homework', label: "Homework", icon: '📚' },
    { href: '/parent/report-cards', label: "Report Cards", icon: '📄' },
    { href: '/parent/assessments', label: "Assessments", icon: '📊' },
    { href: '/parent/attendance', label: "Attendance", icon: '✅' },
    { href: '/parent/analytics', label: "Analytics", icon: '📈' },
    { href: '/parent/ai-tutor', label: 'AI Tutor', icon: '🤖' },
    { href: '/parent/messages', label: "Messages", icon: '💬', badge: unreadMsgs || 0 },
    { href: '/parent/notifications', label: "Notifications", icon: '🔔', badge: unreadNotifs || 0 },
    { href: '/parent/profile', label: 'Profile', icon: '👤' },
  ];

  const isActive = (href: string) => pathname === href || (href !== '/parent' && pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link href="/parent" className="shrink-0">
                <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Smart Tech
                </span>
                {institutionType && (
                  <span className="block text-[10px] font-medium text-gray-400 -mt-0.5">{school?.name || institutionType}</span>
                )}
              </Link>
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                    {(item as any).badge ? (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold align-middle">
                        {(item as any).badge}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">Parent · {school?.name || 'School'}</p>
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
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 bg-gray-50'
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
                {(item as any).badge ? (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                    {(item as any).badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}