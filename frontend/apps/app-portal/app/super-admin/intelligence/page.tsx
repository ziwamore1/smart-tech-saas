'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi, featureLockApi, intelligenceApi } from '@/lib/api';
import RadarChart from '@/components/charts-echarts/RadarChart';
import ComparisonChart from '@/components/charts-echarts/ComparisonChart';
import RankingTable from '@/components/charts-echarts/RankingTable';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradAmber = 'linear-gradient(135deg, #f59e0b, #d97706)';
const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradPink = 'linear-gradient(135deg, #ec4899, #db2777)';

export default function SuperAdminIntelligencePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'adoption' | 'schools'>('overview');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      const [statsRes, featuresRes] = await Promise.allSettled([
        superAdminApi.getStats(),
        featureLockApi.getFeatures(),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.data || statsRes.value.data);
      if (featuresRes.status === 'fulfilled') {
        const data = featuresRes.value.data?.data ?? featuresRes.value.data;
        setFeatures(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Failed to load intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const intelligenceFeatures = features.filter((f: any) =>
    f.key?.startsWith('intelligence.') || f.key === 'analytics.enhanced' || f.key === 'analytics.advanced'
  );

  const lockedCount = intelligenceFeatures.filter((f: any) => f.isLocked).length;
  const unlockedCount = intelligenceFeatures.filter((f: any) => !f.isLocked).length;

  const adoptionData = intelligenceFeatures.map((f: any) => ({
    name: f.name,
    value: f.isLocked ? 0 : 100,
    change: (f.isLocked ? 'down' : 'up') as 'up' | 'down',
    secondaryValue: f.tier,
  }));

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradTeal, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-brain"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#14b8a6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const tabs: { key: typeof activeTab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
    { key: 'adoption', label: 'Feature Adoption', icon: 'fa-rocket' },
    { key: 'schools', label: 'School Rankings', icon: 'fa-trophy' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .tab-btn { transition: all 0.2s ease; cursor: pointer; }
        .tab-btn.active { background: linear-gradient(135deg, #14b8a6, #0d9488) !important; color: white !important; box-shadow: 0 4px 12px rgba(20,184,166,0.3); }
        .stat-card { transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradTeal, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-brain" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Intelligence Overview
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Cross-school analytics and feature adoption metrics</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '48px', height: '48px', background: gradTeal, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <i className="fa fa-microchip" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Intelligence Modules</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{intelligenceFeatures.length}</p>
        </div>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '48px', height: '48px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <i className="fa fa-unlock" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Unlocked Features</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#059669', margin: 0 }}>{unlockedCount}</p>
        </div>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '48px', height: '48px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <i className="fa fa-lock" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Locked (Premium)</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#ea6645', margin: 0 }}>{lockedCount}</p>
        </div>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '48px', height: '48px', background: gradBlue, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <i className="fa fa-school" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Total Schools</p>
          <p style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalSchools || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            style={{
              padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              border: 'none', background: activeTab === tab.key ? '#14b8a6' : '#f3f4f6',
              color: activeTab === tab.key ? 'white' : '#6b7280',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <i className={`fa ${tab.icon}`} style={{ fontSize: '14px' }}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* Feature Lock Status */}
            <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa fa-lock" style={{ color: '#14b8a6' }}></i> Feature Lock Status
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {intelligenceFeatures.map((f: any) => (
                  <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f5efe8', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: f.isLocked ? '#ef4444' : '#10b981' }}></div>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>{f.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: f.tier === 'PREMIUM' ? '#f3e8ff' : f.tier === 'STANDARD' ? '#dbeafe' : '#f3f4f6', color: f.tier === 'PREMIUM' ? '#9333ea' : f.tier === 'STANDARD' ? '#2563eb' : '#6b7280' }}>
                        {f.tier}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: f.isLocked ? '#ef4444' : '#10b981' }}>
                        {f.isLocked ? 'Locked' : 'Available'}
                      </span>
                    </div>
                  </div>
                ))}
                {intelligenceFeatures.length === 0 && (
                  <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '24px' }}>No intelligence features configured yet</p>
                )}
              </div>
            </div>

            {/* Tier Distribution */}
            <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa fa-layer-group" style={{ color: '#8b5cf6' }}></i> Feature Distribution by Tier
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {['PREMIUM', 'STANDARD', 'BASIC'].map((tier) => {
                  const tierFeatures = intelligenceFeatures.filter((f: any) => f.tier === tier);
                  const unlockedInTier = tierFeatures.filter((f: any) => !f.isLocked).length;
                  const totalInTier = tierFeatures.length;
                  const pct = totalInTier > 0 ? (unlockedInTier / totalInTier) * 100 : 0;
                  const tierColor = tier === 'PREMIUM' ? '#9333ea' : tier === 'STANDARD' ? '#2563eb' : '#6b7280';
                  return (
                    <div key={tier}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{tier.charAt(0) + tier.slice(1).toLowerCase()}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{unlockedInTier}/{totalInTier} unlocked</span>
                      </div>
                      <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '999px', background: tierColor, width: `${pct}%`, transition: 'width 0.5s ease' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: '20px', padding: '16px', background: '#f0fdfa', borderRadius: '10px', border: '1px solid #ccfbf1' }}>
                <p style={{ fontSize: '13px', color: '#0f766e', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa fa-info-circle"></i>
                  Premium intelligence features (AI Tutor, Benchmarking, Psychometric, Adaptive Testing, Exam Quality) are locked by default. Schools need a Premium subscription to access them.
                </p>
              </div>
            </div>
          </div>

          {/* Radar: Intelligence Capability Profile */}
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-chart-line" style={{ color: '#14b8a6' }}></i> Intelligence Capability Profile
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 20px' }}>Feature availability across the platform (100% = fully unlocked)</p>
            <RadarChart
              indicators={intelligenceFeatures.map((f: any) => ({ name: f.name.split(' ').slice(0, 2).join(' '), max: 100 }))}
              series={[{
                name: 'Availability',
                value: intelligenceFeatures.map((f: any) => f.isLocked ? 0 : 100),
                color: '#14b8a6',
              }]}
            />
          </div>
        </div>
      )}

      {activeTab === 'adoption' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-rocket" style={{ color: '#14b8a6' }}></i> Feature Adoption Status
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Feature</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Tier</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 600, color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {intelligenceFeatures.map((f: any) => (
                    <tr key={f.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 500, color: '#374151' }}>{f.name}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: f.isLocked ? '#fee2e2' : '#d1fae5', color: f.isLocked ? '#dc2626' : '#059669' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: f.isLocked ? '#dc2626' : '#059669' }}></span>
                          {f.isLocked ? 'Locked' : 'Available'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: f.tier === 'PREMIUM' ? '#f3e8ff' : f.tier === 'STANDARD' ? '#dbeafe' : '#f3f4f6', color: f.tier === 'PREMIUM' ? '#9333ea' : f.tier === 'STANDARD' ? '#2563eb' : '#6b7280' }}>
                          {f.tier}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <a href="/super-admin/model-locks" style={{ color: '#14b8a6', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
                          Manage <i className="fa fa-arrow-right" style={{ fontSize: '11px', marginLeft: '4px' }}></i>
                        </a>
                      </td>
                    </tr>
                  ))}
                  {intelligenceFeatures.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No intelligence features configured</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <ComparisonChart
            categories={['AI Tutor', 'Benchmarking', 'Psychometric', 'Adaptive Testing', 'Learning Style', 'Exam Quality', 'Enhanced Analytics', 'Advanced Analytics']}
            groups={[
              { name: 'Available', values: [0, 0, 0, 0, 100, 0, 100, 0].map((v, i) => {
                const key = ['intelligence.ai-tutor', 'intelligence.benchmarking', 'intelligence.psychometric', 'intelligence.adaptive-testing', 'intelligence.learning-style', 'intelligence.exam-quality', 'analytics.enhanced', 'analytics.advanced'][i];
                const feat = intelligenceFeatures.find((f: any) => f.key === key);
                return feat && !feat.isLocked ? 100 : 0;
              }), color: '#10b981' },
              { name: 'Locked', values: [0, 0, 0, 0, 100, 0, 100, 0].map((v, i) => {
                const key = ['intelligence.ai-tutor', 'intelligence.benchmarking', 'intelligence.psychometric', 'intelligence.adaptive-testing', 'intelligence.learning-style', 'intelligence.exam-quality', 'analytics.enhanced', 'analytics.advanced'][i];
                const feat = intelligenceFeatures.find((f: any) => f.key === key);
                return feat && feat.isLocked ? 100 : 0;
              }), color: '#ef4444' },
            ]}
            title="Feature Availability Comparison"
            yAxisLabel="Availability %"
          />
        </div>
      )}

      {activeTab === 'schools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-trophy" style={{ color: '#f59e0b' }}></i> School Intelligence Readiness
            </h2>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 20px' }}>Schools ranked by subscription tier and feature access</p>

            <RankingTable
              data={[
                ...((stats?.recentSchools || []).map((school: any, i: number) => ({
                  rank: i + 1,
                  name: school.name,
                  value: school.subscriptionStatus === 'active' ? 100 : school.subscriptionStatus === 'trial' ? 50 : 0,
                  change: 'same' as const,
                  secondaryValue: school.subscriptionStatus || 'inactive',
                }))),
              ]}
              valueLabel="Readiness Score"
              maxItems={15}
            />
          </div>

          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-chart-bar" style={{ color: '#3b82f6' }}></i> Subscription Distribution
            </h2>
            {stats?.schoolsByStatus ? (
              <ComparisonChart
                categories={stats.schoolsByStatus.map((s: any) => s.subscriptionStatus || 'unknown')}
                groups={[{
                  name: 'Schools',
                  values: stats.schoolsByStatus.map((s: any) => s._count?.subscriptionStatus || 0),
                  color: '#14b8a6',
                }]}
                yAxisLabel="Count"
              />
            ) : (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '24px' }}>No subscription data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
