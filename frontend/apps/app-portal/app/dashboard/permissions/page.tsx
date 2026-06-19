'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/permission-context';
import {
  PERMISSION_CATEGORIES,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  isRoleKey,
  type Permission,
} from '@/lib/permissions';
import { useAuth } from '@/lib/auth-context';

const MANAGED_ROLES = ['Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher'] as const;

export default function PermissionsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { isDirector, getOverrides, setOverride, resetRole, resetAll, permissions: myPermissions } = usePermissions();
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<string>('Head Teacher');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const overrides = getOverrides();
  const currentOverride = overrides.find(o => o.role === selectedRole);
  const defaults = isRoleKey(selectedRole) ? DEFAULT_ROLE_PERMISSIONS[selectedRole] : ALL_PERMISSIONS;

  // Compute effective permissions: use override if exists, else defaults
  const effectivePermissions =
    currentOverride && currentOverride.permissions.length > 0
      ? currentOverride.permissions.filter(p => ALL_PERMISSIONS.includes(p as Permission)) as Permission[]
      : defaults;

  const effectiveSet = new Set(effectivePermissions);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push('/login?redirect=/dashboard/permissions');
    return null;
  }

  if (!isDirector) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <h2 className="text-lg font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600 text-sm">Only the School Director can manage role permissions.</p>
          <a href="/dashboard" className="inline-block mt-4 text-indigo-600 hover:text-indigo-800 font-medium text-sm">← Back to Dashboard</a>
        </div>
      </div>
    );
  }

  const togglePermission = (perm: Permission) => {
    const current = currentOverride?.permissions
      ? currentOverride.permissions.filter(p => ALL_PERMISSIONS.includes(p as Permission)) as Permission[]
      : [...defaults];

    const idx = current.indexOf(perm);
    let next: Permission[];
    if (idx >= 0) {
      next = current.filter(p => p !== perm);
    } else {
      next = [...current, perm];
    }
    setOverride(selectedRole, next);
  };

  const handleResetRole = () => {
    resetRole(selectedRole);
    setMessage({ type: 'success', text: `Reset "${selectedRole}" to default permissions.` });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleResetAll = () => {
    if (confirm('Reset all role permissions to defaults? This cannot be undone.')) {
      resetAll();
      setMessage({ type: 'success', text: 'All roles reset to default permissions.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'Head Teacher': return 'Head Teacher';
      case 'Deputy Head': return 'Deputy Head Teacher';
      case 'HOD': return 'Head of Department (HOD)';
      case 'Teacher': return 'Teacher';
      case 'Class Teacher': return 'Class Teacher';
      default: return role;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Permissions</h1>
          <p className="text-gray-500 mt-1">
            Control what each role can do. Changes take effect immediately.
            {!isDirector && <span className="text-amber-600 font-medium"> — Only Directors can edit permissions.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResetAll} className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium">
            Reset All to Default
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-0.5 mb-6 bg-gray-100 rounded-lg p-1 flex-wrap">
        {MANAGED_ROLES.map((role) => {
          const hasOverride = overrides.some(o => o.role === role);
          return (
            <button key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedRole === role
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              } ${hasOverride ? 'ring-2 ring-amber-400 ring-inset' : ''}`}
            >
              {getRoleLabel(role)}
              {hasOverride && <span className="ml-1.5 text-amber-500">●</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Category Filter */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-24">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Permission Areas</h3>
            <div className="space-y-1">
              {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => {
                const anyGranted = cat.permissions.some(p => effectiveSet.has(p));
                const allGranted = cat.permissions.every(p => effectiveSet.has(p));
                return (
                  <a key={key} href={`#cat-${key}`}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      allGranted ? 'bg-green-50 text-green-700' : anyGranted ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      allGranted ? 'bg-green-100 text-green-700' : anyGranted ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {cat.permissions.filter(p => effectiveSet.has(p)).length}/{cat.permissions.length}
                    </span>
                  </a>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-400 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-green-500" />
                  <span>Granted ({effectivePermissions.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-gray-200" />
                  <span>Not granted ({ALL_PERMISSIONS.length - effectivePermissions.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 text-xs">●</span>
                  <span>Tab shows custom override</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main: Permission Toggles */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{getRoleLabel(selectedRole)}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {currentOverride
                    ? `${effectivePermissions.length} of ${ALL_PERMISSIONS.length} permissions (customized)`
                    : `${effectivePermissions.length} of ${ALL_PERMISSIONS.length} permissions (defaults)`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  // Grant all
                  setOverride(selectedRole, [...ALL_PERMISSIONS]);
                  setMessage({ type: 'success', text: `All permissions granted for "${selectedRole}".` });
                  setTimeout(() => setMessage(null), 3000);
                }} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100">
                  Grant All
                </button>
                <button onClick={() => {
                  // Revoke all non-default
                  setOverride(selectedRole, ALL_PERMISSIONS.filter(p => p.endsWith('.view') || p === 'analytics.view'));
                  setMessage({ type: 'success', text: `View-only permissions set for "${selectedRole}".` });
                  setTimeout(() => setMessage(null), 3000);
                }} className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-100">
                  View Only
                </button>
                <button onClick={handleResetRole} className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100">
                  Reset to Default
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => {
                const catGranted = cat.permissions.filter(p => effectiveSet.has(p)).length;
                const catTotal = cat.permissions.length;
                return (
                  <div key={key} id={`cat-${key}`} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 text-sm">{cat.label}</h3>
                      <span className="text-xs text-gray-400">{catGranted}/{catTotal}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.permissions.map((perm) => {
                        const granted = effectiveSet.has(perm);
                        const isWrite = perm.endsWith('.manage') || perm.endsWith('.edit') || perm.endsWith('.create') || perm.endsWith('.approve') || perm.endsWith('.send');
                        return (
                          <label key={perm}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                              granted
                                ? isWrite ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={granted}
                              onChange={() => togglePermission(perm)}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">
                                {perm.split('.').pop()}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">{perm}</p>
                            </div>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              granted
                                ? isWrite ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                : 'bg-gray-200 text-gray-500'
                            }`}>
                              {granted ? (isWrite ? 'Edit' : 'View') : '—'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-500" />
                <span>View permission (read-only)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500" />
                <span>Edit/Manage permission (write)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-gray-300" />
                <span>Not granted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-500">●</span>
                <span>Role tab with custom override</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
