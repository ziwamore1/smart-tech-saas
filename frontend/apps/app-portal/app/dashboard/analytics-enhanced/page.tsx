'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, classApi, termApi } from '@/lib/api';
import HeatmapChart from '@/components/charts-echarts/HeatmapChart';
import RadarChart from '@/components/charts-echarts/RadarChart';
import BoxPlotChart from '@/components/charts-echarts/BoxPlotChart';
import DistributionCurve from '@/components/charts-echarts/DistributionCurve';
import CohortChart from '@/components/charts-echarts/CohortChart';
import TrendChart from '@/components/charts-echarts/TrendChart';
import ComparisonChart from '@/components/charts-echarts/ComparisonChart';
import RankingTable from '@/components/charts-echarts/RankingTable';

type Tab = 'overview' | 'comparison' | 'distribution' | 'cohort' | 'ranking';

export default function AnalyticsEnhancedPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedClass2, setSelectedClass2] = useState('');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const d = res.data?.data || res.data?.classes || res.data?.result || res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      const d = res.data?.data || res.data?.terms || res.data?.result || res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['heatmap', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getSubjectHeatmap(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: classPerf, isLoading: perfLoading } = useQuery({
    queryKey: ['class-perf', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getClassPerformance(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: classRanking, isLoading: rankingLoading } = useQuery({
    queryKey: ['class-ranking', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getClassRanking(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: subjectPerf, isLoading: subjectLoading } = useQuery({
    queryKey: ['subject-perf', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getSubjectPerformance(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: gradeDist, isLoading: gradeLoading } = useQuery({
    queryKey: ['grade-dist', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getGradeDistribution(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: genderPerf, isLoading: genderLoading } = useQuery({
    queryKey: ['gender-perf', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getGenderPerformance(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
    { key: 'comparison', label: 'Comparisons', icon: 'fa-chart-bar' },
    { key: 'distribution', label: 'Distributions', icon: 'fa-chart-line' },
    { key: 'cohort', label: 'Cohort Trends', icon: 'fa-wave-square' },
    { key: 'ranking', label: 'Rankings', icon: 'fa-list-ol' },
  ];

  const heatmapChartData = heatmapData ? {
    subjects: heatmapData.subjects || heatmapData.labels || [],
    students: heatmapData.students || [],
    values: heatmapData.values || heatmapData.matrix || [],
  } : undefined;

  const radarIndicators = subjectPerf?.subjects
    ? subjectPerf.subjects.map((s: any) => ({ name: s.name || s.subject, max: 100 }))
    : [];

  const radarSeries = subjectPerf?.subjects
    ? [{ name: 'Average', value: subjectPerf.subjects.map((s: any) => s.average || 0) }]
    : [];

  const cohortTerms = classPerf?.history?.map((h: any) => h.term || h.label) || [];
  const cohortSeries = classPerf?.history
    ? [
      { name: 'Average Score', data: classPerf.history.map((h: any) => h.average || 0), color: '#ea6645' },
      { name: 'Pass Rate', data: classPerf.history.map((h: any) => h.passRate || h.pass_rate || 0), color: '#3b82f6' },
    ]
    : [];

  const rankingEntries = classRanking?.students
    ? classRanking.students.map((s: any, i: number) => ({
      rank: i + 1,
      name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name,
      value: s.average || s.score || 0,
      change: s.change as 'up' | 'down' | 'same' | undefined,
      secondaryValue: s.grade,
    }))
    : [];

  const distributionData = gradeDist?.distribution
    ? gradeDist.distribution.map((d: any) => ({ value: d.score || d.grade || 0, frequency: d.count || 0 }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Enhanced Analytics</h1>
        <p className="text-gray-600 mt-1">Advanced visualizations and data analysis tools</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">All Classes</option>
              {(classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {activeTab === 'comparison' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Compare With</label>
              <select value={selectedClass2} onChange={(e) => setSelectedClass2(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select Class</option>
                {(classes || []).filter((c: any) => c.id !== selectedClass).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select Term</option>
              {(terms || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <i className={`fa ${tab.icon} mr-2`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {radarIndicators.length > 0 && (
              <RadarChart indicators={radarIndicators} series={radarSeries} title="Subject Performance Profile" loading={perfLoading} />
            )}
            {heatmapChartData && (
              <HeatmapChart data={heatmapChartData} title="Subject-Student Performance Matrix" loading={heatmapLoading} />
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {genderPerf && (
              <ComparisonChart
                categories={['Male', 'Female']}
                groups={[{ name: 'Performance', values: [genderPerf.maleAverage || 0, genderPerf.femaleAverage || 0], color: '#8b5cf6' }]}
                title="Gender Performance Comparison"
                loading={genderLoading}
              />
            )}
            {gradeDist?.gradeBreakdown && (
              <ComparisonChart
                categories={Object.keys(gradeDist.gradeBreakdown)}
                groups={[{ name: 'Students', values: Object.values(gradeDist.gradeBreakdown), color: '#ea6645' }]}
                title="Grade Breakdown"
                loading={gradeLoading}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {subjectPerf?.subjects && (
              <ComparisonChart
                categories={subjectPerf.subjects.map((s: any) => s.name || s.subject)}
                groups={[
                  { name: 'Average', values: subjectPerf.subjects.map((s: any) => s.average || 0), color: '#ea6645' },
                  { name: 'Highest', values: subjectPerf.subjects.map((s: any) => s.highest || s.max || 0), color: '#10b981' },
                  { name: 'Lowest', values: subjectPerf.subjects.map((s: any) => s.lowest || s.min || 0), color: '#ef4444' },
                ]}
                title="Subject Performance Comparison"
                loading={subjectLoading}
              />
            )}
            {genderPerf?.subjectBreakdown && (
              <ComparisonChart
                categories={genderPerf.subjectBreakdown.map((s: any) => s.name || s.subject)}
                groups={[
                  { name: 'Male', values: genderPerf.subjectBreakdown.map((s: any) => s.maleAvg || s.male || 0), color: '#3b82f6' },
                  { name: 'Female', values: genderPerf.subjectBreakdown.map((s: any) => s.femaleAvg || s.female || 0), color: '#ec4899' },
                ]}
                title="Gender by Subject"
                loading={genderLoading}
              />
            )}
          </div>
          {heatmapChartData && (
            <HeatmapChart data={heatmapChartData} title="Performance Heatmap" loading={heatmapLoading} />
          )}
        </div>
      )}

      {activeTab === 'distribution' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {distributionData.length > 0 && (
              <DistributionCurve
                data={distributionData}
                mean={gradeDist?.mean}
                stdDev={gradeDist?.stdDev}
                title="Score Distribution"
                loading={gradeLoading}
              />
            )}
            <BoxPlotChart
              data={(subjectPerf?.subjects || []).map((s: any) => ({
                name: s.name || s.subject,
                min: s.min || 0,
                q1: s.q1 || s.lowerQuartile || 0,
                median: s.median || s.average || 0,
                q3: s.q3 || s.upperQuartile || 0,
                max: s.max || 100,
                outliers: s.outliers,
              }))}
              title="Subject Score Distribution"
              loading={subjectLoading}
            />
          </div>
        </div>
      )}

      {activeTab === 'cohort' && (
        <div className="space-y-6">
          {cohortTerms.length > 0 ? (
            <CohortChart
              terms={cohortTerms}
              series={cohortSeries}
              title="Cross-Term Performance Trends"
              loading={perfLoading}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              Select a class and term with historical data
            </div>
          )}
          {classPerf?.predicted && (
            <TrendChart
              lines={[{
                name: 'Performance',
                data: [
                  ...(classPerf.history || []).map((h: any) => ({ label: h.term || h.label, value: h.average || 0 })),
                ],
                color: '#ea6645',
              }, {
                name: 'Projected',
                data: [
                  ...(classPerf.history || []).slice(-1).map((h: any) => ({ label: h.term || h.label, value: h.average || 0 })),
                  ...(classPerf.predicted || []).map((p: any) => ({ label: p.term || 'Next', value: p.value || p.average || 0, predicted: true })),
                ],
                color: '#3b82f6',
              }]}
              title="Growth Trajectory with Prediction"
              loading={perfLoading}
            />
          )}
        </div>
      )}

      {activeTab === 'ranking' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RankingTable
            data={rankingEntries}
            title="Student Rankings"
            valueLabel="Average"
            loading={rankingLoading}
          />
          {subjectPerf?.subjects && (
            <ComparisonChart
              categories={subjectPerf.subjects.map((s: any) => s.name || s.subject)}
              groups={[{
                name: 'Average Score',
                values: subjectPerf.subjects.map((s: any) => s.average || 0),
                color: '#ea6645',
              }]}
              title="Subject Performance Overview"
              loading={subjectLoading}
            />
          )}
        </div>
      )}
    </div>
  );
}
