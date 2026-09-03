'use client';

import { useCallback, useEffect, useState } from 'react';
import { stampEngineApi, stampMarketplaceApi } from '@/lib/api';

const TIER_STYLE: Record<string, string> = {
  BASIC: 'bg-gray-100 text-gray-600 border-gray-200',
  STANDARD: 'bg-sky-50 text-sky-700 border-sky-200',
  PREMIUM: 'bg-violet-50 text-violet-700 border-violet-200',
};

const CAT_COLOR: Record<string, string> = {
  CUSTOM: '#6b7280', OFFICIAL_SCHOOL: '#c0a030', EXAMINATION: '#e65100',
  CERTIFICATE: '#1565c0', VERIFICATION: '#2e7d32',
};

export default function SuperAdminStampMarketplacePage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ id: string; name: string; svg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await stampMarketplaceApi.adminEntries();
      setEntries(res.data?.entries || []);
    } catch (err: any) { setError(err?.response?.data?.message || 'Could not load marketplace'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (t: any, publish: boolean) => {
    setBusyId(t.id);
    setMessage(''); setError('');
    try {
      if (publish) {
        await stampMarketplaceApi.adminPublish(t.id, { name: t.name, minTier: t.marketplace?.minTier || 'STANDARD' });
        setMessage(`"${t.name}" published to the marketplace.`);
      } else {
        await stampMarketplaceApi.adminUnpublish(t.id);
        setMessage(`"${t.name}" unpublished.`);
      }
      void load();
    } catch (err: any) { setError(err?.response?.data?.message || 'Update failed'); }
    finally { setBusyId(null); }
  };

  const showPreview = async (configJson: any, name: string) => {
    try {
      const r = await stampEngineApi.renderPreview(configJson, []);
      setPreview({ id: name, name, svg: r.data?.svg || '' });
    } catch (err: any) { setError(err?.response?.data?.message || 'Preview failed'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stamp Marketplace</h1>
        <p className="text-sm text-gray-500 mt-1">Super-admin facts and schools have installed into their stamp libraries. Only STANDARD and PREMIUM schools can install.</p>
      </div>

      {message && <div className="text-sm px-4 py-2 rounded-lg bg-emerald-50 text-emerald-800">{message}</div>}
      {error && <div className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-700">{error}</div>}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900">{preview.name}</h3>
            <div className="mt-3 flex items-center justify-center min-h-[200px] bg-gray-50 rounded-lg">
              <div dangerouslySetInnerHTML={{ __html: preview.svg }} style={{ maxWidth: '100%' }} />
            </div>
            <button onClick={() => setPreview(null)} className="mt-4 w-full rounded-lg bg-gray-800 text-white py-2 font-semibold">Close</button>
          </div>
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Published entries</h2>
          <span className="text-xs text-gray-400">{entries.length} total</span>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">No marketplace entries yet. Design an advanced stamp and publish it from the Advanced Stamp Designer.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {entries.map(t => {
              const m = t.marketplace;
              const status = (m?.status || '—');
              const installed = t._count?.installs ?? 0;
              const color = CAT_COLOR[t.type] || '#6b7280';
              return (
                <div key={t.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 rounded-lg bg-gray-100 border flex items-center justify-center shrink-0" style={{ borderColor: color }}>
                      <span style={{ width: 34, height: 34, borderRadius: 20, border: `3px solid ${color}`, opacity: 0.9, display: 'inline-block' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{m?.name || t.name}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${TIER_STYLE[m?.minTier] || TIER_STYLE['BASIC']}`}>{m?.minTier || 'STANDARD'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">{t.type}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center justify-between">
                    <span>{installed} installed · v{t.version}</span>
                    <span className="text-gray-400">category: {m?.category || '—'}</span>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => showPreview(t.template?.configJson, m?.name || t.name)}
                      className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 font-medium hover:bg-gray-50"
                    >Preview</button>
                    {status === 'PUBLISHED'
                      ? <button onClick={() => void toggle(t, false)} disabled={busyId === t.id} className="flex-1 text-xs border border-amber-200 text-amber-700 rounded-lg px-2 py-1.5 font-medium hover:bg-amber-50 disabled:opacity-50">Unpublish</button>
                      : <button onClick={() => void toggle(t, true)} disabled={busyId === t.id} className="flex-1 text-xs border border-emerald-200 text-emerald-700 rounded-lg px-2 py-1.5 font-medium hover:bg-emerald-50 disabled:opacity-50">Publish</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
