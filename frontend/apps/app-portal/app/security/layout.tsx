'use client';

import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, ArrowLeft } from 'lucide-react';

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const pageTitles: Record<string, string> = {
    '/security/password-hub': 'Password Management Hub',
    '/security/account-center': 'Account Center',
    '/security/device-manager': 'Device & Session Manager',
    '/security/audit-center': 'Audit Center',
    '/security/recovery': 'Account Recovery',
    '/security/otp': 'OTP Verification',
  };

  const title = pageTitles[pathname] || 'Security';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-10 border-b bg-white dark:bg-gray-900 shadow-sm">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="w-px h-5 bg-border" />
          <Shield className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-sm">{title}</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
