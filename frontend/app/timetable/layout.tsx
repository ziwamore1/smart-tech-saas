'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { schoolApi } from '@/lib/api';

const timetableNav = [
  { name: 'Master Timetable', href: '/timetable/master', icon: 'fa-th-large' },
  { name: 'Class View', href: '/timetable/class', icon: 'fa-school' },
  { name: 'Teacher View', href: '/timetable/teacher', icon: 'fa-chalkboard-teacher' },
  { name: 'Room View', href: '/timetable/room', icon: 'fa-door-open' },
  { name: 'Constraints', href: '/timetable/constraints', icon: 'fa-sliders-h' },
];

const viewNav = [
  { name: 'View Timetable (EduPage)', href: '/view-timetable', icon: 'fa-eye' },
  { name: 'Public Timetable', href: '/public-timetable', icon: 'fa-globe' },
];

export default function TimetableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const getSchoolId = (): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user?.schoolId || null;
      }
    } catch {}
    return null;
  };

  const { data: schoolData } = useQuery({
    queryKey: ['school-layout'],
    queryFn: async () => {
      const schoolId = getSchoolId();
      if (!schoolId) return null;
      try {
        const res = await schoolApi.getProfile(schoolId);
        const outerData = res.data?.data || res.data;
        const school = outerData || null;
        return school;
      } catch (e) {
        return null;
      }
    },
    retry: false,
    enabled: !!getSchoolId(),
  });

  const school = schoolData;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-800 text-white fixed h-full flex flex-col">
          {/* Logo/Header */}
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                ST
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Smart Tech SaaS</h1>
                <p className="text-xs text-slate-400">Timetable Manager</p>
              </div>
            </div>
          </div>

          {/* School Name */}
          {school?.name && (
            <div className="px-6 py-3 bg-slate-700/50 border-b border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wide">School</p>
              <p className="text-sm font-medium text-white truncate">{school.name}</p>
            </div>
          )}
          
          {/* Navigation */}
          <nav className="flex-1 p-4">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Navigation
            </p>
            {timetableNav.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/timetable/master' && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all ${
                    isActive
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <i className={`fa ${item.icon} w-5`}></i>
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}

            {/* View Timetable Section */}
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                View Timetables
              </p>
              {viewNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all ${
                      isActive
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <i className={`fa ${item.icon} w-5`}></i>
                    <span className="text-sm font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Quick Links */}
          <div className="p-4 border-t border-slate-700">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            >
              <i className="fa fa-arrow-left w-5"></i>
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
          </div>

          {/* User Section */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                <i className="fa fa-user text-slate-300 text-sm"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">User</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 min-h-screen">
          {/* Top Bar */}
          <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => window.history.back()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <i className="fa fa-arrow-left text-gray-600"></i>
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {timetableNav.find(item => pathname === item.href)?.name || 'Timetable'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <i className="fa fa-bell text-gray-600"></i>
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <i className="fa fa-cog text-gray-600"></i>
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
