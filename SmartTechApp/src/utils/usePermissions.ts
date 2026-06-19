import { create } from 'zustand';
import { createJSONStorage } from 'zustand/middleware';
import { persist } from 'zustand/middleware';
import { mmkvStorage } from '../storage/mmkv';
import { useAuthStore } from '../store';
import { Permission, getDefaultPermissions, can, canAny, isReadOnly } from './permissions';

interface PermissionOverride {
  role: string;
  permissions: string[];
}

interface PermissionState {
  overrides: PermissionOverride[];
  setOverride: (role: string, permissions: string[]) => void;
  resetRole: (role: string) => void;
  resetAll: () => void;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      overrides: [],
      setOverride: (role, permissions) => {
        set(state => {
          const filtered = state.overrides.filter(o => o.role !== role);
          return { overrides: [...filtered, { role, permissions }] };
        });
      },
      resetRole: (role) => {
        set(state => ({ overrides: state.overrides.filter(o => o.role !== role) }));
      },
      resetAll: () => {
        set({ overrides: [] });
      },
    }),
    {
      name: 'permission-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);

export function usePermissions() {
  const user = useAuthStore(s => s.user);
  const overrides = usePermissionStore(s => s.overrides);
  const userRoles = user?.roles || [];

  const computedPermissions: Permission[] = (() => {
    const defaults = getDefaultPermissions(userRoles);
    const merged = new Set(defaults);
    for (const role of userRoles) {
      const override = overrides.find(o => o.role === role);
      if (override && override.permissions.length > 0) {
        override.permissions.forEach(p => merged.add(p as Permission));
      }
    }
    return Array.from(merged);
  })();

  const isDirector = userRoles.some(r => r === 'Director' || r === 'Deputy Director');
  const isHeadTeacher = userRoles.some(r => r === 'Head Teacher' || r === 'Deputy Head');

  return {
    permissions: computedPermissions,
    isDirector,
    isRestricted: !isDirector && (isHeadTeacher || userRoles.includes('HOD')),
    can: (required: Permission) => can(computedPermissions, required),
    canAny: (required: Permission[]) => canAny(computedPermissions, required),
    isReadOnly: (managePermission: Permission) => isReadOnly(computedPermissions, managePermission),
  };
}
