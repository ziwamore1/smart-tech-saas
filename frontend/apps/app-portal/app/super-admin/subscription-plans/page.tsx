'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { pricingApi } from '@/lib/api';

type SchoolType = 'SECONDARY' | 'PRIMARY';
type Tier = 'BASIC' | 'STANDARD' | 'PREMIUM';
type Interval = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

interface PricingRow {
  id: string;
  schoolType: SchoolType;
  tier: Tier;
  interval: Interval;
  priceUsd: number;
  priceZwK: number;
  features: string[];
  isActive: boolean;
}

const TIERS: Tier[] = ['BASIC', 'STANDARD', 'PREMIUM'];
const INTERVALS: Interval[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];
const INTERVAL_LABELS: Record<Interval, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
};

const TIER_META: Record<Tier, { label: string; icon: string; color: string }> = {
  BASIC: { label: 'Basic', icon: 'fa-seedling', color: '#6b7280' },
  STANDARD: { label: 'Standard', icon: 'fa-star', color: '#2563eb' },
  PREMIUM: { label: 'Premium', icon: 'fa-gem', color: '#9333ea' },
};

const TIER_COLORS: Record<Tier, { bg: string; text: string; border: string }> = {
  BASIC: { bg: '#f3f4f6', text: '#6b7280', border: '#e8ddd0' },
  STANDARD: { bg: '#dbeafe', text: '#2563eb', border: '#bfdbfe' },
  PREMIUM: { bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff' },
};

function cellKey(schoolType: SchoolType, tier: Tier, interval: Interval) {
  return `${schoolType}:${tier}:${interval}`;
}

export default function SubscriptionPlansPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [schoolType, setSchoolType] = useState<SchoolType>('SECONDARY');
  const [drafts, setDrafts] = useState<Record<string, { priceUsd: string; priceZwK: string }>>({});
  const [featuresDraft, setFeaturesDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await pricingApi.list();
      const data = response.data?.data || response.data;
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load pricing:', error);
      setMessage({ type: 'error', text: 'Failed to load pricing. Check that the backend is running.' });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const rowFor = (tier: Tier, interval: Interval) =>
    rows.find((r) => r.schoolType === schoolType && r.tier === tier && r.interval === interval);

  const handleSaveAll = async () => {
    const changed = new Set<string>();
    const updates: Promise<unknown>[] = [];

    for (const row of rows) {
      if (row.schoolType !== schoolType) continue;
      const key = cellKey(row.schoolType, row.tier, row.interval);
      const draft = drafts[key];
      const nextUsd = draft ? parseFloat(draft.priceUsd) : row.priceUsd;
      const nextZwK = draft ? parseFloat(draft.priceZwK) : row.priceZwK;
      const featuresRaw = featuresDraft[key];
      const nextFeatures = featuresRaw !== undefined ? featuresRaw.split('\n').map((f) => f.trim()).filter(Boolean) : row.features;

      if (
        draft &&
        (isNaN(nextUsd) ? row.priceUsd !== nextUsd : nextUsd !== row.priceUsd || (draft.priceUsd !== '' && Number(draft.priceUsd) !== row.priceUsd)) ||
        (draft && (isNaN(nextZwK) ? false : nextZwK !== row.priceZwK || (draft.priceZwK !== '' && Number(draft.priceZwK) !== row.priceZwK))) ||
        (featuresRaw !== undefined && JSON.stringify(nextFeatures) !== JSON.stringify(row.features))
      ) {
        changed.add(row.id);
      }
    }

    if (changed.size === 0) {
      setMessage({ type: 'success', text: 'No changes to save.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      setSaving(true);
      for (const row of rows) {
        if (!changed.has(row.id)) continue;
        const key = cellKey(row.schoolType, row.tier, row.interval);
        const draft = drafts[key];
        const featuresRaw = featuresDraft[key];
        updates.push(
          pricingApi.update(row.id, {
            priceUsd: draft ? Math.max(0, Number(draft.priceUsd) || 0) : row.priceUsd,
            priceZwK: draft ? Math.max(0, Number(draft.priceZwK) || 0) : row.priceZwK,
            features: featuresRaw !== undefined ? featuresRaw.split('\n').map((f) => f.trim()).filter(Boolean) : row.features,
          })
        );
      }
      await Promise.all(updates);
      await loadPlans();
      setDrafts((prev) => {
        const next = { ...prev };
        changed.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setFeaturesDraft({});
      setMessage({ type: 'success', text: 'Pricing saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save pricing:', error);
      setMessage({ type: 'error', text: 'Failed to save pricing' });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleLoadDefaults = async () => {
    try {
      setSaving(true);
      const response = await pricingApi.seed();
      setMessage({ type: 'success', text: `Default matrix loaded (${response.data?.created || response.data?.data?.created || 0} created, total ${response.data?.total || response.data?.data?.total || 0}).` });
      setTimeout(() => setMessage(null), 4000);
      await loadPlans();
    } catch (error) {
      console.error('Failed to load defaults:', error);
      setMessage({ type: 'error', text: 'Failed to load default pricing' });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    try {
      setSaving(true);
      await pricingApi.update(rowId, { isActive: !row.isActive });
      setRows(rows.map((r) => (r.id === rowId ? { ...r, isActive: !r.isActive } : r)));
      setMessage({ type: 'success', text: `Cell ${row.isActive ? 'deactivated' : 'activated'}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to toggle cell:', error);
      setMessage({ type: 'error', text: 'Failed to toggle cell' });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5efe8',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 700,
            fontSize: '18px',
          }}>
            <i className="fa fa-credit-card"></i>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#0d9488',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}></div>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const missingCells = TIERS.length * INTERVALS.length - rows.filter((r) => r.schoolType === schoolType).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <i className="fa fa-credit-card" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Subscription Plans
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>
            Configure pricing for Secondary &amp; Primary schools (USD$ / ZWK)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleLoadDefaults}
            disabled={saving}
            style={{
              padding: '12px 20px',
              background: '#fefcf9',
              border: '1px solid #d1d5db',
              borderRadius: '10px',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            <i className="fa fa-download" style={{ fontSize: '12px', marginRight: '6px' }}></i>
            Load Defaults
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #0d9488, #0f766e)',
              borderRadius: '10px',
              border: 'none',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            <i className="fa fa-save" style={{ fontSize: '12px', marginRight: '6px' }}></i>
            Save All
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: message.type === 'success' ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          <i className={`fa ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {message.text}
        </div>
      )}

      {/* School type tabs */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {(['SECONDARY', 'PRIMARY'] as SchoolType[]).map((st) => (
          <button
            key={st}
            onClick={() => setSchoolType(st)}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              border: schoolType === st ? '2px solid #0d9488' : '1px solid #d1d5db',
              background: schoolType === st ? '#f0fdfa' : '#fefcf9',
              color: schoolType === st ? '#0f766e' : '#374151',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <i className={`fa ${st === 'SECONDARY' ? 'fa-school' : 'fa-user-graduate'}`} style={{ fontSize: '13px', marginRight: '8px' }}></i>
            {st === 'SECONDARY' ? 'Secondary Schools' : 'Primary Schools'}
          </button>
        ))}
      </div>

      {missingCells > 0 && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: '#fef3c7',
          color: '#92400e',
          fontSize: '14px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <i className="fa fa-info-circle"></i>
          {missingCells} pricing cell(s) missing for {schoolType === 'SECONDARY' ? 'Secondary' : 'Primary'} schools. Click “Load Defaults” to seed the full matrix.
        </div>
      )}

      {/* Matrix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {TIERS.map((tier) => {
          const color = TIER_COLORS[tier];
          const tierRows = INTERVALS.map((interval) => rowFor(tier, interval));
          const activeCount = tierRows.filter((r) => r?.isActive).length;
          return (
            <div key={tier} style={{
              background: '#fefcf9',
              borderRadius: '16px',
              border: tier === 'PREMIUM' ? '1.5px solid #e9d5ff' : '1px solid #e8ddd0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <div style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: color.bg,
                borderBottom: '1px solid #f3f4f6',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <i className={`fa ${TIER_META[tier].icon}`} style={{ fontSize: '16px', color: color.text }}></i>
                  <span style={{ fontSize: '17px', fontWeight: 700, color: '#1f2937' }}>{TIER_META[tier].label}</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#4ade80',
                    opacity: activeCount === INTERVALS.length ? 1 : 0.4,
                  }}>
                    {activeCount}/{INTERVALS.length} active
                  </span>
                </div>
              </div>

              <div style={{ padding: '16px 20px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                }}>
                  {INTERVALS.map((interval, i) => {
                    const row = tierRows[i];
                    const key = cellKey(schoolType, tier, interval);
                    const draft = drafts[key] || { priceUsd: row ? String(row.priceUsd) : '', priceZwK: row ? String(row.priceZwK) : '' };
                    const hasDraft = !!drafts[key];
                    return (
                      <div key={interval} style={{
                        padding: '14px',
                        borderRadius: '12px',
                        border: hasDraft ? '1.5px solid #0d9488' : '1px solid #f3f4f6',
                        background: '#fafaf7',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280' }}>
                            {INTERVAL_LABELS[interval]}
                          </span>
                          {row ? (
                            <button
                              onClick={() => toggleActive(row.id)}
                              disabled={saving}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                border: 'none',
                                background: row.isActive ? '#d1fae5' : '#fee2e2',
                                color: row.isActive ? '#059669' : '#dc2626',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '11px',
                              }}
                              title={row.isActive ? 'Active - click to deactivate' : 'Inactive - click to activate'}
                            >
                              <i className={`fa ${row.isActive ? 'fa-check' : 'fa-ban'}`}></i>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b' }}>
                              <i className="fa fa-hourglass-half" style={{ marginRight: '4px' }}></i>
                              Not set
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', minWidth: '52px' }}>USD$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.priceUsd}
                              onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], priceUsd: e.target.value } }))}
                              placeholder="0.00"
                              style={{
                                flex: 1,
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#1f2937',
                                outline: 'none',
                                background: '#fff',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#7c3aed', minWidth: '52px' }}>ZWK</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.priceZwK}
                              onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], priceZwK: e.target.value } }))}
                              placeholder="0.00"
                              style={{
                                flex: 1,
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#1f2937',
                                outline: 'none',
                                background: '#fff',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Features */}
                <div style={{ marginTop: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>
                    Features (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={featuresDraft[tier] ?? (rowFor(tier, 'MONTHLY')?.features || []).join('\n')}
                    onChange={(e) => setFeaturesDraft((prev) => ({ ...prev, [tier]: e.target.value }))}
                    placeholder={'List features for this tier, one per line'}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: featuresDraft[tier] !== undefined ? '1.5px solid #0d9488' : '1px solid #d1d5db',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'vertical',
                      background: '#fff',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      onClick={() => {
                        const f = (rowFor(tier, 'MONTHLY')?.features || []).join('\n');
                        setFeaturesDraft((prev) => {
                          const next = { ...prev };
                          delete next[tier];
                          return next;
                        });
                        void f;
                      }}
                      style={{
                        padding: '8px 14px',
                        background: '#f3f4f6',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#374151',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const raw = featuresDraft[tier] ?? (rowFor(tier, 'MONTHLY')?.features || []).join('\n');
                        const features = raw.split('\n').map((x) => x.trim()).filter(Boolean);
                        const targets = tierRows.filter((r) => r);
                        if (targets.length === 0) {
                          setMessage({ type: 'error', text: `No rows exist for ${tier} yet. Load defaults first.` });
                          setTimeout(() => setMessage(null), 4000);
                          return;
                        }
                        setSaving(true);
                        Promise.all(targets.map((r) => pricingApi.update(r!.id, { features })))
                          .then(async () => {
                            await loadPlans();
                            setFeaturesDraft((prev) => {
                              const next = { ...prev };
                              delete next[tier];
                              return next;
                            });
                            setMessage({ type: 'success', text: `Features saved for ${TIER_META[tier].label}.` });
                            setTimeout(() => setMessage(null), 3000);
                          })
                          .catch((err) => {
                            console.error('Failed to save features:', err);
                            setMessage({ type: 'error', text: 'Failed to save features' });
                            setTimeout(() => setMessage(null), 4000);
                          })
                          .finally(() => setSaving(false));
                      }}
                      style={{
                        padding: '8px 14px',
                        background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                        borderRadius: '8px',
                        border: 'none',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Save features
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deleted/missing warning */}
      <div style={{ fontSize: '13px', color: '#9ca3af' }}>
        Changes are local until you click <b>Save All</b>. Amounts are shown in USD$ and ZWK (Zambian Kwacha).
      </div>
    </div>
  );
}