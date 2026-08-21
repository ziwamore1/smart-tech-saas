import { apiService, resolveImageUrl } from './api';
import { useAuthStore } from '../store';
import type { User } from '../types';

export interface SchoolBranding {
  id?: string;
  name?: string;
  logoUrl?: string | null;
}

async function fetchBranding(): Promise<SchoolBranding | null> {
  try {
    const res = await apiService.getSchoolBranding();
    if (res && typeof res === 'object') return res as SchoolBranding;
  } catch {
    // branding endpoint unavailable — fall through to profile
  }
  try {
    const res = await apiService.getSchoolProfile();
    if (res && typeof res === 'object' && res.logoUrl) return res as SchoolBranding;
  } catch {
    // offline or unauthenticated
  }
  return null;
}

/**
 * Fetches the school's latest logo from the backend and updates the stored
 * user so every drawer/header picks it up without re-login.
 * Returns the current logo URL (or null when cleared/unknown).
 */
export async function refreshSchoolBranding(): Promise<string | null> {
  const { user, setUser } = useAuthStore.getState();
  if (!user?.schoolId) return user?.school?.logo ?? null;

  const branding = await fetchBranding();
  if (!branding) return null;

  const logo = branding.logoUrl ? resolveImageUrl(branding.logoUrl) || branding.logoUrl : null;
  const current = user.school?.logo ?? null;

  if (logo !== current) {
    setUser({
      ...user,
      school: {
        ...(user.school || { id: user.schoolId, name: '' }),
        logo,
      },
    });
  }
  return logo;
}

/** Writes a known-good logo URL into the auth store after upload/remove. */
export async function setStoredSchoolLogo(logoUrl: string | null): Promise<void> {
  const { user, setUser } = useAuthStore.getState();
  if (!user) return;

  setUser({
    ...user,
    school: {
      ...(user.school || { id: user.schoolId || '', name: '' }),
      logo: logoUrl ? resolveImageUrl(logoUrl) || logoUrl : null,
    },
  });
}

export function canManageSchoolBranding(user: User | null | undefined): boolean {
  if (!user) return false;
  const roles = [
    ...(user.roles || []),
    ...(user.platformRoles || []),
    ...(user.schoolRoles || []),
  ].map((r) => String(r).toLowerCase());
  return roles.includes('director') || roles.includes('admin');
}
