'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { intelligenceApi, classApi, termApi } from '@/lib/api';
import ComparisonChart from '@/components/charts-echarts/ComparisonChart';
import TrendChart from '@/components/charts-echarts/TrendChart';
import RadarChart from '@/components/charts-echarts/RadarChart';

export default function BenchmarkingPage() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

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

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['benchmark-dashboard', selectedTerm],
    queryFn: () => intelligenceApi.getSchoolBenchmarkDashboard(selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedTerm,
  });

  const { data: multiSubjectData, isLoading: multiSubjectLoading } = useQuery({
    queryKey: ['multi-subject-benchmark', selectedClass, selectedTerm],
    queryFn: () => intelligenceApi.getMultiSubjectBenchmark(selectedClass, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: singleCompare, isLoading: singleCompareLoading } = useQuery({
    queryKey: ['national-compare', selectedSubject, selectedTerm],
    queryFn: () => intelligenceApi.compareWithNational(selectedSubject, selectedTerm).then(r => r.data?.data || r.data),
    enabled: !!selectedSubject && !!selectedTerm,
  });

  const { data: benchmarkTrends, isLoading: trendsLoading } = useQuery({
    queryKey: ['benchmark-trends', selectedSubject],
    queryFn: () => intelligenceApi.getBenchmarkTrends(selectedSubject).then(r => r.data?.data || r.data),
    enabled: !!selectedSubject,
  });

  const schoolAvg = dashboardData?.schoolAverage;
  const nationalAvg = dashboardData?.nationalAverage;
  const comparisonGroups = dashboardData?.subjects
    ? [
      { name: 'School', values: dashboardData.subjects.map((s: any) => s.schoolAvg || 0), color: '#ea6645' },
      { name: 'National', values: dashboardData.subjects.map((s: any) => s.nationalAvg || 0), color: '#3b82f6' },
    ]
    : [];

  const radarIndicators = (multiSubjectData?.subjects || []).map((s: any) => ({
    name: s.name || s.subject,
    max: 100,
  }));
  const radarSeries = [
    { name: 'School', value: (multiSubjectData?.subjects || []).map((s: any) => s.schoolAvg || 0), color: '#ea6645' },
    { name: 'National', value: (multiSubjectData?.subjects || []).map((s: any) => s.nationalAvg || 0), color: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Benchmarking</h1>
        <p className="text-gray-600 mt-1">Compare performance against national averages and standards</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">All Classes</option>
              {(classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
            <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select Term</option>
              {(terms || []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">All Subjects</option>
              {(dashboardData?.subjects || []).map((s: any) => (
                <option key={s.subjectId || s.id} value={s.subjectId || s.id}>{s.name || s.subject}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-orange-600">{dashboardData.overallScore?.toFixed(1) || 'N/A'}</div>
            <div className="text-sm text-gray-600 mt-1">Overall Score</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{schoolAvg?.toFixed(1) || 'N/A'}</div>
            <div className="text-sm text-gray-600 mt-1">School Average</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-green-600">{nationalAvg?.toFixed(1) || 'N/A'}</div>
            <div className="text-sm text-gray-600 mt-1">National Average</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {schoolAvg && nationalAvg ? (schoolAvg - nationalAvg).toFixed(1) : 'N/A'}
            </div>
            <div className="text-sm text-gray-600 mt-1">Gap</div>
          </div>
        </div>
      )}

      {dashboardData?.subjects && comparisonGroups[0] && (
        <ComparisonChart
          categories={dashboardData.subjects.map((s: any) => s.name || s.subject)}
          groups={comparisonGroups}
          title="Subject-wise School vs National Comparison"
          loading={dashboardLoading}
        />
      )}

      {multiSubjectData?.subjects && (
        <RadarChart
          indicators={radarIndicators}
          series={radarSeries}
          title="Multi-Subject Benchmark Radar"
          loading={multiSubjectLoading}
        />
      )}

      {singleCompare && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrendChart
            lines={[{
              name: 'School',
              data: (singleCompare.history || []).map((h: any) => ({
                label: h.term || h.year?.toString(),
                value: h.schoolAvg || h.average || 0,
              })),
              color: '#ea6645',
            }, {
              name: 'National',
              data: (singleCompare.history || []).map((h: any) => ({
                label: h.term || h.year?.toString(),
                value: h.nationalAvg || 0,
              })),
              color: '#3b82f6',
            }]}
            title="Subject Comparison Trends"
            loading={singleCompareLoading}
          />
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Statistical Significance</h3>
            {singleCompare.tTest ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">T-Statistic</span>
                  <span className="font-semibold">{singleCompare.tTest.tStatistic?.toFixed(4) || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">P-Value</span>
                  <span className={`font-semibold ${singleCompare.tTest.pValue < 0.05 ? 'text-green-600' : 'text-orange-600'}`}>
                    {singleCompare.tTest.pValue?.toFixed(4) || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Significant?</span>
                  <span className={`font-semibold ${singleCompare.tTest.significant ? 'text-green-600' : 'text-orange-600'}`}>
                    {singleCompare.tTest.significant ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Effect Size</span>
                  <span className="font-semibold">{singleCompare.tTest.cohensD?.toFixed(3) || 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No statistical data available</div>
            )}
          </div>
        </div>
      )}

      {benchmarkTrends && (
        <TrendChart
          lines={[{
            name: 'National Average',
            data: (Array.isArray(benchmarkTrends) ? benchmarkTrends : []).map((b: any) => ({
              label: b.year?.toString(),
              value: b.average || 0,
            })),
            color: '#8b5cf6',
          }]}
          title="National Benchmark Trends"
          loading={trendsLoading}
          yAxisLabel="Average Score"
        />
      )}
    </div>
  );
}
