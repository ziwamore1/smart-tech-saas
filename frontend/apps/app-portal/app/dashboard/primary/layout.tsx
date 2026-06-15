'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const primaryNavItems = [
  { name: 'Overview', href: '/dashboard/primary', icon: 'fa-th-large', color: '#059669' },
  { name: 'Students', href: '/dashboard/primary/students', icon: 'fa-user-graduate', color: '#3b82f6' },
  { name: 'Teachers', href: '/dashboard/primary/teachers', icon: 'fa-chalkboard-teacher', color: '#10b981' },
  { name: 'Classes', href: '/dashboard/primary/classes', icon: 'fa-school', color: '#8b5cf6' },
  { name: 'Subjects', href: '/dashboard/primary/subjects', icon: 'fa-book', color: '#f59e0b' },
  { name: 'Curriculum', href: '/dashboard/primary/curriculum', icon: 'fa-book-open', color: '#0891b2' },
  { name: 'ECE Module', href: '/dashboard/primary/ece', icon: 'fa-baby', color: '#ec4899' },
  { name: 'Grade 7 ECZ', href: '/dashboard/primary/grade7', icon: 'fa-graduation-cap', color: '#7c3aed' },
  { name: 'Library', href: '/dashboard/library', icon: 'fa-book-open', color: '#0d9488' },
  { name: 'Gallery', href: '/dashboard/gallery', icon: 'fa-images', color: '#db2777' },
  { name: 'Settings', href: '/dashboard/settings', icon: 'fa-cog', color: '#64748b' },
];

export default function PrimaryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="flex overflow-x-auto gap-1 px-1">
          {primaryNavItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard/primary' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  active
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className={`fas ${item.icon}`} style={{ color: active ? item.color : undefined, fontSize: '14px' }} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
