'use client';

import { usePermissions } from '@/lib/permission-context';
import type { Permission } from '@/lib/permissions';

export function ReadOnlyBanner({ managePermission }: { managePermission: Permission }) {
  const { isReadOnly: checkReadOnly } = usePermissions();
  if (!checkReadOnly(managePermission)) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
      <span className="text-lg">🔒</span>
      <div className="flex-1">
        <span className="font-medium">Read-only mode</span>
        <span className="text-amber-600 ml-1">— You can view but not make changes.</span>
      </div>
      <a href="/dashboard/permissions" className="text-xs text-amber-700 hover:text-amber-900 font-medium underline whitespace-nowrap">
        Contact Director
      </a>
    </div>
  );
}

export function PermissionAwareLayout({ children }: { children: React.ReactNode }) {
  const { isDirector } = usePermissions();
  const { can: hasPermission } = usePermissions();

  return (
    <>
      {!isDirector && (
        <div className="sticky top-0 z-40 -mx-6 -mt-6 px-6 py-2 bg-indigo-50 border-b border-indigo-200 text-xs text-indigo-700 flex items-center gap-2">
          <span>🔒</span>
          <span>Restricted access — Some features are read-only. <a href="/dashboard/permissions" className="underline font-medium">View permissions</a></span>
        </div>
      )}
      {children}
    </>
  );
}
