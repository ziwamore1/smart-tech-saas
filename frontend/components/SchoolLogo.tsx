'use client';

import { useQuery } from '@tanstack/react-query';
import { schoolApi } from '@/lib/api';

/**
 * The provisioned school's own logo, shown next to the school name on
 * institution dashboards. Reads the shared ['school-branding'] cache so all
 * usages stay in sync. Falls back to school initials when no logo is set.
 */
export function SchoolLogo({ size = 56 }: { size?: number }) {
  const { data } = useQuery({
    queryKey: ['school-branding'],
    queryFn: async () => {
      try {
        const res = await schoolApi.getBranding();
        return res.data?.data || res.data;
      } catch {
        try {
          const res = await schoolApi.getProfile();
          return res.data?.data || res.data;
        } catch {
          return null;
        }
      }
    },
    staleTime: 60_000,
  });

  const name: string = data?.name || '';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0].toUpperCase())
      .join('') || '?';

  if (!data?.logoUrl) {
    return (
      <div
        aria-label={`${name} logo`}
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.25),
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size * 0.34),
          fontWeight: 700,
          letterSpacing: '1px',
          color: 'white',
          background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data.logoUrl}
      alt={`${name} logo`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        objectFit: 'cover',
        background: 'white',
        border: '2px solid rgba(255,255,255,0.7)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}
    />
  );
}
