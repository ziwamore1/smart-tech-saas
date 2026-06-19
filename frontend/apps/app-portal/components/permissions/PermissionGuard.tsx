'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/lib/permission-context';
import type { Permission } from '@/lib/permissions';

export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can: hasPermission } = usePermissions();
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

export function AnyPermissionGuard({
  permissions,
  fallback = null,
  children,
}: {
  permissions: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { canAny: hasAny } = usePermissions();
  if (!hasAny(permissions)) return <>{fallback}</>;
  return <>{children}</>;
}

export function AllPermissionsGuard({
  permissions,
  fallback = null,
  children,
}: {
  permissions: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { canAll: hasAll } = usePermissions();
  if (!hasAll(permissions)) return <>{fallback}</>;
  return <>{children}</>;
}

export function ReadOnlyWrapper({
  managePermission,
  children,
  className,
}: {
  managePermission: Permission;
  children: ReactNode;
  className?: string;
}) {
  const { isReadOnly: checkReadOnly } = usePermissions();
  const readOnly = checkReadOnly(managePermission);

  return (
    <div className={`${readOnly ? 'opacity-80 pointer-events-none' : ''} ${className || ''}`}
      title={readOnly ? 'Read-only: contact Director for edit access' : undefined}
    >
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
          <span>🔒</span>
          <span>Read-only — Contact the School Director to make changes</span>
        </div>
      )}
      {children}
    </div>
  );
}

export function EditButton({
  permission,
  onClick,
  label = 'Edit',
  className,
}: {
  permission: Permission;
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  const { can: hasPermission } = usePermissions();
  if (!hasPermission(permission)) return null;
  return (
    <button onClick={onClick}
      className={`px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors ${className || ''}`}
    >
      {label}
    </button>
  );
}

export function DeleteButton({
  permission,
  onClick,
  label = 'Delete',
  className,
}: {
  permission: Permission;
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  const { can: hasPermission } = usePermissions();
  if (!hasPermission(permission)) return null;
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors ${className || ''}`}
    >
      {label}
    </button>
  );
}

export function ManageButton({
  permission,
  onClick,
  label = 'Manage',
  className,
}: {
  permission: Permission;
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  const { can: hasPermission } = usePermissions();
  if (!hasPermission(permission)) return null;
  return (
    <button onClick={onClick}
      className={`px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors ${className || ''}`}
    >
      {label}
    </button>
  );
}

export function PermissionBadge({
  permission,
  size = 'sm',
}: {
  permission: Permission;
  size?: 'sm' | 'md';
}) {
  const { can: hasPermission } = usePermissions();
  if (!hasPermission(permission)) return null;
  const isWrite = permission.endsWith('.manage') || permission.endsWith('.edit') || permission.endsWith('.create') || permission.endsWith('.approve') || permission.endsWith('.send');
  return (
    <span className={`inline-flex items-center gap-1 ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    } rounded-full font-medium ${
      isWrite ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
    }`}>
      {isWrite ? '✏️' : '👁️'} {isWrite ? 'Edit' : 'View'}
    </span>
  );
}
