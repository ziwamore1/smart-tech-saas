'use client';

import Link from 'next/link';
import Icon3D from '@/components/Icon3D';
import { useFeatureLock } from '@/lib/feature-lock-context';
import { TIER_ORDER, SubscriptionTier } from '@/types/subscription';

type Action = { name: string; href: string; icon3d: string; desc: string; featureKey?: string };
type Props = { currentTier: SubscriptionTier; actions: { BASIC: Action[]; STANDARD: Action[]; PREMIUM: Action[] } };

const tierMeta = {
  BASIC: { label: 'Core workspace', badge: 'bg-slate-100 text-slate-700', accent: '#475569' },
  STANDARD: { label: 'Growth tools', badge: 'bg-blue-100 text-blue-700', accent: '#2563eb' },
  PREMIUM: { label: 'Advanced intelligence', badge: 'bg-purple-100 text-purple-700', accent: '#7c3aed' },
} as const;

export default function TierActionGrid({ currentTier, actions }: Props) {
  const { hasAccess } = useFeatureLock();
  return <div className="space-y-6">{(['BASIC', 'STANDARD', 'PREMIUM'] as SubscriptionTier[]).map((tier) => {
    const meta = tierMeta[tier];
    return <section key={tier}><div className="mb-3 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${meta.badge}`}>{tier}</span><span className="text-sm font-semibold text-slate-800">{meta.label}</span><span className="text-xs text-slate-400">{tier === currentTier ? 'Current plan' : TIER_ORDER[tier] < TIER_ORDER[currentTier] ? 'Included' : 'Upgrade to unlock'}</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{actions[tier].map((action) => { const locked = !!action.featureKey && !hasAccess(action.featureKey); return locked ? <div key={action.name} className="relative rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-70"><span className="absolute right-3 top-3 text-xs text-slate-400">🔒</span><Icon3D name={action.icon3d} size={32} /><h3 className="mt-2 text-sm font-semibold text-slate-500">{action.name}</h3><p className="mt-1 text-xs text-slate-400">Available on {tier.toLowerCase()} plan</p></div> : <Link key={action.name} href={action.href} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><Icon3D name={action.icon3d} size={32} /><h3 className="mt-2 text-sm font-semibold text-slate-800 group-hover:text-blue-600">{action.name}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{action.desc}</p></Link>; })}</div></section>;
  })}</div>;
}
