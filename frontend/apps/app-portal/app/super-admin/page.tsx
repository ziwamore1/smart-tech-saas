'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi, templateBuilderApi } from '@/lib/api';
import Link from 'next/link';
import Icon3D from '@/components/Icon3D';
import ReactECharts from 'echarts-for-react';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradAmber = 'linear-gradient(135deg, #f59e0b, #d97706)';
const gradGray = 'linear-gradient(135deg, #f3f4f6, #e8ddd0)';
const gradBlueLight = 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
const gradGreenLight = 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
const gradPurpleLight = 'linear-gradient(135deg, #ede9fe, #ddd6fe)';
const gradTealLight = 'linear-gradient(135deg, #ccfbf1, #99f6e4)';
const gradAmberLight = 'linear-gradient(135deg, #fef3c7, #fde68a)';
const gradOrangeLight = 'linear-gradient(135deg, #ffedd5, #fed7aa)';

export default function SuperAdminPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const [templateStats, setTemplateStats] = useState<any>(null);
  const [templateStatsLoading, setTemplateStatsLoading] = useState(true);

  const [resultsAnalytics, setResultsAnalytics] = useState<any>(null);
  const [resultsAnalyticsLoading, setResultsAnalyticsLoading] = useState(true);

  const loadStats = async () => {
    try {
      const response = await superAdminApi.getStats();
      setStats(response.data?.data || response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateStats = async () => {
    try {
      const response = await templateBuilderApi.getStats();
      setTemplateStats(response.data?.data || response.data);
    } catch (error) {
      console.error('Failed to load template stats:', error);
    } finally {
      setTemplateStatsLoading(false);
    }
  };

  const loadResultsAnalytics = async () => {
    try {
      const response = await superAdminApi.getResultsAnalytics();
      setResultsAnalytics(response.data?.data || response.data);
    } catch (error) {
      console.error('Failed to load results analytics:', error);
    } finally {
      setResultsAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
      loadTemplateStats();
      loadResultsAnalytics();
    }
  }, [isAuthenticated]);

  if (isLoading || loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5efe8'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px',
            background: gradOrange,
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '18px'
          }}>
            ST
          </div>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #e8ddd0',
            borderTopColor: '#ea6645',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const PIE_COLORS = ['#ea6645', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#14b8a6', '#ec4899', '#6366f1'];
  const gradeDist = resultsAnalytics?.gradeDistribution || [];
  const histogram = resultsAnalytics?.scoreHistogram || [];
  const schoolPerf = resultsAnalytics?.schoolPerformance || [];
  const heatmap = resultsAnalytics?.subjectHeatmap || { schools: [], subjects: [], values: [] };
  const overallQuality = resultsAnalytics?.overallQuality || { passed: 0, assessed: 0, rate: 0, belowStandard: 0 };
  const overallQuantity = resultsAnalytics?.overallQuantity || { passed: 0, assessed: 0, rate: 0, belowStandard: 0 };
  const qualitySchools = resultsAnalytics?.qualityQuantityBySchool || [];

  const heatmapCells: [number, number, number][] = [];
  (heatmap.schools || []).forEach((school: string, si: number) => {
    (heatmap.subjects || []).forEach((subject: string, ti: number) => {
      heatmapCells.push([ti, si, heatmap.values?.[si]?.[ti] ?? 0]);
    });
  });

  const gradePieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
    color: PIE_COLORS,
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { fontSize: 11 },
      data: gradeDist.map((d: any) => ({ name: d.grade, value: d.count })),
    }],
  };

  const histogramOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '10%', right: '4%', bottom: '16%', top: '10%' },
    xAxis: { type: 'category', data: histogram.map((b: any) => b.bucket), axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#f3f4f6' } } },
    series: [{
      type: 'bar',
      data: histogram.map((b: any) => b.count),
      itemStyle: { color: '#ea6645', borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 28,
    }],
  };

  const schoolBarOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '10%', right: '4%', bottom: '18%', top: '10%' },
    xAxis: { type: 'category', data: schoolPerf.map((s: any) => s.schoolName), axisLabel: { fontSize: 10, rotate: 35 } },
    yAxis: { type: 'value', max: 100, name: 'Avg Score', nameTextStyle: { fontSize: 11 } },
    series: [{
      type: 'bar',
      data: schoolPerf.map((s: any) => s.average),
      itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 30,
    }],
  };

  const qualityQuantitySchoolOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: '10%', right: '4%', bottom: '18%', top: '12%' },
    xAxis: { type: 'category', data: qualitySchools.map((s: any) => s.schoolName), axisLabel: { fontSize: 10, rotate: 35 } },
    yAxis: { type: 'value', max: 100, name: 'Pass %', nameTextStyle: { fontSize: 11 } },
    series: [
      { name: 'Quality', type: 'bar', data: qualitySchools.map((s: any) => s.qualityPassRate), itemStyle: { color: '#059669', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 },
      { name: 'Quantity', type: 'bar', data: qualitySchools.map((s: any) => s.quantityPassRate), itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 },
    ],
  };

  const heatmapOption = {
    tooltip: {
      position: 'top',
      formatter: (p: any) => {
        const [ti, si, v] = p.data;
        return `${heatmap.schools[si]} - ${heatmap.subjects[ti]}: ${Number(v).toFixed(1)}`;
      },
    },
    grid: { left: '14%', right: '4%', bottom: '20%', top: '8%' },
    xAxis: { type: 'category', data: heatmap.subjects, splitArea: { show: true }, axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'category', data: heatmap.schools, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: { color: ['#fee2e2', '#fca5a5', '#ef4444', '#b91c1c'] },
    },
    series: [{
      type: 'heatmap',
      data: heatmapCells,
      label: { show: true, fontSize: 9, formatter: (p: any) => p.value[2]?.toFixed(0) },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .stat-card { transition: all 0.3s ease; cursor: pointer; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .menu-card { transition: all 0.3s ease; cursor: pointer; }
        .menu-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(234,102,69,0.18); }
        .progress-bar { transition: width 0.5s ease; }
        .school-card { transition: all 0.25s ease; }
        .school-card:hover { background: #f5efe8; border-color: #fed7aa; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>Super Admin Dashboard</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            Welcome back, <span style={{ fontWeight: 600, color: '#ea6645' }}>{user?.firstName} {user?.lastName}</span>
          </p>
        </div>
        <Link href="/super-admin/schools/new" style={{
          padding: '12px 20px', background: gradOrange, color: 'white',
          borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 4px 12px rgba(234,102,69,0.3)'
        }}>
          <i className="fa fa-plus"></i> Register New School
        </Link>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(59,130,246,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon3D name="schools" size={52} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '20px' }}>SCHOOLS</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Total Schools</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalSchools || 0}</p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>{stats?.activeSchools || 0} active</span>
            <span style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: '#9ca3af', borderRadius: '50%' }}></span>{stats?.inactiveSchools || 0} inactive</span>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(16,185,129,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon3D name="students" size={52} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '20px' }}>STUDENTS</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Total Students</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalStudents?.toLocaleString() || 0}</p>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(139,92,246,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon3D name="teachers" size={52} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '4px 10px', borderRadius: '20px' }}>TEACHERS</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Total Teachers</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalTeachers?.toLocaleString() || 0}</p>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(234,102,69,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon3D name="dashboard" size={52} />
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#ea6645', background: '#fff7ed', padding: '4px 10px', borderRadius: '20px' }}>USERS</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Total Users</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalUsers?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Template & Document Features Stats */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-file-alt" style={{ color: '#f97316' }}></i> Template & Document Features
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(249,115,22,0.1)', borderBottomLeftRadius: '40px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon3D name="template" size={40} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#ea580c', background: '#fff7ed', padding: '3px 8px', borderRadius: '20px' }}>TEMPLATES</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Report Templates</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{templateStats?.totalTemplates || stats?.totalTemplates || 0}</p>
          </div>

          <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(139,92,246,0.1)', borderBottomLeftRadius: '40px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon3D name="marketplace" size={40} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '3px 8px', borderRadius: '20px' }}>MARKETPLACE</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Published Templates</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{templateStats?.totalMarketplace || stats?.totalMarketplace || 0}</p>
          </div>

          <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(6,182,212,0.1)', borderBottomLeftRadius: '40px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon3D name="library" size={40} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#0891b2', background: '#ecfeff', padding: '3px 8px', borderRadius: '20px' }}>ASSETS</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Cloud Assets</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{templateStats?.totalAssets || stats?.totalAssets || 0}</p>
          </div>

          <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(20,184,166,0.1)', borderBottomLeftRadius: '40px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon3D name="signatures" size={40} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#0d9488', background: '#f0fdfa', padding: '3px 8px', borderRadius: '20px' }}>SIGNATURES</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Digital Signatures</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{templateStats?.totalSignatures || stats?.totalSignatures || 0}</p>
          </div>

          <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(236,72,153,0.1)', borderBottomLeftRadius: '40px' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon3D name="branding" size={40} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#db2777', background: '#fdf2f8', padding: '3px 8px', borderRadius: '20px' }}>BRANDING</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Brand Presets</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{templateStats?.totalBrandPresets || stats?.totalBrandPresets || 0}</p>
          </div>
        </div>
      </div>

      {/* Primary Schools Monitoring */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #059669, #047857)', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-child" style={{ fontSize: '16px', color: 'white' }}></i>
              </span>
              Primary Schools Monitoring
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>ECE, Lower Primary, and Upper Primary — enrollment pipeline, staffing, and health metrics</p>
          </div>
          <Link href="/dashboard/primary" style={{
            padding: '10px 18px', background: 'linear-gradient(135deg, #059669, #047857)', color: 'white',
            borderRadius: '8px', fontWeight: 600, fontSize: '13px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(5,150,105,0.25)'
          }}>
            <i className="fa fa-external-link-alt"></i> Open Primary Dashboard
          </Link>
        </div>

        {/* Primary Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="stat-card" style={{ padding: '18px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>{stats?.totalPrimarySchools || 0}</div>
            <div style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>Primary Schools</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>offering ECE & Primary levels</div>
          </div>

         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
           <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
               <div style={{ fontSize: '28px', fontWeight: 700, color: '#059669' }}>{Number(overallQuality.rate || 0).toFixed(1)}%</div>
               <i className="fa fa-star" style={{ color: '#059669' }}></i>
             </div>
             <div style={{ fontSize: '13px', color: '#065f46', fontWeight: 600 }}>Overall School Quality</div>
             <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>{overallQuality.passed || 0} of {overallQuality.assessed || 0} assessed results passed the quality standard</div>
           </div>
           <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
               <div style={{ fontSize: '28px', fontWeight: 700, color: '#2563eb' }}>{Number(overallQuantity.rate || 0).toFixed(1)}%</div>
               <i className="fa fa-check-double" style={{ color: '#2563eb' }}></i>
             </div>
             <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>Overall School Quantity</div>
             <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '4px' }}>{overallQuantity.passed || 0} of {overallQuantity.assessed || 0} assessed results passed the quantity standard</div>
           </div>
         </div>
          <div className="stat-card" style={{ padding: '18px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#2563eb' }}>{stats?.primaryStudents?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>Primary Students</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Grade 1–7 + ECE</div>
          </div>
          <div className="stat-card" style={{ padding: '18px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#d97706' }}>{stats?.primaryTeachers?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>Primary Staff</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
              {stats?.primaryTeachingStaff || 0} teaching · {stats?.primaryNonTeachingStaff || 0} non-teaching
            </div>
          </div>
          <div className="stat-card" style={{ padding: '18px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#ea580c' }}>
              {stats?.totalPrimarySchools && stats?.totalSchools
                ? Math.round((stats.totalPrimarySchools / stats.totalSchools) * 100)
                : 0}%
            </div>
            <div style={{ fontSize: '13px', color: '#9a3412', fontWeight: 500 }}>of Total Schools</div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{stats?.totalPrimarySchools || 0} / {stats?.totalSchools || 0} schools</div>
          </div>
        </div>

        {/* Enrollment Pipeline + Recent Primary Schools */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-users" style={{ color: '#059669' }}></i> Enrollment Pipeline (Grade 1–7)
            </h3>
            {stats?.enrollmentPipeline?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.enrollmentPipeline.map((item: any, idx: number) => {
                  const maxCount = Math.max(...stats.enrollmentPipeline.map((e: any) => e.count), 1);
                  const barPct = (item.count / maxCount) * 100;
                  const colors = ['#bbf7d0', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857'];
                  return (
                    <div key={item.grade}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{item.grade}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{item.count}</span>
                      </div>
                      <div style={{ height: '8px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
                        <div className="progress-bar" style={{
                          height: '100%', borderRadius: '999px',
                          background: colors[idx % colors.length],
                          width: `${barPct}%`,
                        }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No enrollment data available</p>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa fa-building" style={{ color: '#059669' }}></i> Recent Primary Schools
              </h3>
              <Link href="/super-admin/schools" style={{ fontSize: '12px', color: '#059669', textDecoration: 'none', fontWeight: 500 }}>View all <i className="fa fa-arrow-right" style={{ fontSize: '10px' }}></i></Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats?.recentPrimarySchools?.length > 0 ? stats.recentPrimarySchools.map((school: any) => (
                <Link key={school.id} href={`/super-admin/schools/${school.id}`} className="school-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '12px', border: '1px solid #e8ddd0', textDecoration: 'none', background: '#fefcf9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#f0fdf4', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa fa-child" style={{ fontSize: '16px', color: '#059669' }}></i>
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{school.name}</p>
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{school._count?.students || 0} students, {school._count?.teachers || 0} staff</p>
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '8px', background: school.subscriptionStatus === 'active' ? '#d1fae5' : school.subscriptionStatus === 'trial' ? '#fef3c7' : '#f3f4f6', color: school.subscriptionStatus === 'active' ? '#059669' : school.subscriptionStatus === 'trial' ? '#d97706' : '#6b7280' }}>{school.subscriptionStatus || 'Inactive'}</span>
                </Link>
              )) : (
                <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No primary schools registered</p>
              )}
            </div>

      {/* Results Analytics */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #ea6645, #f59e0b)', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-chart-line" style={{ fontSize: '16px', color: 'white' }}></i>
              </span>
              Results Analytics
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Performance across schools that have published results</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ padding: '16px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea580c' }}>{resultsAnalytics?.publishedSchools || 0}</div>
            <div style={{ fontSize: '13px', color: '#9a3412', fontWeight: 500 }}>Schools Publishing</div>
          </div>
          <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb' }}>{resultsAnalytics?.publishedClasses || 0}</div>
            <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>Published Classes</div>
          </div>
          <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{resultsAnalytics?.publishedResults?.toLocaleString() || 0}</div>
            <div style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>Published Scores</div>
          </div>
        </div>

        {resultsAnalyticsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
            <i className="fa fa-spinner fa-spin" style={{ fontSize: '20px', marginBottom: '12px', display: 'block' }}></i>
            <p>Loading results analytics...</p>
          </div>
        ) : resultsAnalytics?.publishedResults ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
             <div style={{ background: '#fffdf9', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa fa-chart-pie" style={{ color: '#ea6645' }}></i> Grade Distribution
              </h3>
              <ReactECharts option={gradePieOption} style={{ height: 320 }} />
            </div>
            <div style={{ background: '#fffdf9', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa fa-chart-bar" style={{ color: '#8b5cf6' }}></i> Score Histogram
              </h3>
              <ReactECharts option={histogramOption} style={{ height: 320 }} />
            </div>
            <div style={{ background: '#fffdf9', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa fa-trophy" style={{ color: '#f59e0b' }}></i> School Performance
              </h3>
               <ReactECharts option={schoolBarOption} style={{ height: 320 }} />
             </div>
             <div style={{ background: '#fffdf9', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
               <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <i className="fa fa-balance-scale" style={{ color: '#0891b2' }}></i> Quality vs Quantity by School
               </h3>
               <ReactECharts option={qualityQuantitySchoolOption} style={{ height: 320 }} />
             </div>
            <div style={{ background: '#fffdf9', borderRadius: '12px', border: '1px solid #e8ddd0', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa fa-th-large" style={{ color: '#14b8a6' }}></i> Subject Heatmap by School
              </h3>
              <ReactECharts option={heatmapOption} style={{ height: Math.max(320, (heatmap.schools || []).length * 36 + 140) }} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
            <i className="fa fa-chart-bar" style={{ fontSize: '28px', marginBottom: '12px', color: '#d1d5db', display: 'block' }}></i>
            <p>No published results yet — analytics will appear once schools publish results</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
              {[
                { href: '/dashboard/primary', icon: 'fa-chart-pie', label: 'Primary Dashboard', color: '#059669', bg: '#f0fdf4' },
                { href: '/dashboard/curriculum', icon: 'fa-book-open', label: 'Curriculum Config', color: '#0891b2', bg: '#ecfeff' },
                { href: '/dashboard/report-cards', icon: 'fa-file-alt', label: 'Report Cards', color: '#8b5cf6', bg: '#f5f3ff' },
                { href: '/dashboard/parents', icon: 'fa-user-friends', label: 'Parents Mgmt', color: '#ec4899', bg: '#fdf2f8' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                  borderRadius: '10px', border: '1px solid #e8ddd0', textDecoration: 'none',
                  background: '#fefcf9', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#f3f4f6'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa ${item.icon}`} style={{ fontSize: '14px', color: item.color }}></i>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa fa-chart-pie" style={{ color: '#ea6645' }}></i> Schools by Status
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stats?.schoolsByStatus?.map((item: any) => (
              <div key={item.subscriptionStatus}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.subscriptionStatus === 'active' ? '#10b981' : item.subscriptionStatus === 'trial' ? '#f59e0b' : item.subscriptionStatus === 'expired' ? '#ef4444' : '#9ca3af' }}></span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151', textTransform: 'capitalize' }}>{item.subscriptionStatus}</span>
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937' }}>{item._count?.subscriptionStatus || 0}</span>
                </div>
                <div style={{ height: '8px', background: '#e8ddd0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div className="progress-bar" style={{ height: '100%', borderRadius: '999px', background: item.subscriptionStatus === 'active' ? '#10b981' : item.subscriptionStatus === 'trial' ? '#f59e0b' : item.subscriptionStatus === 'expired' ? '#ef4444' : '#9ca3af', width: `${stats?.totalSchools ? ((item._count?.subscriptionStatus / stats.totalSchools) * 100) : 0}%` }}></div>
                </div>
              </div>
            ))}
            {(!stats?.schoolsByStatus || stats.schoolsByStatus.length === 0) && (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No school data available</p>
            )}
          </div>
        </div>

        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-building" style={{ color: '#3b82f6' }}></i> Recent Schools
            </h2>
            <Link href="/super-admin/schools" style={{ fontSize: '13px', color: '#ea6645', textDecoration: 'none', fontWeight: 500 }}>View all <i className="fa fa-arrow-right" style={{ fontSize: '11px' }}></i></Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats?.recentSchools?.map((school: any) => (
              <Link key={school.id} href={`/super-admin/schools/${school.id}`} className="school-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', border: '1px solid #e8ddd0', textDecoration: 'none', background: '#fefcf9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', background: gradOrangeLight, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa fa-building" style={{ fontSize: '18px', color: '#ea580c' }}></i>
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{school.name}</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{school._count?.students || 0} students, {school._count?.teachers || 0} teachers</p>
                  </div>
                </div>
                <span style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', background: school.subscriptionStatus === 'active' ? '#d1fae5' : school.subscriptionStatus === 'trial' ? '#fef3c7' : '#f3f4f6', color: school.subscriptionStatus === 'active' ? '#059669' : school.subscriptionStatus === 'trial' ? '#d97706' : '#6b7280' }}>{school.subscriptionStatus || 'Inactive'}</span>
              </Link>
            ))}
            {(!stats?.recentSchools || stats.recentSchools.length === 0) && (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No recent schools</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
        <Link href="/super-admin/schools" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
          <Icon3D name="schools" size={50} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '8px' }}>Manage Schools</span>
        </Link>
        <Link href="/super-admin/schools/new" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
          <Icon3D name="startup" size={50} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '8px' }}>Register School</span>
        </Link>
        <Link href="/super-admin/model-locks" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
          <Icon3D name="stamps" size={50} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '8px' }}>Model Locks</span>
        </Link>
        <Link href="/super-admin/subscription-plans" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
          <Icon3D name="fees" size={50} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '8px' }}>Subscription Plans</span>
        </Link>
        <Link href="/super-admin/audit-logs" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
          <Icon3D name="audit" size={50} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '8px' }}>Audit Logs</span>
        </Link>
        <Link href="/super-admin/settings" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', borderRadius: '16px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
          <Icon3D name="settings" size={50} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginTop: '8px' }}>Settings</span>
        </Link>
      </div>

      {/* Online Exams Engine Section */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #f97316, #ea580c)', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-file-alt" style={{ fontSize: '16px', color: 'white' }}></i>
              </span>
              Online Exams Engine
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Rich document rendering, auto-marking, analytics, and AI-ready assessments</p>
          </div>
          <Link href="/dashboard/exams" style={{
            padding: '10px 18px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white',
            borderRadius: '8px', fontWeight: 600, fontSize: '13px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(234,102,69,0.25)'
          }}>
            <i className="fa fa-external-link-alt"></i> Manage Exams
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ padding: '16px', background: '#fff7ed', borderRadius: '12px', border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ea580c' }}>{stats?.totalExams || stats?.examsCount || 0}</div>
            <div style={{ fontSize: '13px', color: '#9a3412', fontWeight: 500 }}>Total Exams</div>
          </div>
          <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb' }}>{stats?.totalQuestions || stats?.questionsCount || 0}</div>
            <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>Questions</div>
          </div>
          <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{stats?.uploadedPapers || stats?.papersCount || 0}</div>
            <div style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>Uploaded Papers</div>
          </div>
          <div style={{ padding: '16px', background: '#f5f3ff', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#7c3aed' }}>{stats?.totalAttempts || stats?.attemptsCount || 0}</div>
            <div style={{ fontSize: '13px', color: '#5b21b6', fontWeight: 500 }}>Exam Attempts</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { href: '/dashboard/exams', icon: 'fa-file-alt', label: 'Exam Builder', desc: 'Create rich exams with equations, tables, and images', color: '#f97316', bg: '#fff7ed' },
            { href: '/dashboard/results-management/result-entry', icon: 'fa-tasks', label: 'Result Entry', desc: 'Centralised result and assessment entry', color: '#8b5cf6', bg: '#f5f3ff' },
            { href: '/dashboard/results', icon: 'fa-chart-bar', label: 'Results & Analytics', desc: 'Auto-marking, scoring and performance dashboards', color: '#10b981', bg: '#f0fdf4' },
            { href: '/dashboard/grading', icon: 'fa-check-double', label: 'Grading Engine', desc: 'AI-assisted marking and feedback', color: '#3b82f6', bg: '#eff6ff' },
            { href: '/dashboard/exam-quality', icon: 'fa-chart-line', label: 'Exam Quality', desc: 'Item analysis and question performance', color: '#f59e0b', bg: '#fffbeb' },
            { href: '/dashboard/analytics-enhanced', icon: 'fa-robot', label: 'AI Analytics', desc: 'Predictive insights and student performance analysis', color: '#14b8a6', bg: '#f0fdfa' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
              borderRadius: '12px', border: '1px solid #e8ddd0', textDecoration: 'none',
              background: '#fefcf9', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#f3f4f6'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa ${item.icon}`} style={{ fontSize: '16px', color: item.color }}></i>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{item.desc}</div>
              </div>
              <i className="fa fa-chevron-right" style={{ fontSize: '11px', color: '#d1d5db', marginLeft: 'auto', flexShrink: 0 }}></i>
            </Link>
          ))}
        </div>
      </div>

      {/* Template Features Quick Actions */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-file-alt" style={{ color: '#f97316' }}></i> Template Management
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <Link href="/super-admin/templates" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 14px', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
            <Icon3D name="template" size={44} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'center', marginTop: '8px' }}>All Templates</span>
          </Link>
          <Link href="/super-admin/marketplace" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 14px', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
            <Icon3D name="marketplace" size={44} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'center', marginTop: '8px' }}>Marketplace</span>
          </Link>
          <Link href="/super-admin/branding" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 14px', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
            <Icon3D name="branding" size={44} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'center', marginTop: '8px' }}>Brand Presets</span>
          </Link>
          <Link href="/super-admin/assets" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 14px', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
            <Icon3D name="library" size={44} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'center', marginTop: '8px' }}>Cloud Assets</span>
          </Link>
          <Link href="/super-admin/signatures" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 14px', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
            <Icon3D name="signatures" size={44} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'center', marginTop: '8px' }}>Signatures</span>
          </Link>
          <Link href="/super-admin/intelligence" className="menu-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 14px', borderRadius: '14px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', background: '#fefcf9', textDecoration: 'none' }}>
            <Icon3D name="intelligence" size={44} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', textAlign: 'center', marginTop: '8px' }}>AI Generator</span>
          </Link>
        </div>
      </div>

      {/* Document Verification Section */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-shield-alt" style={{ fontSize: '16px', color: 'white' }}></i>
              </span>
              Document Verification Center
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Cryptographic signatures, blockchain certificates, and approval workflows</p>
          </div>
          <Link href="/super-admin/verification" style={{
            padding: '10px 18px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
            borderRadius: '8px', fontWeight: 600, fontSize: '13px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
          }}>
            <i className="fa fa-external-link-alt"></i> Open Verification Center
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb' }}>
              <i className="fa fa-pen-fancy"></i>
            </div>
            <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 500 }}>Digital Signatures</div>
          </div>
          <div style={{ padding: '16px', background: '#f5f3ff', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#7c3aed' }}>
              <i className="fa fa-link"></i>
            </div>
            <div style={{ fontSize: '13px', color: '#5b21b6', fontWeight: 500 }}>Blockchain Certs</div>
          </div>
          <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>
              <i className="fa fa-building"></i>
            </div>
            <div style={{ fontSize: '13px', color: '#166534', fontWeight: 500 }}>Ministry API</div>
          </div>
          <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706' }}>
              <i className="fa fa-check-double"></i>
            </div>
            <div style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>Approval Chains</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { href: '/super-admin/verification/signatures', icon: 'fa-pen-fancy', label: 'Document Signatures', desc: 'Manage cryptographic signatures', color: '#3b82f6', bg: '#eff6ff' },
            { href: '/super-admin/verification/blockchain', icon: 'fa-link', label: 'Blockchain Certificates', desc: 'Immutable blockchain records', color: '#8b5cf6', bg: '#f5f3ff' },
            { href: '/super-admin/verification/ministry', icon: 'fa-building', label: 'Ministry Verifications', desc: 'Track ministry API status', color: '#10b981', bg: '#ecfdf5' },
            { href: '/super-admin/verification/approvals', icon: 'fa-check-double', label: 'Approval Workflows', desc: 'Monitor approval chains', color: '#f59e0b', bg: '#fffbeb' },
            { href: '/verify/certificate', icon: 'fa-external-link-alt', label: 'Public Verification', desc: 'Open public portal', color: '#6366f1', bg: '#eef2ff' },
            { href: '/super-admin/stamp-verifications', icon: 'fa-stamp', label: 'Stamp Verifications', desc: 'Digital stamp management', color: '#14b8a6', bg: '#f0fdfa' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
              borderRadius: '12px', border: '1px solid #e8ddd0', textDecoration: 'none',
              background: '#fefcf9', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#f3f4f6'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa ${item.icon}`} style={{ fontSize: '16px', color: item.color }}></i>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{item.desc}</div>
              </div>
              <i className="fa fa-chevron-right" style={{ fontSize: '11px', color: '#d1d5db', marginLeft: 'auto', flexShrink: 0 }}></i>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
