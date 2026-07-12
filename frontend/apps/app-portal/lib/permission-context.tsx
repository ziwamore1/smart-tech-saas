'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import {
  Permission,
  getDefaultPermissions,
  getMergedRoles,
  can,
  canAny,
  canAll,
  isReadOnly,
  STORAGE_KEY,
  ALL_PERMISSIONS,
} from './permissions';

interface PermissionOverride {
  role: string;
  permissions: string[];
}

interface PermissionContextType {
  permissions: Permission[];
  isLoading: boolean;
  can: (required: Permission) => boolean;
  canAny: (required: Permission[]) => boolean;
  canAll: (required: Permission[]) => boolean;
  isReadOnly: (managePermission: Permission) => boolean;
  isDirector: boolean;
  getOverrides: () => PermissionOverride[];
  setOverride: (role: string, permissions: string[]) => void;
  resetRole: (role: string) => void;
  resetAll: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

async function fetchOverrides(): Promise<PermissionOverride[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveOverrides(overrides: PermissionOverride[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

function applyOverrides(
  defaults: Permission[],
  role: string,
  overrides: PermissionOverride[],
): Permission[] {
  const override = overrides.find(o => o.role === role);
  if (!override) return defaults;
  const allowed = override.permissions.filter(p => ALL_PERMISSIONS.includes(p as Permission)) as Permission[];
  if (allowed.length === 0) return defaults;
  return allowed;
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userRoles = getMergedRoles({
    roles: user?.roles || [],
    platformRoles: user?.platformRoles,
    schoolRoles: user?.schoolRoles,
  });
  const isDirector = userRoles.includes('Director') || userRoles.includes('SuperAdmin');

  const computedPermissions: Permission[] = (() => {
    const defaults = getDefaultPermissions(userRoles);
    let merged = new Set(defaults);
    for (const role of userRoles) {
      const overridden = applyOverrides([], role, overrides);
      if (overridden.length > 0) {
        merged = new Set([...merged, ...overridden]);
      }
    }
    return Array.from(merged);
  })();

  useEffect(() => {
    fetchOverrides().then(o => {
      setOverrides(o);
      setIsLoading(false);
    });
  }, []);

  const getOverrides = useCallback((): PermissionOverride[] => {
    return overrides;
  }, [overrides]);

  const setOverride = useCallback((role: string, permissions: string[]) => {
    setOverrides(prev => {
      const filtered = prev.filter(o => o.role !== role);
      const next = [...filtered, { role, permissions }];
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetRole = useCallback((role: string) => {
    setOverrides(prev => {
      const next = prev.filter(o => o.role !== role);
      saveOverrides(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverrides([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: PermissionContextType = {
    permissions: computedPermissions,
    isLoading,
    can: (required: Permission) => can(computedPermissions, required),
    canAny: (required: Permission[]) => canAny(computedPermissions, required),
    canAll: (required: Permission[]) => canAll(computedPermissions, required),
    isReadOnly: (managePermission: Permission) => isReadOnly(computedPermissions, managePermission),
    isDirector,
    getOverrides,
    setOverride,
    resetRole,
    resetAll,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions must be used within a PermissionProvider');
  return ctx;
}
